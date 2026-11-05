const { Events, EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const antinukeSchema = require("../Schemas/antinukeSchema.js");
const cache = require('../src/lib/cache');

module.exports = (client) => {
    // --- Rate-limit tracking: Map<guildId_userId_eventType, {count, firstTimestamp}> ---
    const rateMap = new Map();

    // --- HELPER: Check if user is whitelisted (by ID or role) ---
    async function isWhitelisted(guild, userId, whitelist, trustedRoles) {
        if (whitelist.includes(userId)) return true;
        if (!trustedRoles || trustedRoles.length === 0) return false;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;
        return member.roles.cache.some(r => trustedRoles.includes(r.id));
    }

    // --- HELPER: Resolve effective action for an event ---
    function resolveAction(globalAction, eventAction) {
        return (!eventAction || eventAction === 'inherit') ? globalAction : eventAction;
    }

    // --- HELPER: Check rate threshold; returns true if threshold exceeded ---
    function checkThreshold(key, threshold, windowSeconds) {
        if (!threshold || threshold <= 1) return true; // instant trigger
        const now = Date.now();
        const windowMs = windowSeconds * 1000;
        const existing = rateMap.get(key);

        if (!existing || now - existing.firstTimestamp > windowMs) {
            rateMap.set(key, { count: 1, firstTimestamp: now });
            return false;
        }

        existing.count++;
        if (existing.count >= threshold) {
            rateMap.delete(key);
            return true;
        }
        return false;
    }

    // --- HELPER: Handle Punishment and Notification ---
    async function handlePunishment(guild, entry, executor, eventKey, type, details) {
        const eventSetting = entry.events?.[eventKey] || {};
        if (eventSetting.enabled === false) return; // Event disabled

        const effectiveAction = resolveAction(entry.action || 'log', eventSetting.action);
        const threshold = eventSetting.threshold || 0;
        const thresholdWindow = eventSetting.thresholdWindow || 10;

        // Rate limit check
        const rateKey = `${guild.id}_${executor.id}_${eventKey}`;
        if (threshold > 1 && !checkThreshold(rateKey, threshold, thresholdWindow)) return;

        const executorMember = await guild.members.fetch(executor.id).catch(() => null);
        let actionTaken = "Logged Alert";

        if (executorMember && effectiveAction !== 'log') {
            try {
                if (effectiveAction === 'ban') {
                    await guild.members.ban(executor.id, { reason: `Anti-Nuke: ${type}` });
                    actionTaken = "User Banned";
                } else if (effectiveAction === 'kick') {
                    await executorMember.kick(`Anti-Nuke: ${type}`);
                    actionTaken = "User Kicked";
                } else if (effectiveAction === 'stripRoles') {
                    const manageable = executorMember.roles.cache.filter(r => r.id !== guild.id && r.editable);
                    await executorMember.roles.remove(manageable, `Anti-Nuke: ${type}`).catch(() => null);
                    actionTaken = "Roles Stripped";
                } else if (effectiveAction === 'timeout') {
                    const timeoutEnd = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // 28 days max
                    await executorMember.timeout(28 * 24 * 60 * 60 * 1000, `Anti-Nuke: ${type}`).catch(() => null);
                    actionTaken = "User Timed Out (28d)";
                }
            } catch (err) {
                console.error(`[AntiNuke] Failed to punish ${executor.tag}:`, err);
                actionTaken = "Punishment Failed (Hierarchy/Perms)";
            }
        }

        // Log to punishment history
        try {
            await antinukeSchema.findOneAndUpdate(
                { guildId: guild.id },
                {
                    $push: {
                        punishmentLog: {
                            $each: [{ executorId: executor.id, executorTag: executor.tag, type, details, actionTaken, timestamp: new Date() }],
                            $slice: -50 // Keep last 50
                        }
                    }
                }
            );
        } catch (e) { /* non-critical */ }

        // Build embed
        const embed = new EmbedBuilder()
            .setTitle(`Anti-Nuke Triggered: ${type}`)
            .setColor(effectiveAction === 'log' ? '#ffcc00' : '#ff3333')
            .addFields(
                { name: '<:user:1567797032423264261> Executor', value: `${executor.tag}\n\`${executor.id}\``, inline: true },
                { name: '<:thunderr:1567797012991189134> Action Taken', value: `**${actionTaken}**`, inline: true },
                { name: '<:files:1567796970964394044> Details', value: details },
            )
            .setThumbnail(executor.displayAvatarURL?.() || null)
            .setTimestamp();

        // Send to log channel
        if (entry.logChannelId) {
            const logChannel = guild.channels.cache.get(entry.logChannelId);
            if (logChannel) {
                // alertPing stores a role ID — use <@&id> for role mention, not <@id> (user mention)
                const pingContent = entry.alertPing ? `<@&${entry.alertPing}> ` : '';
                try {
                    await logChannel.send({ content: pingContent || undefined, embeds: [embed] });
                } catch (e) {
                    console.error(`[AntiNuke] Log channel send failed:`, e);
                }
            }
        }

        // DM owner if enabled
        if (entry.dmOwner) {
            try {
                const owner = await guild.fetchOwner();
                await owner.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`Anti-Nuke Alert — ${guild.name}`)
                            .setDescription(`**${type}** was triggered by ${executor.tag}.\n\n**Details:** ${details}\n**Action:** ${actionTaken}`)
                            .setColor('#ff3333')
                            .setTimestamp()
                    ]
                });
            } catch (e) { /* DMs may be closed */ }
        }
    }

    // --- HELPER: Get entry and check whitelist ---
    async function getEntryIfActive(guild, executorId) {
        if (executorId === client.user.id || executorId === guild.ownerId) return null;
        const CustomBranding = require('../Schemas/customBrandingSchema');
        const cbDoc = await CustomBranding.findOne({ guildId: guild.id, enabled: true })
            .select('botClientId setupState').lean();
        if (cbDoc?.setupState === 'active' && cbDoc.botClientId && executorId === cbDoc.botClientId) return null;
        const entry = await cache.wrap('antinuke', `config:${guild.id}`,
            () => antinukeSchema.findOne({ guildId: guild.id }).lean(), 30);
        if (!entry?.enabled) return null;
        const whitelisted = await isWhitelisted(guild, executorId, entry.whitelist || [], entry.trustedRoles || []);
        return whitelisted ? null : entry;
    }

    async function isCBBot(guildId, botId) {
        const CustomBranding = require('../Schemas/customBrandingSchema');
        const cbDoc = await CustomBranding.findOne({ guildId, enabled: true })
            .select('botClientId setupState').lean();
        return cbDoc?.setupState === 'active' && cbDoc.botClientId === botId;
    }

    // --- HELPER: Fetch audit log safely ---
    async function getAuditLog(guild, type, maxAgeMs = 3000) {
        try {
            const logs = await guild.fetchAuditLogs({ type, limit: 1 });
            const log = logs.entries.first();
            if (!log || Date.now() - log.createdTimestamp > maxAgeMs) return null;
            return log;
        } catch { return null; }
    }

    // ==================== EVENTS ====================

    // --- Anti-Kick ---
    client.on(Events.GuildMemberRemove, async (member) => {
        const guild = member.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.MemberKick);
            if (!log || log.target?.id !== member.id) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'memberKick', 'Member Kicked', `Kicked ${member.user.tag} (\`${member.user.id}\`)`);
        } catch (e) { console.error('[AntiNuke] MemberKick:', e); }
    });

    // --- Anti-Ban ---
    client.on(Events.GuildBanAdd, async (ban) => {
        const guild = ban.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.MemberBan);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'memberBan', 'Member Banned', `Banned ${ban.user.tag} (\`${ban.user.id}\`)`);
        } catch (e) { console.error('[AntiNuke] MemberBan:', e); }
    });

    // --- Anti-Unban ---
    client.on(Events.GuildBanRemove, async (ban) => {
        const guild = ban.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.MemberBanRemove);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'banRemove', 'Ban Removed', `Unbanned ${ban.user.tag} (\`${ban.user.id}\`)`);
        } catch (e) { console.error('[AntiNuke] BanRemove:', e); }
    });

    // --- Anti-Role Create ---
    client.on(Events.GuildRoleCreate, async (role) => {
        const guild = role.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.RoleCreate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                await role.delete('Anti-Nuke: Unauthorized role creation').catch(() => null);
                await handlePunishment(guild, entry, log.executor, 'roleCreate', 'Role Created', `Created role: **${role.name}**`);
            }
        } catch (e) { console.error('[AntiNuke] RoleCreate:', e); }
    });

    // --- Anti-Role Delete ---
    client.on(Events.GuildRoleDelete, async (role) => {
        const guild = role.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.RoleDelete);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'roleDelete', 'Role Deleted', `Deleted role: **${role.name}**`);
        } catch (e) { console.error('[AntiNuke] RoleDelete:', e); }
    });

    // --- Anti-Role Update (dangerous perm grants) ---
    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
        const guild = newRole.guild;
        try {
            // Only trigger if dangerous permissions were added
            const dangerousPerms = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.ManageGuild,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.ManageWebhooks,
            ];
            const addedPerms = dangerousPerms.filter(p => !oldRole.permissions.has(p) && newRole.permissions.has(p));
            if (addedPerms.length === 0) return;

            const log = await getAuditLog(guild, AuditLogEvent.RoleUpdate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                // Revert dangerous permissions
                await newRole.setPermissions(oldRole.permissions, 'Anti-Nuke: Reverting dangerous perm grant').catch(() => null);
                const permNames = newRole.permissions.toArray().filter((_, i) => addedPerms[i]);
                await handlePunishment(guild, entry, log.executor, 'roleUpdate', 'Role Permissions Updated', `Added dangerous perms to **${oldRole.name}**: ${addedPerms.length} permission(s)`);
            }
        } catch (e) { console.error('[AntiNuke] RoleUpdate:', e); }
    });

    // --- Anti-Channel Create ---
    client.on(Events.ChannelCreate, async (channel) => {
        if (!channel.guild) return;
        const guild = channel.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.ChannelCreate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                await channel.delete('Anti-Nuke: Unauthorized channel creation').catch(() => null);
                await handlePunishment(guild, entry, log.executor, 'channelCreate', 'Channel Created', `Created channel: **#${channel.name}**`);
            }
        } catch (e) { console.error('[AntiNuke] ChannelCreate:', e); }
    });

    // --- Anti-Channel Delete ---
    client.on(Events.ChannelDelete, async (channel) => {
        if (!channel.guild) return;
        const guild = channel.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.ChannelDelete);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'channelDelete', 'Channel Deleted', `Deleted channel: **#${channel.name}**`);
        } catch (e) { console.error('[AntiNuke] ChannelDelete:', e); }
    });

    // --- Anti-Channel Update ---
    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
        if (!newChannel.guild) return;
        const guild = newChannel.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.ChannelUpdate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'channelUpdate', 'Channel Updated', `Updated channel: **#${newChannel.name}**`);
        } catch (e) { console.error('[AntiNuke] ChannelUpdate:', e); }
    });

    // --- Anti-Webhook Create ---
    client.on(Events.WebhookUpdate, async (channel) => {
        const guild = channel.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.WebhookCreate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                // Delete the created webhook
                const webhooks = await channel.fetchWebhooks().catch(() => null);
                if (webhooks) {
                    const recent = webhooks.filter(w => Date.now() - w.createdTimestamp < 5000);
                    for (const [, wh] of recent) await wh.delete('Anti-Nuke: Unauthorized webhook').catch(() => null);
                }
                await handlePunishment(guild, entry, log.executor, 'webhookCreate', 'Webhook Created', `Created webhook in **#${channel.name}**`);
            }
        } catch (e) { console.error('[AntiNuke] WebhookCreate:', e); }
    });

    // --- Anti-Bot Add ---
    client.on(Events.GuildMemberAdd, async (member) => {
        if (!member.user.bot) return;
        const guild = member.guild;
        try {
            if (await isCBBot(guild.id, member.user.id)) return;
            const log = await getAuditLog(guild, AuditLogEvent.BotAdd);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                await member.kick('Anti-Nuke: Unauthorized bot addition').catch(() => null);
                await handlePunishment(guild, entry, log.executor, 'botAdd', 'Bot Added', `Added bot: **${member.user.tag}** (\`${member.user.id}\`)`);
            }
        } catch (e) { console.error('[AntiNuke] BotAdd:', e); }
    });

    // --- Anti-Emoji Create ---
    client.on(Events.GuildEmojiCreate, async (emoji) => {
        const guild = emoji.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.EmojiCreate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                await emoji.delete('Anti-Nuke: Unauthorized emoji creation').catch(() => null);
                await handlePunishment(guild, entry, log.executor, 'emojiCreate', 'Emoji Created', `Created emoji: **:${emoji.name}:**`);
            }
        } catch (e) { console.error('[AntiNuke] EmojiCreate:', e); }
    });

    // --- Anti-Emoji Delete ---
    client.on(Events.GuildEmojiDelete, async (emoji) => {
        const guild = emoji.guild;
        try {
            const log = await getAuditLog(guild, AuditLogEvent.EmojiDelete);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'emojiDelete', 'Emoji Deleted', `Deleted emoji: **:${emoji.name}:**`);
        } catch (e) { console.error('[AntiNuke] EmojiDelete:', e); }
    });

    // --- Anti-Guild Update ---
    client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
        try {
            const log = await getAuditLog(newGuild, AuditLogEvent.GuildUpdate);
            if (!log) return;
            const entry = await getEntryIfActive(newGuild, log.executor.id);
            if (entry) await handlePunishment(newGuild, entry, log.executor, 'guildUpdate', 'Server Updated', `Changed server settings`);
        } catch (e) { console.error('[AntiNuke] GuildUpdate:', e); }
    });

    // --- Anti-Member Role Update (admin/dangerous role grants) ---
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const guild = newMember.guild;
        try {
            const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            const dangerousAdded = addedRoles.filter(r =>
                r.permissions.has(PermissionFlagsBits.Administrator) ||
                r.permissions.has(PermissionFlagsBits.ManageGuild) ||
                r.permissions.has(PermissionFlagsBits.ManageRoles)
            );
            if (dangerousAdded.size === 0) return;

            const log = await getAuditLog(guild, AuditLogEvent.MemberRoleUpdate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) {
                await newMember.roles.remove(dangerousAdded, 'Anti-Nuke: Unauthorized dangerous role grant').catch(() => null);
                await handlePunishment(guild, entry, log.executor, 'memberRoleUpdate', 'Dangerous Role Granted',
                    `Gave **${newMember.user.tag}** dangerous role(s): ${dangerousAdded.map(r => r.name).join(', ')}`);
            }
        } catch (e) { console.error('[AntiNuke] MemberRoleUpdate:', e); }
    });

    // --- Anti-Integration Create ---
    client.on(Events.GuildIntegrationsUpdate, async (guild) => {
        try {
            const log = await getAuditLog(guild, AuditLogEvent.IntegrationCreate);
            if (!log) return;
            const entry = await getEntryIfActive(guild, log.executor.id);
            if (entry) await handlePunishment(guild, entry, log.executor, 'integrationCreate', 'Integration Added', `Added integration: **${log.target?.name || 'Unknown'}**`);
        } catch (e) { console.error('[AntiNuke] IntegrationCreate:', e); }
    });
};