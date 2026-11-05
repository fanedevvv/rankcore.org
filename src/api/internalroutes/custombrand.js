'use strict';

// Routes:
//   GET    /internal/cb/status
//   GET    /internal/cb/status/:guildId
//   GET    /internal/cb/config/:guildId
//   POST   /internal/cb/setup/:guildId
//   POST   /internal/cb/save/:guildId
//   POST   /internal/cb/toggle/:guildId
//   DELETE /internal/cb/:guildId
//   GET    /internal/cb/commands/:guildId
//   POST   /internal/cb/commands/:guildId/:cmdName/toggle
//   POST   /internal/cb/commands/:guildId/sync
//   POST   /internal/cb/send
//   POST   /internal/cb/rest

const { Router }  = require('express');
const cbm         = require('../../core/CustomBrandingManager');
const CustomBranding = require('../../../Schemas/customBrandingSchema');


module.exports = (_client) => {
  const router = Router();

  // ── Status ────────────────────────────────────────────────────────────────

  // All guilds
  router.get('/internal/cb/status', (_req, res) => {
    res.json(cbm.getAllStatus());
  });

  // Single guild
  router.get('/internal/cb/status/:guildId', (req, res) => {
    res.json(cbm.getStatus(req.params.guildId));
  });

  // ── Config ────────────────────────────────────────────────────────────────

  // GET config (token excluded) + live status
  router.get('/internal/cb/config/:guildId', async (req, res) => {
    try {
      const config = await CustomBranding.findOne({ guildId: req.params.guildId }).select('+encryptedToken').lean();
      if (!config) return res.json({});
      const { encryptedToken: _t, ...safe } = config;
      const live = cbm.getStatus(req.params.guildId);
      return res.json({
        ...safe,
        liveState:  live.state,
        botTag:     live.botTag,
        botId:      live.botId,
        botAvatar:  live.botAvatar,
        livePing:   live.ping,
        liveUptime: live.uptime,
        hasToken:   !!_t,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Setup ─────────────────────────────────────────────────────────────────

  // Submit token and launch CB worker
  router.post('/internal/cb/setup/:guildId', async (req, res) => {
    try {
      const { guildId }                         = req.params;
      const { token, alertChannelId, ownerId }  = req.body;
      if (!token || !token.includes('.'))
        return res.status(400).json({ error: 'Invalid token format' });

      const update = {
        ownerId:        ownerId || 'system',
        grantedBy:      ownerId || 'system',
        enabled:        true,
        setupState:     'pending',
        setupError:     null,
      };
      if (alertChannelId) update.alertChannelId = alertChannelId;

      await CustomBranding.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });

      // Pass raw token — CB manager encrypts with its own key (fixes key-mismatch in standalone mode)
      try { await cbm.launchGuild(guildId, token); }
      catch (err) { return res.status(400).json({ error: err.message }); }

      return res.json({ success: true, ...cbm.getStatus(guildId) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Save branding fields ──────────────────────────────────────────────────

  router.post('/internal/cb/save/:guildId', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { botName, avatarUrl, embedColor, footerText, statusText, statusType, onlineStatus, alertChannelId } = req.body;

      if (embedColor && !/^#[0-9A-Fa-f]{6}$/.test(embedColor))
        return res.status(400).json({ error: 'Invalid embed colour. Use #RRGGBB format.' });

      const VALID_ONLINE_STATUSES = ['online', 'idle', 'dnd', 'invisible'];
      if (onlineStatus !== undefined && !VALID_ONLINE_STATUSES.includes(onlineStatus))
        return res.status(400).json({ error: `onlineStatus must be one of: ${VALID_ONLINE_STATUSES.join(', ')}` });

      const update = {};
      if (botName       !== undefined) update.botName       = botName?.trim()?.slice(0, 32)    || null;
      if (avatarUrl     !== undefined) update.avatarUrl     = avatarUrl                        || null;
      if (embedColor    !== undefined) update.embedColor    = embedColor                       || null;
      if (footerText    !== undefined) update.footerText    = footerText?.trim()?.slice(0,128) || null;
      if (statusText    !== undefined) update.statusText    = statusText?.trim()?.slice(0,128) || null;
      if (statusType    !== undefined) update.statusType    = statusType                       || null;
      if (onlineStatus  !== undefined) update.onlineStatus  = onlineStatus                     || null;
      if (alertChannelId !== undefined) update.alertChannelId = alertChannelId                 || null;

      await CustomBranding.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true, new: true });

      // Live presence update via IPC
      const live = cbm.getStatus(guildId);
      if (live.state === 'running') await cbm.updatePresence(guildId, update);

      return res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Toggle (start / stop) ─────────────────────────────────────────────────

  router.post('/internal/cb/toggle/:guildId', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled } = req.body;

      if (enabled) {
        // Block start if the config is in an error state — require fresh setup first
        const existing = await CustomBranding.findOne({ guildId }).lean();
        if (existing?.setupState === 'error') {
          return res.status(400).json({
            error: existing.setupError || 'Bot is in an error state — please reset and re-submit your token before starting.',
            code:  'SETUP_ERROR',
          });
        }
        await CustomBranding.updateOne({ guildId }, { $set: { enabled: true } });
        try { await cbm.launchGuild(guildId); }
        catch (err) { return res.status(400).json({ error: err.message }); }
        return res.json({ success: true, ...cbm.getStatus(guildId) });
      } else {
        await cbm.stopGuild(guildId);
        await CustomBranding.updateOne({ guildId }, { $set: { enabled: false, setupState: 'disabled' } });
        return res.json({ success: true, state: 'stopped' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Reset ─────────────────────────────────────────────────────────────────

  router.delete('/internal/cb/:guildId', async (req, res) => {
    try {
      await cbm.stopGuild(req.params.guildId);
      await CustomBranding.deleteOne({ guildId: req.params.guildId });
      return res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Command management ────────────────────────────────────────────────────

  // List RankCore commands with enabled/disabled state for a CB guild
  router.get('/internal/cb/commands/:guildId', async (req, res) => {
    try {
      const { guildId } = req.params;
      const fs   = require('fs');
      const path = require('path');
      let allCommands = [];
      try {
        const raw = fs.readFileSync(path.join(__dirname, '../../../data/registeredCommands.json'), 'utf8');
        allCommands = JSON.parse(raw);
      } catch (e) { return res.status(500).json({ error: 'Could not load command list: ' + e.message }); }

      const config   = await CustomBranding.findOne({ guildId }).lean();
      const disabled = new Set(config?.disabledCommands || []);

      return res.json({
        commands: allCommands.map(cmd => ({
          name:        cmd.name,
          description: cmd.description,
          enabled:     !disabled.has(cmd.name),
        }))
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Toggle a single command enabled/disabled for a CB guild
  router.post('/internal/cb/commands/:guildId/:cmdName/toggle', async (req, res) => {
    try {
      const { guildId, cmdName } = req.params;
      const { enabled }          = req.body;
      if (enabled) {
        await CustomBranding.collection.updateOne({ guildId }, { $pull:     { disabledCommands: cmdName } });
      } else {
        await CustomBranding.collection.updateOne({ guildId }, { $addToSet: { disabledCommands: cmdName } });
      }
      const live = cbm.getStatus(guildId);
      if (live.state === 'running') cbm.sendToWorker(guildId, { type: 'RELOAD_COMMANDS' });
      return res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Re-sync commands on a live CB worker
  router.post('/internal/cb/commands/:guildId/sync', async (req, res) => {
    try {
      const { guildId } = req.params;
      const live = cbm.getStatus(guildId);
      if (live.state !== 'running') return res.status(400).json({ error: 'Bot is not running' });
      cbm.sendToWorker(guildId, { type: 'RELOAD_COMMANDS' });
      return res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Channel send ──────────────────────────────────────────────────────────
  // Sends a message through the active CB worker so it appears from the branded
  // bot identity. Used by cbSend (dashboard) and cbSendToTicketChannel.
  // Body: { guildId, channelId, payload: { content?, embeds?, components?, flags? } }

  router.post('/internal/cb/send', async (req, res) => {
    try {
      const { guildId, channelId, payload } = req.body || {};
      if (!guildId || !channelId || !payload)
        return res.status(400).json({ error: 'Missing guildId, channelId, or payload' });

      const live = cbm.getStatus(guildId);
      if (live.state !== 'running')
        return res.status(400).json({ error: 'CB bot is not running for this guild' });

      const corrId = `send_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('CB send timed out')), 15_000);

        function onRestResult({ guildId: gid, restResult, corrId: respId }) {
          if (gid !== guildId || respId !== corrId) return;
          clearTimeout(timeout);
          cbm.removeListener('restResult', onRestResult);
          resolve(restResult);
        }

        cbm.on('restResult', onRestResult);
        cbm.sendToWorker(guildId, {
          type:   'REST_PROXY',
          corrId,
          method: 'POST',
          route:  `/channels/${channelId}/messages`,
          body:   payload,
        });
      });

      if (result?.error) return res.status(500).json({ error: result.error });
      return res.json({ messageId: result?.id ?? null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── REST proxy ────────────────────────────────────────────────────────────
  // Routes Discord REST calls through the active CB worker so slash command
  // registrations go to the CB bot's application, not RankCore's application.

  router.post('/internal/cb/rest', async (req, res) => {
    try {
      const { guildId, method, route, body } = req.body || {};
      if (!guildId || !method || !route)
        return res.status(400).json({ error: 'Missing guildId, method, or route' });

      const live = cbm.getStatus(guildId);
      if (live.state !== 'running')
        return res.status(400).json({ error: 'CB bot is not running for this guild' });

      const corrId = `rest_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('CB REST proxy timed out')), 15_000);

        function onStateChange({ guildId: gid, restResult, corrId: respId }) {
          if (gid !== guildId || respId !== corrId) return;
          clearTimeout(timeout);
          cbm.removeListener('restResult', onStateChange);
          resolve(restResult);
        }

        cbm.on('restResult', onStateChange);
        cbm.sendToWorker(guildId, { type: 'REST_PROXY', corrId, method, route, body });
      });

      return res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};