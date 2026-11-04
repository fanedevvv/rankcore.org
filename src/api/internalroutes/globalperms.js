'use strict';

// Routes:
//   POST /internal/guild/:id/global-perms/apply

const { Router } = require('express');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 2000;
const COOLDOWN_MS    = 5 * 60 * 1000; // 5 minutes

const _locks     = new Map(); // guildId → true
const _cooldowns = new Map(); // guildId → timestamp

function channelFilter(scope) {
  switch (scope) {
    case 'text':
      return c =>
        (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement ||
         c.type === ChannelType.GuildForum) &&
        c.type !== ChannelType.GuildVoice &&
        c.type !== ChannelType.GuildStageVoice &&
        c.type !== ChannelType.GuildCategory;
    case 'voice':
      return c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice;
    case 'category':
      return c => c.type === ChannelType.GuildCategory;
    default: // 'all'
      return () => true;
  }
}

module.exports = (client) => {
  const router   = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  router.post('/internal/guild/:id/global-perms/apply', async (req, res) => {
    const guildId = req.params.id;
    const { roles, permissions, state: action, channelType } = req.body || {};

    // Validation
    if (!Array.isArray(roles) || roles.length === 0)
      return res.status(400).json({ error: 'No roles provided.' });
    if (roles.length > 25)
      return res.status(400).json({ error: 'Maximum 25 roles allowed.' });
    if (!Array.isArray(permissions) || permissions.length === 0)
      return res.status(400).json({ error: 'No permissions provided.' });
    if (permissions.length > 10)
      return res.status(400).json({ error: 'Maximum 10 permissions allowed per request.' });
    if (!['allow', 'deny', 'none', 'remove'].includes(action))
      return res.status(400).json({ error: 'Invalid action.' });

    const scope = ['all', 'text', 'voice', 'category'].includes(channelType) ? channelType : 'all';
    const guild = getGuild(guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found.' });

    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels))
      return res.status(403).json({ error: 'Bot is missing ManageChannels permission.' });

    if (_locks.has(guildId))
      return res.status(409).json({ error: 'A global-perm job is already running for this server. Please wait.' });

    const lastRun = _cooldowns.get(guildId);
    if (lastRun) {
      const elapsed = Date.now() - lastRun;
      if (elapsed < COOLDOWN_MS) {
        const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        const mins = Math.floor(remaining / 60), secs = remaining % 60;
        return res.status(429).json({ error: `Global perms are on cooldown. Try again in ${mins > 0 ? `${mins}m ` : ''}${secs}s.` });
      }
    }

    const channels = guild.channels.cache.filter(channelFilter(scope));
    const roleObjs = roles
      .map(id => (id === guildId ? guild.roles.everyone : guild.roles.cache.get(id)))
      .filter(Boolean);

    const tasks = [];
    for (const perm    of permissions)
      for (const role  of roleObjs)
        for (const ch  of channels.values())
          tasks.push({ perm, role, channel: ch });

    if (tasks.length === 0)
      return res.json({ success: true, successCount: 0, failedCount: 0, channels: channels.size });

    _locks.set(guildId, true);
    let successCount = 0, failedCount = 0;

    try {
      for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        await Promise.allSettled(
          tasks.slice(i, i + BATCH_SIZE).map(async ({ perm, role, channel }) => {
            try {
              if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.ManageChannels)) {
                failedCount++; return;
              }
              if (action === 'remove') {
                await channel.permissionOverwrites.delete(role);
              } else {
                const value = action === 'allow' ? true : action === 'deny' ? false : null;
                await channel.permissionOverwrites.edit(role, { [perm]: value });
              }
              successCount++;
            } catch (err) {
              failedCount++;
              console.error(`[global-perm] ${role?.name}/${perm}/#${channel.name}: ${err.message}`);
            }
          })
        );
        if (i + BATCH_SIZE < tasks.length)
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
      res.json({ success: true, successCount, failedCount, channels: channels.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      _locks.delete(guildId);
      _cooldowns.set(guildId, Date.now());
    }
  });

  return router;
};