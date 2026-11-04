'use strict';

const router   = require('express').Router();
const path     = require('path');
const { isAuth, sendHTMLWithNonce, checkGuildAccess } = require('../../middleware');
const GuildSettings = require('../../../Schemas/guildSettingsSchema');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/staff-list', isAuth, checkGuildAccess, (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/staff-list.html'));
});

// ── GET config ────────────────────────────────────────────────────────────────
router.get('/api/guild/:id/staff-list', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const doc = await GuildSettings.findOne({ guildId: req.params.id }).lean();
    res.json(doc?.staffList ?? {});
  } catch (err) {
    console.error('[staff-list GET]', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// ── POST config ───────────────────────────────────────────────────────────────
router.post('/api/guild/:id/staff-list', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { channelId, updateMode, title, color, footer, intro,
            autoUpdate, showJoinDate, showStatus, inlineLayout, tiers } = req.body;

    await GuildSettings.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: { staffList: { channelId, updateMode, title, color, footer, intro,
                             autoUpdate, showJoinDate, showStatus, inlineLayout,
                             tiers: Array.isArray(tiers) ? tiers : [] } } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[staff-list POST]', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// ── POST /post — trigger bot to post/refresh the staff list message ───────────
router.post('/api/guild/:id/staff-list/post', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { apiPost } = require('../../lib/botClient');
    const result = await apiPost(`/internal/guild/${req.params.id}/staff-list/post`, {});
    res.json({ success: true, ...result });
  } catch (err) {
    if (!err.status) console.error('[staff-list POST /post]', err);
    res.status(err.status || 500).json({ success: false, error: err.status ? err.message : 'Bot offline or post failed' });
  }
});

module.exports = router;
