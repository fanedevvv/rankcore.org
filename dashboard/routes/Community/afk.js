'use strict';

const router   = require('express').Router();
const path     = require('path');
const { isAuth, sendHTMLWithNonce, checkGuildAccess } = require('../../middleware');
const afkSchema = require('../../../Schemas/afkschema');

router.get('/guild/:id/afk', isAuth, checkGuildAccess, (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/afk.html'));
});

router.get('/api/guild/:id/afk', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const enabled = await afkSchema.isGuildAfkEnabled(req.params.id);
    res.json({ afkEnabled: enabled });
  } catch (err) {
    console.error('[afk GET] error:', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

router.post('/api/guild/:id/afk', isAuth, checkGuildAccess, async (req, res) => {
  try {
    const { afkEnabled } = req.body;
    await afkSchema.setGuildAfkEnabled(req.params.id, !!afkEnabled);
    res.json({ success: true });
  } catch (err) {
    console.error('[afk POST] error:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

module.exports = router;