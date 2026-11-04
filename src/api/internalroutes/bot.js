'use strict';

// Routes:
//   GET  /internal/bot-info
//   GET  /internal/guilds
//   GET  /internal/guild/:id
//   POST /internal/guild/:id/leave
//   POST /internal/guild/:id/invite

const { Router } = require('express');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { serializeGuild } = require('../helpers');

module.exports = (client) => {
  const router = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  // ── Bot info ──────────────────────────────────────────────────────────────

  router.get('/internal/bot-info', (_req, res) => {
    // Never return 503 here — a hard failure causes the dashboard shim's
    // Promise.all([bot-info, guilds]) to reject entirely, which prevents the
    // guild cache from populating and locks the servers page on "offline" for
    // the full duration of any Discord gateway reconnect window.
    // Instead, include a `ready` flag so the shim can set _online correctly
    // while still getting a 200 it can parse.
    //
    // NOTE: client.isReady() returns false during a WebSocket reconnect/resume
    // even though the guild cache is fully populated and the bot is functionally
    // online.  Using it alone causes the dashboard to flip to "offline" during
    // every routine reconnect.  We use a broader "functionally ready" check:
    // the bot is considered online if it has a user identity AND a non-empty
    // guild cache, regardless of the current WebSocket handshake state.
    const gatewayReady   = client.isReady();
    const functionalReady = !!(client.user?.id && client.guilds.cache.size > 0);
    const ready = gatewayReady || functionalReady;
    res.json({
      ready,
      id:           functionalReady ? client.user.id                 : null,
      username:     functionalReady ? client.user.username           : null,
      avatarURL:    functionalReady ? client.user.displayAvatarURL() : null,
      ping:         gatewayReady    ? client.ws.ping                 : -1,
      uptime:       gatewayReady    ? client.uptime                  : 0,
      guildCount:   functionalReady ? client.guilds.cache.size       : 0,
      userCount:    functionalReady ? client.users.cache.size        : 0,
      channelCount: functionalReady ? client.channels.cache.size     : 0,
      status:       client.ws.status,
    });
  });

  // ── Guild list ────────────────────────────────────────────────────────────

  // List all guild IDs + basic info (for /api/servers and guild cache population)
  router.get('/internal/guilds', (_req, res) => {
    res.json(
      client.guilds.cache.map(g => ({
        id:                       g.id,
        name:                     g.name,
        icon:                     g.icon,
        banner:                   g.banner,
        memberCount:              g.memberCount,
        ownerId:                  g.ownerId,
        premiumSubscriptionCount: g.premiumSubscriptionCount,
        premiumTier:              g.premiumTier,
        verificationLevel:        g.verificationLevel,
        createdAt:                g.createdAt,
        systemChannelId:          g.systemChannelId,
        _roleCount:               g.roles?.cache?.size ?? 0,
        _channelCount:            g.channels?.cache?.size ?? 0,
        _emojiCount:              g.emojis?.cache?.size ?? 0,
      }))
    );
  });

  // ── Single guild ──────────────────────────────────────────────────────────

  // Full guild data (overview panel)
  router.get('/internal/guild/:id', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const owner = await guild.fetchOwner();
      const presenceCounts = { online: 0, idle: 0, dnd: 0, offline: 0 };
      guild.members.cache.forEach(m => {
        const s = m.presence?.status || 'offline';
        if (presenceCounts[s] !== undefined) presenceCounts[s]++;
      });
      res.json({
        ...serializeGuild(guild),
        owner:    `${owner.user.username}#${owner.user.discriminator}`,
        humans:   guild.members.cache.filter(m => !m.user.bot).size,
        bots:     guild.members.cache.filter(m =>  m.user.bot).size,
        roles:    guild.roles.cache.size,
        channels: guild.channels.cache.size,
        emojis:   guild.emojis.cache.size,
        presence: presenceCounts,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Guild actions (dev panel) ─────────────────────────────────────────────

  router.post('/internal/guild/:id/leave', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try { await guild.leave(); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Blacklist-leave: send an embed then leave (used by dev portal) ────────
  // Called by the dashboard's server-blacklist and user-blacklist POST routes.
  // Runs on the real bot process so guild.members.me, guild.channels.cache,
  // and channel.send() all work correctly with real Discord.js objects.
  router.post('/internal/guild/:id/blacklist-leave', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const { reason = 'No reason provided' } = req.body;

    try {
      const me = guild.members.me;
      const canSpeak = (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.permissionsFor(me)?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ]);

      const channel =
        (guild.systemChannel && canSpeak(guild.systemChannel) ? guild.systemChannel : null) ??
        guild.channels.cache
          .filter(canSpeak)
          .sort((a, b) => a.position - b.position)
          .first() ??
        null;

      if (channel) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setTitle('⛔ Server Blacklisted')
          .setDescription(
            `This server has been **blacklisted** and ${client.user.username} is now leaving.\n\n` +
            `**Reason:** ${reason}\n\n` +
            `If you believe this is a mistake, please contact support.`
          )
          .setThumbnail(client.user.displayAvatarURL())
          .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => null);
      }

      await guild.leave();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/internal/guild/:id/invite', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const me = guild.members.me;
      const channel = guild.channels.cache
        .filter(c =>
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
          !c.isThread?.() &&
          (me ? c.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite) : true)
        )
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .first() ?? guild.systemChannel;

      if (!channel) return res.status(400).json({ error: 'No accessible channel to create invite in' });

      const invite = await channel.createInvite({ maxAge: 86400, maxUses: 10, reason: 'Dev panel invite' });
      res.json({ success: true, url: invite.url, code: invite.code, expiresAt: invite.expiresAt });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};