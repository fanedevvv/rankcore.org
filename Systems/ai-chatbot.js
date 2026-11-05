// ─────────────────────────────────────────────────────────────────────────────
//  AI messageCreate handler — entry point
// ─────────────────────────────────────────────────────────────────────────────

const { EmbedBuilder, MessageFlags } = require("discord.js");

const AIConfig     = require("../Schemas/aiSchema.js");
const { RATE_LIMITS, TOGGLE_COMMANDS } = require("./aiChatbot/constants");
const { messageHistory, cooldowns, spamTracker, regenTracker } = require("./aiChatbot/state");
const { checkUserRateLimit, recordUserRequest, checkGuildRateLimit, recordGuildRequest } = require("./aiChatbot/rateLimiter");
const { enqueue, finishJob, queuePositionFor } = require("./aiChatbot/queue");
const { askGroq }         = require("./aiChatbot/groqClient");
const { getUserMode, setUserMode, buildSystemPrompt } = require("./aiChatbot/promptBuilder");
const { buildButtonRow, incStat, sendLog } = require("./aiChatbot/helpers");

// ── New Modules ──────────────────────────────────────────────────────────────
const { askVision, hasAnalysableAttachment } = require("./aiChatbot/visionClient");
const { getUserFacts, saveUserFacts, formatFactsForPrompt } = require("./aiChatbot/memoryManager");
const { extractFacts } = require("./aiChatbot/factExtractor");

const MAX_EMBED_DESC = 4000;

// ─────────────────────────────────────────────────────────────────────────────
module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (!message?.guild || message.author.bot) return;

        const rawContent   = message.content.trim();
        const isOurCommand = /^!(commands|swears|uwu|roast|ragebait|help)$/i.test(rawContent);
        if (!isOurCommand && /^[!?\/\$\.\-]/.test(rawContent)) return;

        const cfg = await AIConfig.findOne({ guildId: message.guild.id });
        if (!cfg || !cfg.channelId || cfg.systemEnabled === false) return;

        const guildId   = message.guild.id;
        const userId    = message.author.id;
        const channelId = cfg.channelId;
        const username  = message.author.username;
        const userPing  = `<@${userId}>`;
        const userMsg   = message.content;
        const lower     = userMsg.toLowerCase().trim();
        const now       = Date.now();

        // ── Handle clearContextFlag set by dashboard ──────────────────────
        if (cfg.clearContextFlag) {
            if (messageHistory.has(guildId)) messageHistory.get(guildId).clear();
            await AIConfig.findOneAndUpdate({ guildId }, { $set: { clearContextFlag: false } });
        }

        // ── !commands embed ───────────────────────────────────────────────
        if (lower === "!commands") {
            if (message.channel.id !== channelId) return;

            const fields = TOGGLE_COMMANDS
                .filter(t => cfg.modes?.[t.schemaKey] !== false)
                .map(t => ({
                    name:   `${t.emoji} ${t.name}`,
                    value:  `**Status:** ${getUserMode(t.modeKey, guildId, userId) ? "<a:tickyy:1567797045253644368> Enabled" : "<:restrict:1567797003638022166> Disabled"}\n**Command:** \`${t.cmd}\``,
                    inline: true,
                }));

            const embed = new EmbedBuilder()
                .setColor(cfg.embedColor ? parseInt(cfg.embedColor.replace("#", ""), 16) : 0x7289da)
                .setTitle(`${cfg.botName || "Ruby"} — Interaction Commands`)
                .setDescription("Toggle your conversation style. Modes are **per-user** and persist until toggled off.")
                .addFields(fields)
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: cfg.embedFooter || `Powered by Groq` });

            await message.reply({ embeds: [embed] });
            return;
        }

        // ── Mode toggle commands ──────────────────────────────────────────
        for (const t of TOGGLE_COMMANDS) {
            if (lower !== t.cmd) continue;
            if (message.channel.id !== channelId) return;

            if (cfg.modes?.[t.schemaKey] === false) {
                const m = await message.reply({ content: `<:crossy:1567796959648030831> **${t.name}** is disabled on this server.`, flags: [MessageFlags.SuppressEmbeds] });
                setTimeout(() => m.delete().catch(() => {}), 8000);
                return;
            }

            const current = getUserMode(t.modeKey, guildId, userId);
            setUserMode(t.modeKey, guildId, userId, !current);
            const m = await message.reply({ content: `${t.emoji} **${t.name}** is now **${!current ? "enabled" : "disabled"}** for you!`, flags: [MessageFlags.SuppressEmbeds] });
            setTimeout(() => m.delete().catch(() => {}), 12000);
            return;
        }

        // ── Only process messages in the AI channel ───────────────────────
        if (message.channel.id !== channelId) return;

        const isWhitelisted = cfg.whitelist?.includes(userId);
        const hasModRole    = cfg.modRole && message.member?.roles.cache.has(cfg.modRole);
        const isTrusted     = isWhitelisted || hasModRole;

        // ── Required role check ───────────────────────────────────────────
        if (cfg.requiredRole && !message.member?.roles.cache.has(cfg.requiredRole) && !isTrusted) {
            const m = await message.reply({ content: "<:crossy:1567796959648030831> You don't have the required role to use the AI here.", flags: [MessageFlags.SuppressEmbeds] });
            setTimeout(() => m.delete().catch(() => {}), 10000);
            return;
        }

        // ── Message length cap ────────────────────────────────────────────
        if (!isTrusted && userMsg.length > RATE_LIMITS.MAX_MESSAGE_LENGTH) {
            const m = await message.reply({
                content: `<:1430986239036625017:1567796926689185822> Your message is too long! Please keep it under **${RATE_LIMITS.MAX_MESSAGE_LENGTH} characters** (yours: ${userMsg.length}).`,
                flags: [MessageFlags.SuppressEmbeds],
            });
            setTimeout(() => m.delete().catch(() => {}), 15000);
            return;
        }

        // ── Spam detection ────────────────────────────────────────────────
        if (!isTrusted) {
            if (!spamTracker.has(guildId)) spamTracker.set(guildId, new Map());
            const guildSpam = spamTracker.get(guildId);
            if (!guildSpam.has(userId)) guildSpam.set(userId, []);
            const timestamps = guildSpam.get(userId);
            timestamps.push(now);

            const windowMs = (cfg.spamWindow ?? 10) * 1000;
            const maxInWin = cfg.spamMax ?? 5;
            while (timestamps.length && now - timestamps[0] > windowMs) timestamps.shift();

            if (timestamps.length > maxInWin) {
                if (cfg.autoBlacklist !== false && !cfg.blacklists?.includes(userId)) {
                    await AIConfig.findOneAndUpdate({ guildId }, { $addToSet: { blacklists: userId } });
                    incStat(guildId, "blacklisted");

                    if (cfg.logAutoBlacklist !== false) {
                        await sendLog(client, cfg, new EmbedBuilder()
                            .setColor(0xff5f72)
                            .setTitle("Auto-Blacklisted (Spam)")
                            .setDescription(`<@${userId}> was automatically blacklisted for exceeding the spam limit.`)
                            .addFields({ name: "User ID", value: userId, inline: true })
                            .setTimestamp());
                    }
                }
                const spamTxt = (cfg.spamMsg || "<:restrict:1567797003638022166> You have been automatically blacklisted for spamming.").replace("{userId}", userPing);
                const m = await message.reply({ content: spamTxt, flags: [MessageFlags.SuppressEmbeds] });
                setTimeout(() => m.delete().catch(() => {}), 20000);
                return;
            }
        }

        // ── Blacklist check ───────────────────────────────────────────────
        const freshCfg = await AIConfig.findOne({ guildId });
        if (freshCfg?.blacklists?.includes(userId) && !isTrusted) {
            const bText = (cfg.blacklistedMsg || "You cannot use AI here as you are blacklisted.").replace("{userId}", userPing);
            const m = await message.reply({ content: bText, flags: [MessageFlags.SuppressEmbeds] });
            setTimeout(() => m.delete().catch(() => {}), 20000);
            return;
        }

        // ── Cooldown check ────────────────────────────────────────────────
        const cooldownMs = Math.max(RATE_LIMITS.MIN_COOLDOWN_SEC, cfg.cooldownSec ?? 5) * 1000;
        if (!isTrusted && cooldownMs > 0) {
            if (!cooldowns.has(guildId)) cooldowns.set(guildId, new Map());
            const guildCooldown = cooldowns.get(guildId);
            const lastUsed  = guildCooldown.get(userId) ?? 0;
            const elapsed   = now - lastUsed;

            if (elapsed < cooldownMs) {
                const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
                const cdText = (cfg.cooldownMsg || "<:n_loading:1567796992556666982> Please wait {remaining}s before using AI again.")
                    .replace("{remaining}", remaining);
                const m = await message.reply({ content: cdText, flags: [MessageFlags.SuppressEmbeds] });
                setTimeout(() => m.delete().catch(() => {}), Math.min(remaining * 1000 + 1000, 30000));
                return;
            }
            guildCooldown.set(userId, now);
        }

        // ── Rolling rate-limit checks ─────────────────────────────────────
        if (!isTrusted) {
            const userLimitReason = checkUserRateLimit(userId);
            if (userLimitReason) {
                const m = await message.reply({ content: userLimitReason, flags: [MessageFlags.SuppressEmbeds] });
                setTimeout(() => m.delete().catch(() => {}), 20000);
                incStat(guildId, "rateLimited");
                return;
            }

            const guildLimitReason = checkGuildRateLimit(guildId);
            if (guildLimitReason) {
                const m = await message.reply({ content: guildLimitReason, flags: [MessageFlags.SuppressEmbeds] });
                setTimeout(() => m.delete().catch(() => {}), 20000);
                return;
            }
        }

        // ── Content filter ────────────────────────────────────────────────
        if (!isTrusted && cfg.filterEnabled !== false) {
            const allBadWords = [...(cfg.badWords || [])];
            if (allBadWords.some(w => lower.includes(w.toLowerCase()))) {
                const m = await message.reply({ content: "<:restrict:1567797003638022166> Your message contains blocked content and cannot be processed.", flags: [MessageFlags.SuppressEmbeds] });
                setTimeout(() => m.delete().catch(() => {}), 15000);

                if (cfg.logBlocks !== false) {
                    await sendLog(client, cfg, new EmbedBuilder()
                        .setColor(0xffb547)
                        .setTitle("Message Blocked (Filter)")
                        .setDescription(`A message from <@${userId}> was blocked by the content filter.`)
                        .addFields({ name: "Content (truncated)", value: userMsg.slice(0, 200) })
                        .setTimestamp());
                }
                incStat(guildId, "blocked");
                return;
            }
        }

        // ── Resolve active per-user modes ─────────────────────────────────
        const activeModes = {
            swearing: getUserMode("swearing", guildId, userId),
            uwu:      getUserMode("uwu",      guildId, userId),
            roasting: getUserMode("roasting", guildId, userId),
            ragebait: getUserMode("ragebait", guildId, userId),
            helpMode: getUserMode("helpMode", guildId, userId),
        };

        // ── Build conversation history ─────────────────────────────────────
        if (!messageHistory.has(guildId)) messageHistory.set(guildId, new Map());
        const guildChannels = messageHistory.get(guildId);
        if (!guildChannels.has(channelId)) guildChannels.set(channelId, []);
        const history = guildChannels.get(channelId);

        const maxCtx = cfg.contextSize ?? 20;
        if (history.length > maxCtx) history.splice(0, history.length - maxCtx);

        // ── Global Memory Retrieval ───────────────────────────────────────
        const userFacts   = await getUserFacts(userId);
        const memoryBlock = formatFactsForPrompt(userFacts);

        const systemPrompt = buildSystemPrompt(cfg, activeModes) + memoryBlock;
        const historyMsgs  = history.map(h => ({
            role:    h.role === "user" ? "user" : "assistant",
            content: h.role === "user" ? `${h.username} (${h.role === "user" ? userPing : ""}): ${h.content}` : h.content,
        }));
        const userMessage  = `${username} (${userPing}): ${userMsg}`;
        const fullPrompt   = { systemPrompt, historyMsgs, userMessage };

        const embedColor = cfg.embedColor
            ? parseInt(cfg.embedColor.replace("#", ""), 16)
            : 0x7289da;
        const footerText = cfg.embedFooter?.trim() || "Powered by Groq";

        // ── Enqueue job ───────────────────────────────────────────────────
        let jobResolve, jobReject;
        const jobPromise = new Promise((res, rej) => { jobResolve = res; jobReject = rej; });

        const enqueueResult = enqueue({
            guildId, userId, channelId,
            message, cfg, activeModes,
            fullPrompt, history, username,
            userPing, userMsg,
            embedColor, footerText,
            queuedAt: Date.now(),
            resolve: jobResolve,
            reject:  jobReject,
        });

        if (!enqueueResult.ok) {
            const m = await message.reply({ content: enqueueResult.reason, flags: [MessageFlags.SuppressEmbeds] });
            setTimeout(() => m.delete().catch(() => {}), 20000);
            return;
        }

        // Notify user if they are actually waiting in queue
        let queueNotice = null;
        if (enqueueResult.queuePos > RATE_LIMITS.MAX_CONCURRENT) {
            queueNotice = await message.reply({
                content: `<:1430986244921495654:1567796929587576852> You're at ${queuePositionFor(userId) ?? `position **${enqueueResult.queuePos}**`} — hang tight!`,
                flags: [MessageFlags.SuppressEmbeds],
            }).catch(() => null);
        }

        // ── Wait for our turn ─────────────────────────────────────────────
        let job;
        try {
            job = await jobPromise;
        } catch (queueErr) {
            if (queueNotice) queueNotice.delete().catch(() => {});
            if (queueErr.message === "QUEUE_EXPIRED") {
                const m = await message.reply({
                    content: "<:1430986244921495654:1567796929587576852> Your request sat in the queue too long and was dropped. Please try again.",
                    flags: [MessageFlags.SuppressEmbeds],
                }).catch(() => null);
                setTimeout(() => m?.delete().catch(() => {}), 15000);
            }
            return;
        }

        // Record usage now that we're actually running
        if (!isTrusted) {
            recordUserRequest(userId);
            recordGuildRequest(guildId);
        }

        if (queueNotice) queueNotice.delete().catch(() => {});

        // ── Generate response ─────────────────────────────────────────────
        try {
            await message.react("<a:28213ttsloading:1567797035782905866>").catch(() => {});
            await message.channel.sendTyping();

            const waitThresholdMs = (cfg.waitThreshold ?? 5) * 1000;
            let waitMsg = null;

            const waitTimer = setTimeout(async () => {
                waitMsg = await message.reply({
                    content: "<:n_loading:1567796992556666982> Still thinking, hang tight…",
                    flags: [MessageFlags.SuppressEmbeds],
                }).catch(() => null);
            }, waitThresholdMs);

            let aiReply;
            try {
                // ── Route to Vision or Text ───────────────────────────────
                if (hasAnalysableAttachment(message.attachments)) {
                    aiReply = await askVision(systemPrompt, historyMsgs, userMsg, message.attachments);
                } else {
                    aiReply = await askGroq(systemPrompt, historyMsgs, userMessage);
                }
            } finally {
                clearTimeout(waitTimer);
                finishJob();
            }

            await message.reactions.removeAll().catch(() => {});
            if (waitMsg) waitMsg.delete().catch(() => {});

            // Persist to in-memory history
            history.push({ role: "user",      username, content: userMsg  });
            history.push({ role: "assistant",            content: aiReply });
            incStat(guildId, "messages");

            const descText = aiReply.length > MAX_EMBED_DESC
                ? aiReply.slice(0, MAX_EMBED_DESC) + "…\n*(continued below)*"
                : aiReply;

            const aiEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setAuthor({ name: username, iconURL: message.author.displayAvatarURL() })
                .setDescription(descText)
                .setFooter({ text: footerText })
                .setTimestamp();

            const initRegens = 0;
            const buttonRow  = buildButtonRow(cfg, initRegens);
            const sendOpts   = { embeds: [aiEmbed] };
            if (buttonRow) sendOpts.components = [buttonRow];

            const replyMsg = await message.reply(sendOpts);
            regenTracker.set(replyMsg.id, initRegens);

            if (aiReply.length > MAX_EMBED_DESC) {
                const chunks = aiReply.slice(MAX_EMBED_DESC).match(/[\s\S]{1,2000}/g) || [];
                for (const chunk of chunks) {
                    await message.channel.send({ content: chunk, flags: [MessageFlags.SuppressEmbeds] });
                }
            }

            // ── Background Fact Extraction (Silent) ──────────────────────
            (async () => {
                const newFacts = await extractFacts(username, userMsg, aiReply);
                if (newFacts.length > 0) {
                    await saveUserFacts(userId, newFacts);
                }
            })().catch(() => {});

            // ── Button collector ──────────────────────────────────────────
            if (!buttonRow) return;

            const filter    = i => ["ai_regenerate", "ai_clear_context"].includes(i.customId) && i.user.id === userId;
            const collector = replyMsg.createMessageComponentCollector({ filter, time: 600_000 });

            collector.on("collect", async (interaction) => {
                const regenCount = regenTracker.get(replyMsg.id) ?? 0;
                const maxRegens  = cfg.maxRegens ?? 3;

                // ── Regenerate ────────────────────────────────────────────
                if (interaction.customId === "ai_regenerate") {
                    if (regenCount >= maxRegens) {
                        await interaction.reply({ content: `<:crossy:1567796959648030831> Maximum regenerations (${maxRegens}) reached for this response.`, ephemeral: true });
                        return;
                    }

                    const nextCount = regenCount + 1;
                    await interaction.deferUpdate();
                    await replyMsg.edit({
                        embeds:     [new EmbedBuilder().setColor(0xffbf00).setTitle("Regenerating…").setDescription("Please wait for a new response…")],
                        components: [buildButtonRow(cfg, nextCount, { loading: true })],
                    }).catch(() => {});

                    try {
                        const newReply = await askGroq(fullPrompt.systemPrompt, fullPrompt.historyMsgs, fullPrompt.userMessage);

                        regenTracker.set(replyMsg.id, nextCount);
                        for (let i = history.length - 1; i >= 0; i--) {
                            if (history[i].role === "assistant") { history[i].content = newReply; break; }
                        }
                        incStat(guildId, "regens");

                        const reDescText = newReply.length > MAX_EMBED_DESC
                            ? newReply.slice(0, MAX_EMBED_DESC) + "…\n*(continued below)*"
                            : newReply;

                        const reEmbed = new EmbedBuilder()
                            .setColor(embedColor)
                            .setAuthor({ name: username, iconURL: message.author.displayAvatarURL() })
                            .setDescription(reDescText)
                            .setFooter({ text: `${footerText} | Regeneration #${nextCount}` })
                            .setTimestamp();

                        await replyMsg.edit({
                            embeds:     [reEmbed],
                            components: [buildButtonRow(cfg, nextCount)],
                        }).catch(() => {});

                        if (newReply.length > MAX_EMBED_DESC) {
                            const chunks = newReply.slice(MAX_EMBED_DESC).match(/[\s\S]{1,2000}/g) || [];
                            for (const chunk of chunks) {
                                await message.channel.send({ content: chunk, flags: [MessageFlags.SuppressEmbeds] });
                            }
                        }
                    } catch (reErr) {
                        console.error("[AI] Regen failed:", reErr.message);
                        await replyMsg.edit({
                            content:    "<:error:1567796968758050868> Regeneration failed.",
                            components: [buildButtonRow(cfg, regenCount)],
                        }).catch(() => {});
                    }
                }

                // ── Clear context ─────────────────────────────────────────
                if (interaction.customId === "ai_clear_context") {
                    await interaction.deferReply({ ephemeral: true });
                    guildChannels.set(channelId, []);
                    regenTracker.delete(replyMsg.id);

                    await replyMsg.edit({ components: [buildButtonRow(cfg, 0, { cleared: true })] }).catch(() => {});
                    await interaction.editReply({ content: "<a:tickyy:1567797045253644368> **Context cleared!** Ruby will start fresh with your next message." });
                    collector.stop("cleared");
                }
            });

            collector.on("end", async (_, reason) => {
                if (reason === "cleared") return;
                const finalCount = regenTracker.get(replyMsg.id) ?? 0;
                await replyMsg.edit({ components: [buildButtonRow(cfg, finalCount, { expired: true })] }).catch(() => {});
                regenTracker.delete(replyMsg.id);
            });

        } catch (err) {
            if (err.message !== "QUEUE_EXPIRED") finishJob();

            console.error("[AI] Request failed:", err.message);
            await message.reactions.removeAll().catch(() => {});

            const errDetail = err?.message ? err.message.slice(0, 200) : String(err).slice(0, 200);
            await message.reply({ content: `<:error:1567796968758050868> **AI Error:** ${errDetail}`, flags: [MessageFlags.SuppressEmbeds] }).catch(() => {});

            if (cfg.logErrors !== false) {
                await sendLog(client, cfg, new EmbedBuilder()
                    .setColor(0xff5f72)
                    .setTitle("Groq API Error")
                    .setDescription(`\`\`\`${errDetail}\`\`\``)
                    .addFields({ name: "User", value: `<@${userId}>`, inline: true })
                    .setTimestamp());
            }
        }
    });
};