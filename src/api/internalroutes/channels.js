'use strict';

// Routes:
//   GET  /internal/guild/:id/channels
//   GET  /internal/guild/:id/channels/text
//   GET  /internal/guild/:id/channels/text-with-parent
//   GET  /internal/guild/:id/channels/categories
//   GET  /internal/guild/:id/channels/voice
//   GET  /internal/guild/:id/channels/category
//   GET  /internal/guild/:guildId/channel/:channelId
//   GET  /internal/guild/:guildId/channel/:channelId/can-send
//   GET  /internal/guild/:guildId/channel/:channelId/webhooks
//   POST /internal/guild/:guildId/channel/:channelId/send
//   GET  /internal/guild/:guildId/channel/:channelId/message/:messageId
//   POST /internal/guild/:guildId/channel/:channelId/message/:messageId/edit
//   GET  /internal/channel/:channelId   (cross-guild lookup)

const { Router } = require('express');
const { ChannelType, PermissionsBitField } = require('discord.js');
const { serializeChannel } = require('../helpers');

module.exports = (client) => {
  const router  = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  // ── Channel lists ─────────────────────────────────────────────────────────

  router.get('/internal/guild/:id/channels', (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.json([]);
    res.json(guild.channels.cache.map(serializeChannel));
  });

  router.get('/internal/guild/:id/channels/text', (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.json([]);
    res.json(
      guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(serializeChannel)
    );
  });

  // Text channels with parentId — used by dashboard grouped dropdowns
  router.get('/internal/guild/:id/channels/text-with-parent', (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.json([]);
    res.json(
      guild.channels.cache
        .filter(c => c.type === ChannelType.GuildText)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(serializeChannel)
    );
  });

  // Category channels — used by dashboard grouped dropdowns
  router.get('/internal/guild/:id/channels/categories', (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.json([]);
    res.json(
      guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(c => ({ id: c.id, name: c.name, rawPosition: c.rawPosition }))
    );
  });

  router.get('/internal/guild/:id/channels/voice', (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.json([]);
    res.json(
      guild.channels.cache
        .filter(c => c.type === ChannelType.GuildVoice)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(serializeChannel)
    );
  });

  router.get('/internal/guild/:id/channels/category', (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.json([]);
    res.json(
      guild.channels.cache
        .filter(c => c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(serializeChannel)
    );
  });

  // ── Single channel ────────────────────────────────────────────────────────

  // Fetch by guild + channel ID (for verification route)
  router.get('/internal/guild/:guildId/channel/:channelId', async (req, res) => {
    const guild = getGuild(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const ch = await guild.channels.fetch(req.params.channelId);
      if (!ch) return res.status(404).json({ error: 'Channel not found' });
      res.json(serializeChannel(ch));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Check bot can send in a channel (for welcome/goodbye/booster permission checks)
  router.get('/internal/guild/:guildId/channel/:channelId/can-send', (req, res) => {
    const guild = getGuild(req.params.guildId);
    if (!guild) return res.json({ canSend: false });
    const ch = guild.channels.cache.get(req.params.channelId);
    if (!ch)   return res.json({ canSend: false });
    const canSend = ch.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages) ?? false;
    res.json({ canSend });
  });

  // Channel webhooks
  router.get('/internal/guild/:guildId/channel/:channelId/webhooks', async (req, res) => {
    const guild = getGuild(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const ch = await guild.channels.fetch(req.params.channelId);
      if (!ch) return res.status(404).json({ error: 'Channel not found' });
      if (ch.type !== ChannelType.GuildText) return res.status(400).json({ error: 'Text channels only' });
      const webhooks = await ch.fetchWebhooks();
      res.json(Array.from(webhooks.values()).map(wh => ({
        id: wh.id, name: wh.name,
        avatar: wh.avatar ? `https://cdn.discordapp.com/avatars/${wh.id}/${wh.avatar}.png` : null,
      })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Message send / edit ───────────────────────────────────────────────────

  // Send a message to a channel (for embed creator, welcome test, etc.)
  // SECURITY: Only forward known-safe fields — never pass raw req.body to Discord.
  router.post('/internal/guild/:guildId/channel/:channelId/send', async (req, res) => {
    const guild = getGuild(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const ch = guild.channels.cache.get(req.params.channelId);
    if (!ch || !ch.isTextBased()) return res.status(400).json({ error: 'Invalid channel' });
    try {
      const payload = {};
      if (typeof req.body.content === 'string')    payload.content    = req.body.content.slice(0, 2000);
      if (Array.isArray(req.body.embeds))          payload.embeds     = req.body.embeds.slice(0, 10);
      if (Array.isArray(req.body.components))      payload.components = req.body.components;
      if (typeof req.body.flags === 'number')      payload.flags      = req.body.flags;

      // File attachments — the shim sends them as { name, data (base64), contentType }
      if (Array.isArray(req.body.files) && req.body.files.length) {
        payload.files = req.body.files.map(f => ({
          attachment: Buffer.from(f.data, 'base64'),
          name:       f.name || 'file.png',
        }));
      }

      const msg = await ch.send(payload);
      res.json({ success: true, messageId: msg.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Fetch a single message (needed by giveaway edit/end/delete to update the embed)
  router.get('/internal/guild/:guildId/channel/:channelId/message/:messageId', async (req, res) => {
    const guild = getGuild(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const ch = guild.channels.cache.get(req.params.channelId);
    if (!ch || !ch.isTextBased()) return res.status(404).json({ error: 'Channel not found' });
    try {
      const msg = ch.messages.cache.get(req.params.messageId) ?? await ch.messages.fetch(req.params.messageId);
      res.json({ id: msg.id, content: msg.content || '' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Edit a message (needed by giveaway dashboard to update embed after create/edit/end/delete)
  router.post('/internal/guild/:guildId/channel/:channelId/message/:messageId/edit', async (req, res) => {
    const guild = getGuild(req.params.guildId);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const ch = guild.channels.cache.get(req.params.channelId);
    if (!ch || !ch.isTextBased()) return res.status(404).json({ error: 'Channel not found' });
    try {
      const msg = ch.messages.cache.get(req.params.messageId) ?? await ch.messages.fetch(req.params.messageId);
      const payload = {};
      if (typeof req.body.content === 'string')    payload.content    = req.body.content.slice(0, 2000);
      if (Array.isArray(req.body.embeds))          payload.embeds     = req.body.embeds.slice(0, 10);
      if (Array.isArray(req.body.components))      payload.components = req.body.components;
      await msg.edit(payload);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Cross-guild channel lookup ────────────────────────────────────────────

  // Find a channel by ID across all cached guilds (needed by endGiveaway / client.channels.fetch)
  router.get('/internal/channel/:channelId', (req, res) => {
    for (const guild of client.guilds.cache.values()) {
      const ch = guild.channels.cache.get(req.params.channelId);
      if (ch) return res.json({ ...serializeChannel(ch), guildId: guild.id });
    }
    res.status(404).json({ error: 'Channel not found' });
  });

  return router;
};