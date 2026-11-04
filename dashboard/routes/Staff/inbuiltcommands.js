'use strict';
/**
 * dashboard/routes/Staff/inbuiltcommands.js
 *
 * Dashboard configuration for the built-in /promote and /infract commands.
 *
 * Routes:
 *   GET  /guild/:id/inbuilt-commands                    → serve page
 *   GET  /api/guild/:id/inbuilt-commands/config         → get full config
 *   POST /api/guild/:id/inbuilt-commands/infract        → save infract settings
 *   POST /api/guild/:id/inbuilt-commands/promote        → save promote settings + chain
 *   GET  /api/guild/:id/inbuilt-commands/log            → recent promote/infract actions
 */

const router = require('express').Router();
const path   = require('path');
const { isAuth, sendHTMLWithNonce, checkGuildAccess } = require('../../middleware');

// Use StaffCommands schema for config (guildSettingsSchema has no staffCommands field —
// saving to it would be silently dropped by Mongoose strict mode).
const StaffCommands = require('../../../Schemas/staffCommandsSchema');
const StaffAction   = require('../../../Schemas/staffActionSchema');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/inbuilt-commands',
  isAuth, checkGuildAccess,
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/inbuilt-commands.html'))
);

// ── GET full config ───────────────────────────────────────────────────────────
router.get('/api/guild/:id/inbuilt-commands/config', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const doc = await StaffCommands.findOne({ guildId: req.params.id }).lean();
    if (!doc) return res.json({});
    const { infract, promote } = doc;
    res.json({ infract: infract ?? {}, promote: promote ?? {} });
  } catch (err) {
    console.error('[inbuilt-commands GET config]', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// ── POST infract settings ─────────────────────────────────────────────────────
router.post('/api/guild/:id/inbuilt-commands/infract', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const {
      logChannelId, dmUser, demoRoleId,
      suspendRoleId, autoStrip,
    } = req.body;

    await StaffCommands.findOneAndUpdate(
      { guildId: req.params.id },
      {
        $set: {
          'infract.logChannelId':  logChannelId  ?? null,
          'infract.dmUser':        dmUser        ?? true,
          'infract.demoRoleId':    demoRoleId    ?? null,
          'infract.suspendRoleId': suspendRoleId ?? null,
          'infract.autoStrip':     autoStrip     ?? true,
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[inbuilt-commands POST infract]', err);
    res.status(500).json({ error: 'Failed to save infract settings' });
  }
});

// ── POST promote settings ─────────────────────────────────────────────────────
router.post('/api/guild/:id/inbuilt-commands/promote', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const {
      logChannelId, announceChannelId,
      promotionMessage, tiers,
    } = req.body;

    if (tiers && !Array.isArray(tiers)) {
      return res.status(400).json({ error: 'tiers must be an array' });
    }

    await StaffCommands.findOneAndUpdate(
      { guildId: req.params.id },
      {
        $set: {
          'promote.logChannelId':      logChannelId      ?? null,
          'promote.announceChannelId': announceChannelId ?? null,
          'promote.promotionMessage':  promotionMessage  ?? '',
          'promote.tiers':             tiers             ?? [],
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[inbuilt-commands POST promote]', err);
    res.status(500).json({ error: 'Failed to save promote settings' });
  }
});

// ── GET action log ────────────────────────────────────────────────────────────
router.get('/api/guild/:id/inbuilt-commands/log', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const records = await StaffAction.find({ guildId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(records.map(r => ({
      staffMember: r.targetId,
      staffTag:    r.targetTag,
      action:      r.action,
      by:          r.issuerId,
      byTag:       r.issuerTag,
      reason:      r.reason,
      caseNumber:  r.caseNumber,
      newRank:     r.newRank,
      date:        r.createdAt,
    })));
  } catch (err) {
    console.error('[inbuilt-commands GET log]', err);
    res.json([]);
  }
});

module.exports = router;
