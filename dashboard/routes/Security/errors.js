'use strict';
const express    = require('express');
const router     = express.Router();
const path       = require('path');
const { isAuth, checkDashboardAccess, checkActionAccess, sendHTMLWithNonce } = require('../../middleware');
const GuildError = require('../../../Schemas/guilderrors');

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/errors',
  isAuth, checkDashboardAccess('errors'),
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/guild-errors.html'))
);

// ── GET errors for guild ──────────────────────────────────────────────────────
router.get('/api/guild/:id/errors', isAuth, checkDashboardAccess('errors'), async (req, res) => {
  const guildId = req.params.id;
  const limit   = Math.min(parseInt(req.query.limit) || 50, 200);
  const level   = req.query.level; // 'error' | 'warn' | undefined = all
  const source  = req.query.source;

  const filter = { guildId };
  if (level)  filter.level  = level;
  if (source) filter.source = source;

  try {
    const errors = await GuildError.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(errors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE clear errors for guild ────────────────────────────────────────────
router.delete('/api/guild/:id/errors', isAuth, checkDashboardAccess('errors'), checkActionAccess('errors', 'clear'), async (req, res) => {
  try {
    const result = await GuildError.deleteMany({ guildId: req.params.id });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;