'use strict';

// Routes:
//   GET  /internal/user/:id
//   POST /internal/user/:id/dm

const { Router } = require('express');

module.exports = (client) => {
  const router = Router();

  // ── Fetch user ────────────────────────────────────────────────────────────

  router.get('/internal/user/:id', async (req, res) => {
    try {
      const force = req.query.force === 'true';
      const user  = await client.users.fetch(req.params.id, { force });
      res.json({
        id:            user.id,
        username:      user.username,
        discriminator: user.discriminator,
        avatarURL:     user.displayAvatarURL({ size: 256 }),
        bot:           user.bot,
        createdAt:     user.createdAt,
        banner:        user.banner,
      });
    } catch { res.status(404).json({ error: 'User not found' }); }
  });

  // ── DM a user ─────────────────────────────────────────────────────────────
  // Used by dashboard routes that need to DM users without a live Discord.js client ref.
  // Accepts: { content?, embeds? } — same shape as channel.send()

  router.post('/internal/user/:id/dm', async (req, res) => {
    try {
      const user = await client.users.fetch(req.params.id, { force: false });
      if (!user) return res.status(404).json({ error: 'User not found' });
      const payload = {};
      if (req.body.content) payload.content = req.body.content;
      if (req.body.embeds)  payload.embeds  = req.body.embeds;
      await user.send(payload);
      res.json({ success: true });
    } catch (err) {
      // DMs disabled, blocked, or user not found — non-fatal
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};