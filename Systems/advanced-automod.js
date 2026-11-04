"use strict";
/**
 * Systems/advanced-automod.js
 *
 * Sapphire-style AutoMod system for Roco.
 *
 * Detections (in order of evaluation):
 *   1. Global exemptions      — ignored roles / channels
 *   2. Image-only channels    — non-image messages deleted silently
 *   3. Mass mention           — @everyone / @here
 *   4. Invite links           — discord.gg + extra domains, with own-guild allow
 *   5. Link groups            — per-group domain blacklist / whitelist
 *   6. Zalgo text             — diacritic ratio > threshold
 *   7. Repeated character     — e.g. "aaaaaaaaaa"
 *   8. Sticker spam           — stickers per message
 *   9. Spoiler abuse          — ||spoiler|| count
 *  10. Word groups            — Sapphire-style named word lists (wildcard or exact)
 *  11. Legacy banned words    — single flat list (backwards compat)
 *  12. Regex rules            — custom pattern matching
 *  13. Rate-limit rules       — messages, mentions, links, caps, duplicates,
 *                               attachments, emojis, newlines
 *
 * Every triggered check:
 *   - deletes the message (if deletable)
 *   - increments the in-memory warn counter
 *   - applies the per-rule action (warn DM / mute / kick / ban)
 *   - checks the warn-escalation ladder
 *   - logs to the configured log channel
 */

const AutoMod = require("../Schemas/AutoModSchema.js");
const cache  = require('../src/lib/cache');
const { EmbedBuilder } = require("discord.js");

// ─── Per-guild, per-user in-memory buckets ────────────────────────────────────
// rateBuckets: guildId → userId → { [ruleType]: timestamp[] }
// warnCounts:  guildId → userId → number
const rateBuckets = new Map();
const warnCounts  = new Map();

// Invite-code cache: guildId → Set<code>  (populated lazily on first use)
const guildInviteCache = new Map();

module.exports = (client) => {

  // ── Populate invite cache when bot joins / on ready ──────────────────────
  client.on("clientReady", async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        try {
          const invites = await guild.invites.fetch();
          guildInviteCache.set(guild.id, new Set(invites.map(i => i.code)));
        } catch { /* missing permission — skip */ }
      }
    } catch { /* non-fatal */ }
  });

  client.on("inviteCreate", invite => {
    if (!guildInviteCache.has(invite.guild?.id)) return;
    guildInviteCache.get(invite.guild.id).add(invite.code);
  });

  client.on("inviteDelete", invite => {
    guildInviteCache.get(invite.guild?.id)?.delete(invite.code);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Main message handler
  // ─────────────────────────────────────────────────────────────────────────
  client.on("messageCreate", async (message) => {
    if (!message.guild || !message.channel) return;

    const { guild, author, content, mentions } = message;
    const guildId = guild.id;
    const userId  = author.id;

    try {
      // ── Load config ────────────────────────────────────────────────────────
      const cfg = await cache.wrap('automod', `config:${guildId}`,
        () => AutoMod.findOne({ guildId }).lean(), 30);
      if (!cfg || !cfg.status) return;
      if (author.id === client.user.id) return;
      if (message.webhookId) return;

      // Skip CB (custom-branded) bots
      if (author.bot) {
        if (!cfg.detectBotSpam) return;
        try {
          const CustomBranding = require("../Schemas/customBrandingSchema");
          const cbDoc = await CustomBranding.findOne({ guildId, enabled: true })
            .select("botClientId setupState").lean();
          if (cbDoc?.setupState === "active" && cbDoc.botClientId === author.id) return;
        } catch { /* non-fatal */ }
      }

      // ── Ensure bucket maps ─────────────────────────────────────────────────
      if (!rateBuckets.has(guildId)) rateBuckets.set(guildId, new Map());
      if (!warnCounts.has(guildId))  warnCounts.set(guildId,  new Map());
      const guildBuckets = rateBuckets.get(guildId);
      const guildWarns   = warnCounts.get(guildId);
      if (!guildBuckets.has(userId)) guildBuckets.set(userId, {});
      const buckets = guildBuckets.get(userId);
      const now = Date.now();

      // ── 1. Global exemptions ───────────────────────────────────────────────
      if (cfg.ignoredChannelIds?.includes(message.channel.id)) return;
      if (cfg.ignoredChannelIds?.includes(message.channel.parentId)) return; // category

      if (cfg.ignoredRoleIds?.length) {
        const member = message.member ?? await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const memberRoles = member.roles.cache.map(r => r.id);
          if (memberRoles.some(r => cfg.ignoredRoleIds.includes(r))) return;
        }
      }

      // Admins / ManageGuild always bypass
      if (message.member?.permissions?.has("ManageGuild")) return;

      // ── Pre-compute message stats ──────────────────────────────────────────
      const stripped     = content.replace(/\s+/g, "");
      const capsCount    = (stripped.match(/[A-Z]/g) || []).length;
      const capsPercent  = stripped.length ? (capsCount / stripped.length) * 100 : 0;
      const linkMatches  = content.match(/https?:\/\/\S+/gi) || [];
      const mentionCount = mentions.users.size + mentions.roles.size;
      const emojiCount   = (content.match(/<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}]/gu) || []).length;
      const attachCount  = message.attachments.size;
      const newlineCount = (content.match(/\n/g) || []).length;
      const stickerCount = message.stickers?.size ?? 0;
      const spoilerCount = (content.match(/\|\|[\s\S]*?\|\|/g) || []).length;
      const normContent  = content.trim().toLowerCase().replace(/\s+/g, " ");
      const isDuplicate  = buckets.__lastContent === normContent;
      buckets.__lastContent = normContent;

      // Sliding-window helper
      function checkRate(type, windowSecs, increment = 1) {
        const windowMs = windowSecs * 1000;
        if (!buckets[type]) buckets[type] = [];
        if (windowMs > 0) buckets[type] = buckets[type].filter(t => now - t < windowMs);
        for (let i = 0; i < increment; i++) buckets[type].push(now);
        return buckets[type].length;
      }

      // ── Helper: fire on a detected violation ──────────────────────────────
      /**
       * @param {string} action   - e.g. "delete", "warn", "mute", "kick", "ban"
       * @param {string} reason   - human label, e.g. "Spam (5 msg/5s)"
       * @param {number} muteMins - mute duration in minutes
       */
      async function fireViolation(action, reason, muteMins = 10) {
        await safeDelete(message);
        const warnCount = incrementWarns(guildWarns, userId);
        await applyPunishment(message, action, author.bot, muteMins, reason, warnCount, cfg);
        await escalateWarns(message, cfg, guildWarns, userId, warnCount);
        await logViolation(message, reason, action, warnCount, cfg);
        console.log(`[AutoMod] ${reason} — ${author.tag} in ${guild.name}`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 2. Image-only channels
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.imageOnlyChannels?.length) {
        const rule = cfg.imageOnlyChannels.find(r => r.channelId === message.channel.id);
        if (rule) {
          const hasImage = attachCount > 0 ||
            (rule.allowImageLinks && /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(content));
          if (!hasImage) {
            await safeDelete(message);
            return; // silent delete — no warn count for image-only
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 3. Mass mention (@everyone / @here)
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.filterMassMention && mentions.everyone) {
        return fireViolation(
          cfg.massMentionAction,
          "Mass mention (@everyone / @here)",
          cfg.massMentionMuteDuration,
        );
      }

      // ─────────────────────────────────────────────────────────────────────
      // 4. Invite links
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.filterInvites) {
        const baseDomains = ["discord\\.gg", "discord(?:app)?\\.com\\/invite", "discord\\.com\\/invite"];
        const extraDomains = (cfg.extraInviteDomains || []).map(d => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const allDomains   = [...baseDomains, ...extraDomains];
        const inviteRx     = new RegExp(`(?:${allDomains.join("|")})\\/([A-Za-z0-9-]+)`, "gi");

        const inviteMatches = [...content.matchAll(inviteRx)];
        if (inviteMatches.length > 0) {
          let blocked = true;
          if (cfg.allowOwnInvites) {
            const ownCodes = guildInviteCache.get(guildId) ?? new Set();
            const codes    = inviteMatches.map(m => m[1]);
            if (codes.length > 0 && codes.every(c => ownCodes.has(c))) blocked = false;
          }
          if (blocked) {
            return fireViolation(
              cfg.inviteAction,
              "Discord invite link",
              cfg.inviteMuteDuration,
            );
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 5. Link Groups
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.linkGroups?.length && linkMatches.length > 0) {
        for (const group of cfg.linkGroups) {
          if (!group.domains?.length) continue;
          let triggered = false;

          for (const url of linkMatches) {
            let hostname = "";
            try { hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }

            const inGroup = group.domains.some(d => hostname === d.toLowerCase() || hostname.endsWith("." + d.toLowerCase()));

            if (group.mode === "blacklist" && inGroup)  { triggered = true; break; }
            if (group.mode === "whitelist" && !inGroup) { triggered = true; break; }
          }

          if (triggered) {
            return fireViolation(
              group.action,
              `Link blocked (group: ${group.name})`,
              group.muteDuration,
            );
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 6. Zalgo text
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.filterZalgo && content.length > 4) {
        const zalgoRx   = /[\u0300-\u036f\u0489\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;
        const zalgoHits = (content.match(zalgoRx) || []).length;
        const threshold = typeof cfg.zalgoThreshold === "number" ? cfg.zalgoThreshold : 0.20;
        if (zalgoHits / content.length > threshold) {
          return fireViolation(cfg.zalgoAction, "Zalgo text", cfg.zalgoMuteDuration);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 7. Repeated character spam
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.filterRepeatChar) {
        const limit    = Math.max(2, cfg.repeatCharLimit || 10);
        const repeatRx = new RegExp(`(.)\\1{${limit - 1},}`);
        if (repeatRx.test(content)) {
          return fireViolation(cfg.repeatCharAction, `Repeated characters (${limit}+)`, cfg.repeatCharMuteDuration);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 8. Sticker spam
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.filterStickers && stickerCount >= (cfg.stickerLimit || 1)) {
        return fireViolation(cfg.stickerAction, "Sticker spam", cfg.stickerMuteDuration);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 9. Spoiler abuse
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.filterSpoilers && spoilerCount >= (cfg.spoilerLimit || 5)) {
        return fireViolation(cfg.spoilerAction, `Spoiler spam (${spoilerCount})`, cfg.spoilerMuteDuration);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 10. Word Groups (Sapphire-style named groups)
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.wordGroups?.length) {
        const lc = content.toLowerCase();
        for (const group of cfg.wordGroups) {
          if (!group.words?.length) continue;
          const hit = group.words.some(word => {
            const w = word.toLowerCase();
            if (group.matchMode === "exact") {
              const rx = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
              return rx.test(content);
            }
            return lc.includes(w); // wildcard / substring
          });
          if (hit) {
            return fireViolation(
              group.action,
              `Banned word (group: ${group.name})`,
              group.muteDuration,
            );
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 11. Legacy banned words (flat list, backwards compat)
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.bannedWords?.length) {
        const lc  = content.toLowerCase();
        const hit = cfg.bannedWords.some(word => {
          if (cfg.wordWildcard) return lc.includes(word.toLowerCase());
          const rx = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          return rx.test(content);
        });
        if (hit) {
          return fireViolation(cfg.wordFilterAction, "Banned word", cfg.wordMuteDuration || 10);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 12. Regex rules
      // ─────────────────────────────────────────────────────────────────────
      if (cfg.regexRules?.length) {
        for (const rule of cfg.regexRules) {
          try {
            const rx = new RegExp(rule.pattern, rule.flags || "i");
            if (rx.test(content)) {
              return fireViolation(
                rule.action,
                rule.description ? `Regex: ${rule.description}` : "Regex rule",
                rule.muteDuration || 10,
              );
            }
          } catch { /* invalid regex — skip */ }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 13. Rate-limit rules
      // ─────────────────────────────────────────────────────────────────────
      for (const rule of cfg.rateRules) {
        let count = 0;

        switch (rule.type) {
          case "messages":
            count = checkRate("messages", rule.window, 1);
            break;
          case "mentions":
            if (mentionCount === 0) continue;
            count = checkRate("mentions", rule.window, mentionCount);
            break;
          case "links":
            if (linkMatches.length === 0) continue;
            count = checkRate("links", rule.window, linkMatches.length);
            break;
          case "caps":
            // window=0 → per-message percentage threshold
            if (stripped.length < 8) continue;
            if (capsPercent >= rule.limit) {
              return fireViolation(rule.action, `Caps spam (${Math.round(capsPercent)}%)`, rule.muteDuration || 10);
            }
            continue;
          case "duplicates":
            if (!isDuplicate) continue;
            count = checkRate("duplicates", rule.window, 1);
            break;
          case "attachments":
            if (attachCount === 0) continue;
            count = checkRate("attachments", rule.window, attachCount);
            break;
          case "emojis":
            if (emojiCount === 0) continue;
            // window=0 → per-message limit
            if (rule.window === 0) {
              if (emojiCount >= rule.limit) {
                return fireViolation(rule.action, `Emoji spam (${emojiCount})`, rule.muteDuration || 10);
              }
              continue;
            }
            count = checkRate("emojis", rule.window, emojiCount);
            break;
          case "newlines":
            if (newlineCount === 0) continue;
            if (rule.window === 0) {
              if (newlineCount >= rule.limit) {
                return fireViolation(rule.action, `Newline spam (${newlineCount})`, rule.muteDuration || 10);
              }
              continue;
            }
            count = checkRate("newlines", rule.window, newlineCount);
            break;
          default:
            continue;
        }

        if (count > rule.limit) {
          // Reset bucket so punishment fires once per violation, not every message
          buckets[rule.type] = [];
          return fireViolation(
            rule.action,
            ruleLabel(rule.type, rule.limit, rule.window),
            rule.muteDuration || 10,
          );
        }
      }

    } catch (err) {
      console.error("[AutoMod] Error processing message:", err);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  function ruleLabel(type, limit, window) {
    const labels = {
      messages:   `Spam (${limit} msg/${window}s)`,
      mentions:   `Mention spam (${limit}/${window}s)`,
      links:      `Link spam (${limit}/${window}s)`,
      attachments:`Attachment spam (${limit}/${window}s)`,
      duplicates: `Duplicate messages (${limit}/${window}s)`,
    };
    return labels[type] || type;
  }

  function incrementWarns(guildWarns, userId) {
    const current = (guildWarns.get(userId) || 0) + 1;
    guildWarns.set(userId, current);
    return current;
  }

  function resolveWarnStep(cfg, warnCount) {
    if (!cfg.warnSteps?.length) return null;
    const sorted = [...cfg.warnSteps].sort((a, b) => b.count - a.count);
    return sorted.find(s => warnCount >= s.count) || null;
  }

  async function escalateWarns(message, cfg, guildWarns, userId, warnCount) {
    const step = resolveWarnStep(cfg, warnCount);
    if (!step) return;
    await applyPunishment(
      message,
      step.action,
      message.author.bot,
      step.muteDuration || 10,
      `Warn ladder (${warnCount} warns)`,
      warnCount,
      cfg,
      true,
    );
  }

  async function safeDelete(message) {
    try { if (message.deletable) await message.delete(); } catch { /* already gone */ }
  }

  /**
   * Core punishment dispatcher.
   */
  async function applyPunishment(message, action, isBot, muteMins, reason, warnCount, cfg, fromLadder = false) {
    const { author, guild } = message;
    const member = message.member ?? await guild.members.fetch(author.id).catch(() => null);
    if (!member) return;
    if (member.permissions?.has("ManageGuild")) return;

    const guildName    = guild.name;
    const muteDuration = Math.max(1, muteMins || 10);

    try {
      switch (action) {
        case "warn":
          if (!fromLadder) {
            await dmUser(author,
              `<:error:1555544434601369620> You received a warning in **${guildName}**.\n` +
              `**Reason:** ${reason}\n*(Warning #${warnCount})*`
            );
          }
          break;

        case "delete":
          // Message already deleted by safeDelete — nothing extra needed
          break;

        case "mute": {
          const durationMs = muteDuration * 60 * 1000;
          if (isBot) {
            if (member.bannable) await guild.bans.create(author, { reason: `[AutoMod] Bot spam` });
          } else {
            await member.timeout(durationMs, `[AutoMod] ${reason}`);
            if (!fromLadder) {
              await dmUser(author,
                `<:n_music:1555544516746940416> You have been muted for **${muteDuration} minutes** in **${guildName}**.\n` +
                `**Reason:** ${reason}\n*(Warning #${warnCount})*`
              );
            }
          }
          break;
        }

        case "kick":
          if (isBot || !member.kickable) {
            if (member.bannable) await guild.bans.create(author, { reason: `[AutoMod] ${reason}` });
          } else {
            if (!fromLadder) {
              await dmUser(author,
                `<:ban:1555544356352430202> You have been kicked from **${guildName}**.\n` +
                `**Reason:** ${reason}\n*(Warning #${warnCount})*`
              );
            }
            await member.kick(`[AutoMod] ${reason}`);
          }
          break;

        case "ban":
          if (member.bannable) {
            if (!fromLadder) {
              await dmUser(author,
                `<:ban:1555544356352430202> You have been banned from **${guildName}**.\n` +
                `**Reason:** ${reason}\n*(Warning #${warnCount})*`
              );
            }
            await guild.bans.create(author, { reason: `[AutoMod] ${reason}` });
          }
          break;
      }
    } catch (err) {
      console.error(`[AutoMod] Failed to apply ${action}:`, err.message);
    }
  }

  /**
   * Send a rich embed to the configured log channel.
   */
  async function logViolation(message, reason, action, warnCount, cfg) {
    if (!cfg.logChannelId) return;
    try {
      const logCh = message.guild.channels.cache.get(cfg.logChannelId);
      if (!logCh) return;

      const actionColours = { warn: 0xfbbf24, delete: 0xf97316, mute: 0x6366f1, kick: 0xef4444, ban: 0x991b1b };
      const colour = actionColours[action] ?? 0xf97316;

      const preview = message.content
        ? (message.content.length > 900 ? message.content.slice(0, 900) + "…" : message.content)
        : (message.stickers?.size ? `[Sticker: ${message.stickers.first()?.name}]` : "*no text content*");

      const embed = new EmbedBuilder()
        .setColor(colour)
        .setAuthor({
          name:    `${message.author.tag} (${message.author.id})`,
          iconURL: message.author.displayAvatarURL({ size: 64 }),
        })
        .setTitle(`<:error:1555544434601369620> AutoMod — ${action.toUpperCase()}`)
        .addFields(
          { name: "Reason",  value: reason,                            inline: true  },
          { name: "Action",  value: action,                            inline: true  },
          { name: "Warns",   value: `#${warnCount}`,                   inline: true  },
          { name: "Channel", value: `<#${message.channel.id}>`,        inline: true  },
          { name: "User",    value: `<@${message.author.id}>`,         inline: true  },
          { name: "Message", value: `\`\`\`\n${preview}\n\`\`\`` },
        )
        .setFooter({ text: `Guild: ${message.guild.name}` })
        .setTimestamp();

      await logCh.send({ embeds: [embed] }).catch(() => {});
    } catch { /* log channel unavailable — non-fatal */ }
  }

  async function dmUser(user, text) {
    try { await user.send(text); } catch { /* DMs closed */ }
  }

};