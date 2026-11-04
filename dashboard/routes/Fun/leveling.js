'use strict';
const router    = require('express').Router();
const path      = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const LevelSetup = require('../../../Schemas/levelsetup');
const LevelRole  = require('../../../Schemas/levelRoleSchema');
const { getLimits, limitError } = require('../Utils/limits');

router.get('/guild/:id/leveling', isAuth, checkDashboardAccess('leveling'),
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/leveling.html'))
);

router.get('/api/guild/:id/leveling', isAuth, checkDashboardAccess('leveling'), async (req, res) => {
  try {
    const [config, rewards] = await Promise.all([
      LevelSetup.findOne({ Guild: req.params.id }).lean(),
      LevelRole.findOne({ GuildID: req.params.id }).lean(),
    ]);
    res.json({ config: config || {}, rewards: rewards?.LevelRoleData || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load leveling config.' });
  }
});

router.post('/api/guild/:id/leveling/config', isAuth, checkDashboardAccess('leveling'), async (req, res) => {
  try {
    const {
      enabled, channel, notifyMode,
      xpMin, xpMax, cooldown,
      multiRole, multiValue,
      xpMultipliers,
      blacklistedChannels, blacklistedRoles,
      stackRoles,
      levelUpMessage, embedColor, embedTitle, embedFooter,
      useEmbed, showProgress, pingOnLevelUp,
      leaderboardChannelId,
    } = req.body;

    await LevelSetup.findOneAndUpdate(
      { Guild: req.params.id },
      {
        Disabled:            enabled ? 'enabled' : 'disabled',
        NotificationChannel: channel || null,
        notifyMode:          notifyMode || 'channel',
        xpMin:               Math.max(1, Math.min(100, parseInt(xpMin) || 8)),
        xpMax:               Math.max(1, Math.min(200, parseInt(xpMax) || 18)),
        cooldown:            Math.max(0, parseInt(cooldown) || 60),
        Role:                multiRole || null,
        Multi:               multiValue || null,
        xpMultipliers:       Array.isArray(xpMultipliers)
                               ? xpMultipliers.filter(x => x.roleId && x.multiplier)
                               : [],
        blacklistedChannels: Array.isArray(blacklistedChannels) ? blacklistedChannels : [],
        blacklistedRoles:    Array.isArray(blacklistedRoles)    ? blacklistedRoles    : [],
        stackRoles:          stackRoles !== false,
        levelUpMessage:      (levelUpMessage || '').slice(0, 500) || '🎉 {user} just reached **Level {level}**!',
        embedColor:          /^#[0-9a-fA-F]{6}$/.test(embedColor) ? embedColor : '#6C53FF',
        embedTitle:          (embedTitle  || '').slice(0, 100) || 'Level Up!',
        embedFooter:         (embedFooter || '').slice(0, 200),
        useEmbed:            useEmbed !== false,
        showProgress:        showProgress !== false,
        pingOnLevelUp:       pingOnLevelUp !== false,
        leaderboardChannelId: leaderboardChannelId || null,
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[leveling config]', err.message);
    res.status(500).json({ error: 'Failed to save config.' });
  }
});

router.post('/api/guild/:id/leveling/rewards', isAuth, checkDashboardAccess('leveling'), async (req, res) => {
  try {
    let doc = await LevelRole.findOne({ GuildID: req.params.id })
            || new LevelRole({ GuildID: req.params.id, LevelRoleData: [] });

    const level = parseInt(req.body.level);
    if (isNaN(level) || level < 1) return res.status(400).json({ error: 'Invalid level.' });

    const idx = doc.LevelRoleData.findIndex(r => r.level === level);
    if (idx === -1) {
      const lim = await getLimits(req.user?.id, req.params.id);
      if (doc.LevelRoleData.length >= lim.levelRewards)
        return res.status(400).json({ error: limitError(lim, 'level rewards') });
      doc.LevelRoleData.push({ level, roleId: req.body.roleId });
    } else {
      doc.LevelRoleData[idx].roleId = req.body.roleId;
    }
    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save reward.' });
  }
});

router.delete('/api/guild/:id/leveling/rewards/:level', isAuth, checkDashboardAccess('leveling'), async (req, res) => {
  try {
    const doc = await LevelRole.findOne({ GuildID: req.params.id });
    if (doc) {
      doc.LevelRoleData = doc.LevelRoleData.filter(r => r.level !== parseInt(req.params.level));
      await doc.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reward.' });
  }
});

// Reset all XP for guild
router.delete('/api/guild/:id/leveling/reset', isAuth, checkDashboardAccess('leveling'), async (req, res) => {
  try {
    const levelSchema = require('../../../Schemas/level');
    await levelSchema.deleteMany({ Guild: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset XP.' });
  }
});

module.exports = router;
