'use strict';
const { Events, EmbedBuilder } = require('discord.js');
const levelSchema     = require('../Schemas/level');
const levelschema     = require('../Schemas/levelsetup');
const levelRoleSchema = require('../Schemas/levelRoleSchema');

const xpCooldowns = new Map(); // Map<`${guildId}:${userId}`, timestamp>

function interpolate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function xpForLevel(level) {
  return Math.floor(level * 40 * 2);
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    const { guild, author, member, channel } = message;
    if (!guild || author.bot) return;

    try {
      const cfg = await levelschema.findOne({ Guild: guild.id });
      if (!cfg || cfg.Disabled === 'disabled') return;

      // ── Blacklisted channels ──────────────────────────────────────────────
      if (cfg.blacklistedChannels?.includes(channel.id)) return;

      // ── Blacklisted roles ─────────────────────────────────────────────────
      if (cfg.blacklistedRoles?.length) {
        if (member.roles.cache.some(r => cfg.blacklistedRoles.includes(r.id))) return;
      }

      // ── Cooldown ──────────────────────────────────────────────────────────
      const cooldownMs = (cfg.cooldown ?? 60) * 1000;
      const cKey       = `${guild.id}:${author.id}`;
      const lastXP     = xpCooldowns.get(cKey) || 0;
      if (Date.now() - lastXP < cooldownMs) return;
      xpCooldowns.set(cKey, Date.now());

      // ── XP calculation ────────────────────────────────────────────────────
      const xpMin = cfg.xpMin ?? 8;
      const xpMax = cfg.xpMax ?? 18;
      let baseXP  = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

      // Multi-role multipliers (new system)
      let multiplier = 1;
      if (cfg.xpMultipliers?.length) {
        for (const entry of cfg.xpMultipliers) {
          if (member.roles.cache.has(entry.roleId)) {
            multiplier = Math.max(multiplier, parseFloat(entry.multiplier) || 1);
          }
        }
      }
      // Legacy single multiplier role
      if (multiplier === 1 && cfg.Role && member.roles.cache.has(cfg.Role)) {
        const m = parseFloat(cfg.Multi);
        if (!isNaN(m) && m > 1) multiplier = m;
      }

      let xpEarned = Math.min(baseXP * multiplier, 200);

      // ── Fetch/create user data ────────────────────────────────────────────
      let userData = await levelSchema.findOne({ Guild: guild.id, User: author.id });
      if (!userData) {
        userData = await levelSchema.create({ Guild: guild.id, User: author.id, XP: 0, Level: 1 });
      }

      userData.XP += xpEarned;

      let leveledUp  = false;
      let newLevel   = userData.Level;
      let reqXP      = xpForLevel(userData.Level);

      while (userData.XP >= reqXP) {
        userData.XP  -= reqXP;
        userData.Level += 1;
        newLevel       = userData.Level;
        leveledUp      = true;
        reqXP          = xpForLevel(userData.Level);
      }

      await userData.save();

      // ── Level-up handling ─────────────────────────────────────────────────
      if (!leveledUp) return;

      // Level roles
      const roleData = await levelRoleSchema.findOne({ GuildID: guild.id });
      let earnedRole = null;
      if (roleData?.LevelRoleData?.length) {
        // Sort ascending so we assign all roles up to current level
        const sorted = [...roleData.LevelRoleData].sort((a, b) => a.level - b.level);
        for (const item of sorted) {
          if (newLevel >= item.level) {
            const role = guild.roles.cache.get(item.roleId);
            if (role && !member.roles.cache.has(item.roleId)) {
              await member.roles.add(role).catch(() => {});
              if (newLevel === item.level) earnedRole = role;
            }
          }
        }
        // Stack mode OFF: remove roles below current highest
        if (!cfg.stackRoles) {
          const highest = sorted.filter(i => newLevel >= i.level).at(-1);
          if (highest) {
            for (const item of sorted) {
              if (item.level !== highest.level && member.roles.cache.has(item.roleId)) {
                await member.roles.remove(item.roleId).catch(() => {});
              }
            }
          }
        }
      }

      // ── Send notification ─────────────────────────────────────────────────
      const mode = cfg.notifyMode || 'channel';
      if (mode === 'none') return;

      const totalXPForNext = xpForLevel(newLevel);
      const progressPct    = Math.round((userData.XP / totalXPForNext) * 100);
      const filledBars     = Math.round(progressPct / 10);
      const progressBar    = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);

      const vars = {
        user:       `<@${author.id}>`,
        username:   author.username,
        level:      newLevel,
        xp:         Math.round(userData.XP),
        nextXp:     totalXPForNext,
        progress:   progressPct,
        progressBar,
        guild:      guild.name,
        role:       earnedRole ? `<@&${earnedRole.id}>` : '',
      };

      const content = cfg.pingOnLevelUp !== false ? `<@${author.id}>` : undefined;

      let payload;
      if (cfg.useEmbed !== false) {
        const desc   = interpolate(cfg.levelUpMessage || '<:boost:1567796953599836280> {user} just reached **Level {level}**!', vars);
        const footer = interpolate(cfg.embedFooter || '', vars);
        const embed  = new EmbedBuilder()
          .setColor(cfg.embedColor || client.config.embedColor || '#6C53FF')
          .setTitle(interpolate(cfg.embedTitle || 'Level Up!', vars))
          .setDescription(desc + (earnedRole ? `\n<:minigames:1567796978929238076> Earned role: ${vars.role}` : ''));

        if (cfg.showProgress !== false) {
          embed.addFields({
            name: 'Progress to Level ' + (newLevel + 1),
            value: `\`${progressBar}\` ${progressPct}%  (${Math.round(userData.XP)}/${totalXPForNext} XP)`,
          });
        }
        if (footer) embed.setFooter({ text: footer });
        embed.setTimestamp();
        payload = { content, embeds: [embed] };
      } else {
        payload = { content: interpolate(cfg.levelUpMessage || '<:boost:1567796953599836280> {user} just reached **Level {level}**!', vars) };
      }

      if (mode === 'dm' || mode === 'both') {
        await author.send(payload).catch(() => {});
      }
      if (mode === 'channel' || mode === 'both') {
        const notifChannel = cfg.NotificationChannel
          ? guild.channels.cache.get(cfg.NotificationChannel)
          : channel;
        if (notifChannel?.isTextBased()) {
          await notifChannel.send(payload).catch(() => {});
        }
      }

    } catch (err) {
      console.error('[leveling] Error:', err.message);
    }
  });
};
