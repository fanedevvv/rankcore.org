'use strict';

// Routes:
//   GET  /internal/health
//   POST /internal/emit
//   POST /internal/broadcast

const { Router: ExpressRouter } = require('express');
const { EmbedBuilder: EB, ChannelType: CT } = require('discord.js');

module.exports = (client) => {
  const router = ExpressRouter();

  // ── Healthcheck ───────────────────────────────────────────────────────────

  router.get('/internal/health', (_req, res) => {
    res.json({ ok: true, ready: client.isReady(), uptime: process.uptime() });
  });

  // ── Dev events (emit to bot) ──────────────────────────────────────────────

  router.post('/internal/emit', (req, res) => {
    const { event, data } = req.body;
    const allowed = ['devPresence', 'devPresenceClear', 'devReload'];
    if (!allowed.includes(event)) return res.status(400).json({ error: 'Event not allowed' });
    client.emit(event, data);
    res.json({ success: true });
  });

  // ── Dev broadcast (send embed to all guilds) ──────────────────────────────
  // Responds immediately — actual sending happens in the background at 1 guild/s
  // to stay well under Discord's global rate limit.

  router.post('/internal/broadcast', async (req, res) => {
    const { channel: channelName, title, content, color } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    const colorInt = parseInt((color || '#53FF6C').replace('#', ''), 16) || 0x53FF6C;
    const embed    = new EB()
      .setColor(colorInt)
      .setDescription(content.trim())
      .setTimestamp()
      .setFooter({ text: 'Roco Dev Broadcast' });
    if (title?.trim()) embed.setTitle(title.trim());

    const target = (channelName || 'general').replace(/^#/, '').toLowerCase().trim();
    const guilds = [...client.guilds.cache.values()];
    const total  = guilds.length;

    res.json({ success: true, queued: total, total });

    let sent = 0, failed = 0;
    for (const guild of guilds) {
      try {
        const ch =
          guild.channels.cache.find(c => c.isTextBased?.() && !c.isThread?.() && c.name?.toLowerCase() === target) ||
          guild.channels.cache.find(c => c.type === CT.GuildText && c.permissionsFor(guild.members.me)?.has('SendMessages')) ||
          guild.systemChannel;

        if (!ch?.isTextBased?.()) { failed++; }
        else { await ch.send({ embeds: [embed] }); sent++; }
      } catch { failed++; }

      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[DEV] Broadcast complete — ${sent}/${total} sent, ${failed} failed`);
  });

  return router;
};