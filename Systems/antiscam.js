const { Events, EmbedBuilder } = require('discord.js');
const antiScamSchema = require('../Schemas/antiscam');
const cache = require('../src/lib/cache');

// Known scam / phishing patterns
const PHISHING_REGEX = /(https?:\/\/)?(www\.)?(discord(gift|te|-(nitro|gift))|steamcommunity|free-nitro|nitro-classic|airdrop|claim-?reward|drop-?game|free-?robux|free-?vbuck|free-?prime|free-?cash|giveaway-?win|steam-?gift|xbox-?gift|playstation-?gift)/i;

const FAKE_NITRO_REGEX = /(https?:\/\/)?(www\.)?(discord(gift|te)|nitro|boost).*\.(gift|nitro)\/?(free|claim|get)?/i;

const SUSPICIOUS_CONTENT_REGEX = /(free\s+(nitro|boost|discord|robux|vbuck|cash|prime|gift))|(claim\s+(your|free|now))|(click\s+(here|this|me)\s+(to\s+)?(claim|win|get|verify))|(you.ve?\s+(won|been\s+selected))|(congratulations.*winner)|(gift\s+(card|code).*free)/i;

const WEIRD_NAME_REGEX = /(bot|user\d{4,}|[^\w\s]{5,}|[a-z]{10,}|[A-Z]{10,})/i;

const SCAM_DOMAIN_REGEX = /(https?:\/\/)?([a-z0-9-]+\.)*(xyz|gift|nitro|tk|ml|ga|cf|gq|pw|top|loan|work|review|stream|date|party|racing|download|pics|bet|click|link|trade|win|sbs|uno|mom|men|zip|bid|review|live|sale|website|space|site|online|club|blog|store|shop|info|today|help|app|dev|cloud|host|press|world|life|pro|name|art|fit|guru|bar|bond|city|company|cool|email|exchange|faith|fund|gift|gold|group|guru|kim|limited|live|lol|men|mobi|moe|money|moscow|network|nyc|one|online|ooo|organic|page|party|pics|pink|pizza|place|press|promo|property|pub|racing|realty|red|reise|rest|review|rip|rocks|rodeo|run|sale|school|science|security|services|shoes|shop|show|site|soccer|solar|solutions|space|storage|store|stream|studio|style|supplies|supply|support|surgery|systems|tattoo|tax|team|technology|tennis|theater|time|tips|today|tools|top|tours|town|toys|trade|training|tube|university|uno|vacations|ventures|viaje|video|villas|vin|vision|vista|vlog|vodka|vote|voting|voto|voyage|wang|watch|webcam|website|wed|website|wiki|wine|work|works|world|wtf|xyz|zone)/i;

const DEFAULT_LOG_COLORS = {
  delete: 0xf97316,
  warn:   0xfbbf24,
  mute:   0x6366f1,
  kick:   0xef4444,
  ban:    0x991b1b,
};

module.exports = (client) => {
  const monitoredUsers = new Map();
  const warnCooldowns  = new Map();

  async function getConfig(guildId) {
    return cache.wrap('antiscam', `config:${guildId}`,
      () => antiScamSchema.findOne({ guildId }).lean(), 60);
  }

  function isExempt(entry, member) {
    if (entry.whitelist?.includes(member.id)) return true;
    if (entry.ignoredRoles?.length && member.roles?.cache) {
      if (member.roles.cache.some(r => entry.ignoredRoles.includes(r.id))) return true;
    }
    return false;
  }

  function isChannelExempt(entry, channelId) {
    return entry.ignoredChannels?.includes(channelId) ?? false;
  }

  function resolveAction(entry, detectionKey) {
    const dc = entry[detectionKey];
    if (dc?.action && dc.action !== 'delete') return dc.action;
    return entry.globalAction || 'delete';
  }

  function resolveMuteMinutes(entry, detectionKey) {
    const dc = entry[detectionKey];
    if (dc?.muteMinutes) return dc.muteMinutes;
    return entry.globalMuteMinutes || 10;
  }

  function resolveWarnStep(cfg, warnCount) {
    const sorted = [...(cfg.warnSteps || [])].sort((a, b) => b.count - a.count);
    return sorted.find(s => warnCount >= s.count) || null;
  }

  async function applyAction(member, action, reason, muteMinutes) {
    switch (action) {
      case 'warn':  return 'User Warned';
      case 'mute': {
        if (member.moderatable) {
          await member.timeout(muteMinutes * 60 * 1000, reason).catch(() => null);
          return `Timed Out (${muteMinutes}m)`;
        }
        return 'Mute Failed (perms)';
      }
      case 'kick': {
        if (member.kickable) {
          await member.kick(reason).catch(() => null);
          return 'User Kicked';
        }
        return 'Kick Failed (perms)';
      }
      case 'ban': {
        if (member.bannable) {
          await member.ban({ reason }).catch(() => null);
          return 'User Banned';
        }
        return 'Ban Failed (perms)';
      }
      default: return 'Message Deleted';
    }
  }

  async function logAction(guild, entry, logData) {
    if (!entry.logChannelId) return;
    const logChannel = guild.channels.cache.get(entry.logChannelId);
    if (!logChannel) return;

    const colour = DEFAULT_LOG_COLORS[logData.action] || 0xf97316;
    const embed = new EmbedBuilder()
      .setColor(colour)
      .setAuthor({ name: `${logData.userTag} (${logData.userId})`, iconURL: logData.avatar })
      .setTitle(`Anti-Scam — ${logData.action.toUpperCase()}`)
      .addFields(
        { name: 'Type',   value: logData.type,   inline: true },
        { name: 'Action', value: logData.actionTaken, inline: true },
      );

    if (logData.content) {
      const preview = logData.content.length > 900
        ? logData.content.slice(0, 900) + '...'
        : logData.content;
      embed.addFields({ name: 'Message', value: `\`\`\`\n${preview}\n\`\`\`` });
    }

    if (logData.channel) embed.addFields({ name: 'Channel', value: `<#${logData.channel}>`, inline: true });
    if (logData.heat != null) embed.addFields({ name: 'Heat', value: `${logData.heat}/${entry.heatThreshold || 10}`, inline: true });
    if (logData.detail) embed.addFields({ name: 'Detail', value: logData.detail, inline: false });
    if (logData.action === 'ban' || logData.action === 'kick') {
      embed.setFooter({ text: `Guild: ${guild.name}` });
    }
    embed.setTimestamp();
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  }

  async function savePunishmentLog(guildId, data) {
    await antiScamSchema.findOneAndUpdate(
      { guildId },
      { $push: { punishmentLog: { $each: [data], $slice: -200 } } },
      { upsert: true }
    ).catch(() => null);
  }

  function getMonitoredHeat(userId) {
    const existing = monitoredUsers.get(userId);
    if (!existing) return null;
    const now = Date.now();
    if (now - existing.timestamp > (existing.decayMs || 3600000)) {
      monitoredUsers.delete(userId);
      return null;
    }
    return existing;
  }

  function addHeat(userId, amount, decayMs) {
    const entry = monitoredUsers.get(userId) || { heat: 0, timestamp: Date.now(), decayMs: decayMs || 3600000 };
    entry.heat += amount;
    entry.timestamp = Date.now();
    entry.decayMs = decayMs || 3600000;
    monitoredUsers.set(userId, entry);
    return entry;
  }

  async function handleScamDetection(message, entry) {
    const guildId = message.guild.id;
    const member  = message.member;

    let detectedType = null;
    let matchedContent = null;

    if (entry.detectPhishing?.enabled !== false && PHISHING_REGEX.test(message.content)) {
      detectedType = 'Phishing Link';
      matchedContent = message.content.match(PHISHING_REGEX)?.[0];
    } else if (entry.detectFakeNitro?.enabled !== false && FAKE_NITRO_REGEX.test(message.content)) {
      detectedType = 'Fake Nitro Scam';
      matchedContent = message.content.match(FAKE_NITRO_REGEX)?.[0];
    } else if (entry.detectSuspiciousContent?.enabled !== false && SUSPICIOUS_CONTENT_REGEX.test(message.content)) {
      detectedType = 'Suspicious Content';
      matchedContent = message.content.match(SUSPICIOUS_CONTENT_REGEX)?.[0];
    }

    // Custom domains (always checked regardless of detection toggles)
    if (!detectedType && entry.customDomains?.length) {
      for (const domain of entry.customDomains) {
        const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(https?://)?([a-z0-9-]+\\.)*${escaped}`, 'i');
        if (regex.test(message.content)) {
          detectedType = 'Custom Blocked Domain';
          matchedContent = domain;
          break;
        }
      }
    }

    // Custom patterns (always checked regardless of detection toggles)
    if (!detectedType && entry.customPatterns?.length) {
      for (const pattern of entry.customPatterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(message.content)) {
            detectedType = 'Custom Pattern Match';
            matchedContent = pattern;
            break;
          }
        } catch {}
      }
    }

    if (!detectedType) return false;

    try {
      await message.delete().catch(() => null);
    } catch {}

    const detectionKey = {
      'Phishing Link': 'detectPhishing',
      'Fake Nitro Scam': 'detectFakeNitro',
      'Suspicious Content': 'detectSuspiciousContent',
      'Custom Blocked Domain': 'detectPhishing',
      'Custom Pattern Match': 'detectSuspiciousContent',
    }[detectedType] || 'detectPhishing';

    const action = resolveAction(entry, detectionKey);
    const muteMins = resolveMuteMinutes(entry, detectionKey);
    const heatAmount = entry.heatValues?.phishingLink || 10;

    const heatEntry = addHeat(message.author.id, heatAmount, (entry.heatDecayMinutes || 60) * 60 * 1000);

    let actionTaken = 'Message Deleted';
    if (member) {
      if (action !== 'delete' || heatEntry.heat >= (entry.heatThreshold || 10)) {
        actionTaken = await applyAction(member, action, `Anti-Scam: ${detectedType}`, muteMins);
      }
    }

    const { default: avatar } = message.author.displayAvatarURL({ forceStatic: true, size: 64 });
    await logAction(message.guild, entry, {
      userId: message.author.id,
      userTag: message.author.tag,
      avatar,
      action,
      actionTaken,
      type: detectedType,
      content: message.content,
      channel: message.channel.id,
      heat: heatEntry.heat,
      detail: matchedContent ? `Matched: ${matchedContent}` : undefined,
    });

    await savePunishmentLog(guildId, {
      userId: message.author.id,
      userTag: message.author.tag,
      type: detectedType,
      detail: matchedContent || message.content.slice(0, 200),
      actionTaken,
    });

    // If heat exceeds threshold, escalate
    if (heatEntry.heat >= (entry.heatThreshold || 10) && member) {
      const escalateAction = entry.globalAction === 'ban' ? 'ban' : entry.globalAction === 'kick' ? 'kick' : 'kick';
      const result = await applyAction(member, escalateAction, `Anti-Scam: Heat threshold reached (${detectedType})`, 0);
      monitoredUsers.delete(message.author.id);

      await logAction(message.guild, entry, {
        userId: message.author.id,
        userTag: message.author.tag,
        avatar,
        action: escalateAction,
        actionTaken: result,
        type: 'Heat Threshold',
        heat: heatEntry.heat,
      });

      await savePunishmentLog(guildId, {
        userId: message.author.id,
        userTag: message.author.tag,
        type: 'Heat Threshold',
        detail: `Heat ${heatEntry.heat}/${entry.heatThreshold || 10}`,
        actionTaken: result,
      });
    }

    return true;
  }

  // ── Guild Member Join ──────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    const entry = await getConfig(member.guild.id);
    if (!entry?.enabled || isExempt(entry, member)) return;

    try {
      let heat = 0;
      let reasons = [];

      if (entry.detectSuspiciousUsernames?.enabled !== false && WEIRD_NAME_REGEX.test(member.user.username)) {
        heat += (entry.heatValues?.weirdName || 5);
        reasons.push('Suspicious username');
      }

      if (!member.user.avatar) {
        heat += (entry.heatValues?.noAvatar || 3);
        reasons.push('No profile picture');
      }

      if (heat > 0) {
        const decayMs = (entry.heatDecayMinutes || 60) * 60 * 1000;
        addHeat(member.id, heat, decayMs);

        if (heat >= (entry.heatThreshold || 10)) {
          const actionTaken = await applyAction(member, 'kick', `Anti-Scam: ${reasons.join(', ')}`, 0);
          monitoredUsers.delete(member.id);

          if (entry.logChannelId) {
            const { default: avatar } = member.user.displayAvatarURL({ forceStatic: true, size: 64 });
            await logAction(member.guild, entry, {
              userId: member.id,
              userTag: member.user.tag,
              avatar,
              action: 'kick',
              actionTaken,
              type: 'Suspicious Join',
              heat,
              detail: reasons.join('\n'),
            });

            await savePunishmentLog(member.guild.id, {
              userId: member.id,
              userTag: member.user.tag,
              type: 'Suspicious Join',
              detail: reasons.join(', '),
              actionTaken,
            });
          }
        }
      }
    } catch {}
  });

  // ── Message Create ─────────────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    const entry = await getConfig(message.guild.id);
    if (!entry?.enabled) return;

    // Channel exempt
    if (isChannelExempt(entry, message.channel.id)) return;

    const member = message.member;
    if (!member) return;

    // User / role exempt
    if (isExempt(entry, member)) return;

    // 1. Check for scam content in message
    const detected = await handleScamDetection(message, entry);
    if (detected) return;

    // 2. New account detection
    if (entry.detectNewAccounts?.enabled !== false) {
      const accountAgeMs = Date.now() - message.author.createdTimestamp;
      const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
      const maxDays = entry.newAccountDays || 7;

      if (accountAgeDays < maxDays) {
        // Check if message has links (suspicious for new accounts)
        if (/https?:\/\/[^\s]+/i.test(message.content)) {
          try {
            await message.delete().catch(() => null);

            const heatAmount = entry.heatValues?.suspiciousContent || 7;
            const heatEntry = addHeat(message.author.id, heatAmount, (entry.heatDecayMinutes || 60) * 60 * 1000);

            const action = resolveAction(entry, 'detectNewAccounts');
            let actionTaken = 'Message Deleted';
            if (member && action !== 'delete') {
              actionTaken = await applyAction(member, action, `Anti-Scam: New account (<${Math.round(accountAgeDays)}d)`, resolveMuteMinutes(entry, 'detectNewAccounts'));
            }

            const { default: avatar } = message.author.displayAvatarURL({ forceStatic: true, size: 64 });
            await logAction(message.guild, entry, {
              userId: message.author.id,
              userTag: message.author.tag,
              avatar,
              action,
              actionTaken,
              type: 'New Account Link',
              content: message.content,
              channel: message.channel.id,
              heat: heatEntry.heat,
              detail: `Account age: ${Math.round(accountAgeDays)} days`,
            });

            await savePunishmentLog(message.guild.id, {
              userId: message.author.id,
              userTag: message.author.tag,
              type: 'New Account Link',
              detail: `Account age: ${Math.round(accountAgeDays)}d`,
              actionTaken,
            });
          } catch {}
        }
      }
    }

    // 3. Check monitored users for repeated offences
    const mon = getMonitoredHeat(message.author.id);
    if (mon && /https?:\/\/[^\s]+/i.test(message.content)) {
      // Repeated link posting while on probation
      const heatAmount = entry.heatValues?.repeatedOffence || 4;
      const heatEntry = addHeat(message.author.id, heatAmount, (entry.heatDecayMinutes || 60) * 60 * 1000);

      if (heatEntry.heat >= (entry.heatThreshold || 10)) {
        try {
          await message.delete().catch(() => null);
          const escalateAction = entry.globalAction === 'ban' ? 'ban' : entry.globalAction === 'kick' ? 'kick' : 'kick';
          const actionTaken = await applyAction(member, escalateAction, `Anti-Scam: Repeated offences (heat ${heatEntry.heat})`, 0);
          monitoredUsers.delete(message.author.id);

          const { default: avatar } = message.author.displayAvatarURL({ forceStatic: true, size: 64 });
          await logAction(message.guild, entry, {
            userId: message.author.id,
            userTag: message.author.tag,
            avatar,
            action: escalateAction,
            actionTaken,
            type: 'Repeated Offences',
            content: message.content,
            channel: message.channel.id,
            heat: heatEntry.heat,
          });

          await savePunishmentLog(message.guild.id, {
            userId: message.author.id,
            userTag: message.author.tag,
            type: 'Repeated Offences',
            detail: `Heat ${heatEntry.heat}/${entry.heatThreshold || 10}`,
            actionTaken,
          });
        } catch {}
      }
    }
  });
};
