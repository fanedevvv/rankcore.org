'use strict';
const express = require('express');
const router  = express.Router();
const path    = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const Guess   = require('../../../Schemas/guess');

router.get('/guild/:id/guessthenumber', isAuth, checkDashboardAccess('overview'),
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/guessthenumber.html'))
);

router.get('/api/guild/:id/guessthenumber', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const doc = await Guess.findOne({ guildId: req.params.id }).lean();
    res.json(doc || { enabled: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load settings.' });
  }
});

router.post('/api/guild/:id/guessthenumber', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const {
      channelId, number, minNumber, maxNumber,
      enabled, allowRepeats, deleteWrong, hintsEnabled, cooldownSeconds,
      autoReset, winRoleId, winRoleDuration,
      msgWin, msgTooHigh, msgTooLow, msgCooldown, msgRepeat,
    } = req.body;

    if (!channelId) return res.status(400).json({ error: 'A channel is required.' });

    const min = Math.max(1, parseInt(minNumber) || 1);
    const max = Math.min(100_000, parseInt(maxNumber) || 1000);
    const num = Math.max(min, Math.min(max, parseInt(number) || Math.floor(Math.random() * (max - min + 1)) + min));

    await Guess.findOneAndUpdate(
      { guildId: req.params.id },
      {
        guildId: req.params.id,
        channelId,
        number: num,
        minNumber: min,
        maxNumber: max,
        enabled:         enabled !== false,
        allowRepeats:    !!allowRepeats,
        deleteWrong:     !!deleteWrong,
        hintsEnabled:    hintsEnabled !== false,
        cooldownSeconds: Math.max(0, parseInt(cooldownSeconds) || 0),
        autoReset:       autoReset !== false,
        winRoleId:       winRoleId || null,
        winRoleDuration: Math.max(0, parseInt(winRoleDuration) || 0),
        msgWin:      msgWin      || '🎉 {user} guessed **{number}** in **{tries}** tries!',
        msgTooHigh:  msgTooHigh  || '📈 Too high! Guess lower.',
        msgTooLow:   msgTooLow   || '📉 Too low! Guess higher.',
        msgCooldown: msgCooldown || '⏳ Slow down! Try again in {seconds}s.',
        msgRepeat:   msgRepeat   || '🚫 You just guessed — let someone else try!',
      },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[gtn route]', err.message);
    res.status(500).json({ error: 'Failed to save settings.' });
  }
});

router.delete('/api/guild/:id/guessthenumber', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    await Guess.deleteOne({ guildId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disable.' });
  }
});

// PATCH — reset number only
router.patch('/api/guild/:id/guessthenumber/reset', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const doc = await Guess.findOne({ guildId: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not configured.' });
    const min = doc.minNumber || 1;
    const max = doc.maxNumber || 1000;
    doc.number = Math.floor(Math.random() * (max - min + 1)) + min;
    doc._tries = 0;
    await doc.save();
    res.json({ success: true, number: doc.number });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset.' });
  }
});

module.exports = router;
