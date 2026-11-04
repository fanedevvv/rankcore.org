'use strict';
const express = require('express');
const router  = express.Router();
const path    = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const GhostPing = require('../../../Schemas/ghostpingSchema');

// GET /guild/:id/ghostping
router.get('/guild/:id/ghostping', isAuth, checkDashboardAccess('moderation'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/ghostping.html'))
);

// GET /api/guild/:id/ghostping
router.get('/api/guild/:id/ghostping', isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const doc = await GhostPing.findOne({ Guild: req.params.id });
    res.json({ enabled: !!doc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load ghost ping settings.' });
  }
});

// POST /api/guild/:id/ghostping  { enabled: true|false }
router.post('/api/guild/:id/ghostping', isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const { enabled } = req.body;
    if (enabled) {
      await GhostPing.findOneAndUpdate(
        { Guild: req.params.id },
        { Guild: req.params.id },
        { upsert: true, new: true }
      );
    } else {
      await GhostPing.deleteOne({ Guild: req.params.id });
    }
    res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save ghost ping settings.' });
  }
});

module.exports = router;
