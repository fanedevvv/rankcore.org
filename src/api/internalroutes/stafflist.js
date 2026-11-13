'use strict';

// Routes:
//   POST /internal/guild/:id/staff-list/post   — post or refresh the staff list embed
// Also refreshes the list on member role changes when "Auto update" is on.

const { Router } = require('express');
const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../../../Schemas/guildSettingsSchema');

const STATUS = { online: '🟢', idle: '🌙', dnd: '⛔', offline: '⚫' };
const AUTO_UPDATE_DELAY = 30_000;

function parseColor(hex) {
  const n = parseInt(String(hex || '').replace('#', ''), 16);
  return Number.isFinite(n) ? n : 0x6C53FF;
}

// Discord renders role/user mentions in an embed description (not in field names),
// so every tier is a "### @Role" heading with its members listed underneath.
const DESC_LIMIT = 4000;

function memberLine(m, cfg) {
  let line = `${m}`;
  if (cfg.showStatus && m.presence) line = `${STATUS[m.presence.status] || STATUS.offline} ${line}`;
  if (cfg.showJoinDate && m.joinedTimestamp) line += ` · <t:${Math.floor(m.joinedTimestamp / 1000)}:R>`;
  return line;
}

async function buildEmbed(guild, cfg) {
  await guild.members.fetch().catch(() => null);

  // A member is listed under every tier they hold (e.g. both Owner and Manager);
  // `listed` only counts unique people for the total.
  const listed = new Set();
  const sections = [];
  for (const tier of (cfg.tiers || []).slice(0, 25)) {
    const role = tier.roleId && guild.roles.cache.get(tier.roleId);
    if (!role) continue;
    const members = [...role.members.values()]
      .filter(m => !m.user.bot)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    members.forEach(m => listed.add(m.id));
    sections.push({ tier, role, members });
  }

  const head = cfg.intro ? cfg.intro.trim() + '\n\n' : '';
  const total = listed.size;
  const foot = `\n-# 👥 ${total} staff member${total === 1 ? '' : 's'}`;
  let budget = DESC_LIMIT - head.length - foot.length;

  const blocks = [];
  for (const { tier, role, members } of sections) {
    const title = `### ${tier.emoji ? tier.emoji + ' ' : ''}${role}`;
    const count = `-# ${members.length} member${members.length === 1 ? '' : 's'}`;
    let block = `${title}\n${count}\n`;
    let shown = 0;
    if (!members.length) {
      block += '> *No one yet*\n';
    } else if (cfg.inlineLayout) {
      // Compact layout: everyone on one line instead of one member per line
      let line = '>';
      for (const m of members) {
        const part = `${shown ? ' ·' : ''} ${m}`;
        if (block.length + line.length + part.length + 40 > budget) break;
        line += part;
        shown++;
      }
      block += line + '\n';
    } else {
      for (const m of members) {
        const line = `> ${memberLine(m, cfg)}`;
        if (block.length + line.length + 40 > budget) break;
        block += line + '\n';
        shown++;
      }
    }
    if (members.length && shown < members.length) block += `> *…and ${members.length - shown} more*\n`;
    if (block.length > budget) break;
    budget -= block.length + 1;
    blocks.push(block);
  }

  const body = blocks.length ? blocks.join('\n') : '*No rank tiers set up yet — add some on the dashboard.*\n';
  const embed = new EmbedBuilder()
    .setTitle((cfg.title || 'Staff List').slice(0, 256))
    .setColor(parseColor(cfg.color))
    .setDescription((head + body + foot).slice(0, 4096))
    .setFooter({ text: (cfg.footer || guild.name).slice(0, 2048), iconURL: guild.iconURL() || undefined })
    .setTimestamp();
  const icon = guild.iconURL({ size: 256 });
  if (icon) embed.setThumbnail(icon);
  return embed;
}

/** Posts the staff list (or edits the previous message in "edit" mode). */
async function postStaffList(guild) {
  const doc = await GuildSettings.findOne({ guildId: guild.id }).lean();
  const cfg = doc?.staffList;
  if (!cfg?.channelId) throw Object.assign(new Error('Pick a channel for the staff list first.'), { status: 400 });

  const channel = guild.channels.cache.get(cfg.channelId);
  if (!channel?.isTextBased()) throw Object.assign(new Error('The staff list channel no longer exists.'), { status: 400 });

  const embed = await buildEmbed(guild, cfg);
  const prev  = doc.staffListMessage;
  const prevMsg = prev?.messageId && prev.channelId === channel.id
    ? await channel.messages.fetch(prev.messageId).catch(() => null)
    : null;

  let message;
  if (prevMsg && cfg.updateMode !== 'repost') {
    message = await prevMsg.edit({ embeds: [embed] });
  } else {
    if (prevMsg) await prevMsg.delete().catch(() => null);
    message = await channel.send({ embeds: [embed] });
  }

  await GuildSettings.updateOne(
    { guildId: guild.id },
    { $set: { staffListMessage: { channelId: channel.id, messageId: message.id } } },
  );
  return { channelId: channel.id, messageId: message.id };
}

module.exports = (client) => {
  const router = Router();

  router.post('/internal/guild/:id/staff-list/post', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      res.json({ success: true, ...(await postStaffList(guild)) });
    } catch (err) {
      if (!err.status) console.error('[internal staff-list/post]', err);
      res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not post the staff list (check the bot can send messages in that channel).' });
    }
  });

  // Auto update: refresh a posted list shortly after staff roles change (debounced per server)
  const pending = new Map();
  client.on('guildMemberUpdate', (oldM, newM) => {
    if (oldM.roles.cache.size === newM.roles.cache.size &&
        oldM.roles.cache.every(r => newM.roles.cache.has(r.id))) return;
    const guild = newM.guild;
    if (pending.has(guild.id)) return;
    pending.set(guild.id, setTimeout(async () => {
      pending.delete(guild.id);
      try {
        const doc = await GuildSettings.findOne({ guildId: guild.id }, { staffList: 1, staffListMessage: 1 }).lean();
        if (doc?.staffList?.autoUpdate && doc.staffListMessage?.messageId) await postStaffList(guild);
      } catch (err) {
        console.warn(`[staff-list] auto update failed in ${guild.id}: ${err.message}`);
      }
    }, AUTO_UPDATE_DELAY));
  });

  return router;
};
