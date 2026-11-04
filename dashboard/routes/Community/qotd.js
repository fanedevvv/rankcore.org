'use strict';

const router = require('express').Router();
const path   = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const QOTDSchema = require('../../../Schemas/qotdSchema');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/qotd', isAuth, checkDashboardAccess('qotd'),
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/qotd.html')));

// ── GET config + questions ────────────────────────────────────────────────────
router.get('/api/guild/:id/qotd', isAuth, checkDashboardAccess('qotd'), async (req, res) => {
  try {
    const doc = await QOTDSchema.findOne({ guildId: req.params.id }).lean();
    if (!doc) return res.json({ enabled: false, questions: [], useFallbackBank: true });
    res.json(doc);
  } catch (e) {
    console.error('[QOTD GET]', e.message);
    res.status(500).json({ error: 'Failed to load QOTD config' });
  }
});

// ── POST (save config) ────────────────────────────────────────────────────────
router.post('/api/guild/:id/qotd', isAuth, checkDashboardAccess('qotd'), async (req, res) => {
  try {
    const { enabled, channelId, schedule, roleId, embedTitle, footerText, color, createThread, threadDuration, useFallbackBank } = req.body;
    if (schedule && !/^\d{2}:\d{2}$/.test(schedule))
      return res.status(400).json({ error: 'Time must be HH:MM format (24-hour UTC)' });
    await QOTDSchema.findOneAndUpdate(
      { guildId: req.params.id },
      { enabled: !!enabled, channelId: channelId || null, schedule: schedule || '09:00', roleId: roleId || null,
        embedTitle: (embedTitle || 'Question of the Day').slice(0,64), footerText: (footerText||'').slice(0,100),
        color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6C53FF', createThread: !!createThread,
        threadDuration: Math.min(Math.max(parseInt(threadDuration)||1440, 60), 10080), useFallbackBank: useFallbackBank !== false },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) { console.error('[QOTD POST]', e.message); res.status(500).json({ error: 'Failed to save' }); }
});

// ── POST question ─────────────────────────────────────────────────────────────
router.post('/api/guild/:id/qotd/question', isAuth, checkDashboardAccess('qotd'), async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Question text is required' });
    if (text.length > 500) return res.status(400).json({ error: 'Question must be 500 chars or less' });
    const doc = await QOTDSchema.findOne({ guildId: req.params.id });
    if (doc && doc.questions.length >= 200) return res.status(400).json({ error: 'Maximum 200 questions' });
    const updated = await QOTDSchema.findOneAndUpdate(
      { guildId: req.params.id },
      { $push: { questions: { text: text.trim(), addedBy: req.user?.id || null } } },
      { upsert: true, new: true }
    );
    res.json({ success: true, questions: updated.questions });
  } catch (e) { res.status(500).json({ error: 'Failed to add question' }); }
});

// ── DELETE question ───────────────────────────────────────────────────────────
router.delete('/api/guild/:id/qotd/question/:idx', isAuth, checkDashboardAccess('qotd'), async (req, res) => {
  try {
    const idx = parseInt(req.params.idx);
    const doc = await QOTDSchema.findOne({ guildId: req.params.id });
    if (!doc) return res.status(404).json({ error: 'No QOTD config found' });
    if (idx < 0 || idx >= doc.questions.length) return res.status(400).json({ error: 'Invalid index' });
    doc.questions.splice(idx, 1);
    await doc.save();
    res.json({ success: true, questions: doc.questions });
  } catch (e) { res.status(500).json({ error: 'Failed to remove question' }); }
});

// ── POST /post (manual trigger) ───────────────────────────────────────────────
router.post('/api/guild/:id/qotd/post', isAuth, checkDashboardAccess('qotd'), async (req, res) => {
  try {
    const doc = await QOTDSchema.findOne({ guildId: req.params.id });
    if (!doc?.channelId) return res.status(400).json({ error: 'QOTD not configured — set a channel first' });
    const guild = req.client?.guilds?.cache?.get(req.params.id);
    if (!guild) return res.status(503).json({ error: 'Bot not connected to this server' });
    const channel = guild.channels.cache.get(doc.channelId);
    if (!channel?.isTextBased()) return res.status(400).json({ error: 'Channel not found or not a text channel' });
    const { postQOTD } = require('../../../Commands/Community/qotd');
    await postQOTD(doc, channel, guild, req.client);
    res.json({ success: true });
  } catch (e) {
    console.error('[QOTD POST /post]', e.message);
    res.status(500).json({ error: 'Failed to post QOTD: ' + e.message });
  }
});

module.exports = router;
