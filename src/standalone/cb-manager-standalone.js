/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        ROCO CUSTOM BRANDING MANAGER — STANDALONE PROCESS        ║
 * ║                                                                  ║
 * ║  Runs as its own PM2 process: noxx-cb                           ║
 * ║                                                                  ║
 * ║  Owns all CB worker child-processes independently of the bot.   ║
 * ║  A bot crash or dashboard crash NEVER takes down CB bots, and   ║
 * ║  a CB worker crash NEVER takes down the main bot.               ║
 * ║                                                                  ║
 * ║  Exposes a small HTTP API on 127.0.0.1:5183 (CB_PORT env var)   ║
 * ║  that mirrors the /internal/cb/* routes in internal.js so the   ║
 * ║  bot and dashboard can proxy commands to it unchanged.           ║
 * ║                                                                  ║
 * ║  All /internal/cb/* calls from the dashboard go:               ║
 * ║    dashboard → botClient (5182) → bot → cb-manager (5183)      ║
 * ║  Or, when CB_STANDALONE=true is set on the bot:                ║
 * ║    bot → cb-manager (5183)  directly                           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

require('dotenv').config();
process.env.LOG_PROCESS_NAME = 'CB'; // forced — entry point owns its identity
require('../../Utils/logs');

const express  = require('express');
const mongoose = require('mongoose');

// SAFETY: If CB_STANDALONE=true is set on THIS process it would load the proxy
// instead of the real manager, causing it to HTTP-call itself and time out.
// This is always a misconfiguration — abort immediately with a clear message.
if (process.env.CB_STANDALONE === 'true') {
  console.error('[CB-MANAGER][FATAL] CB_STANDALONE=true is set on the noxx-cb process.');
  console.error('[CB-MANAGER][FATAL] This flag must only be set on noxx-bot, NOT on noxx-cb.');
  console.error('[CB-MANAGER][FATAL] Remove CB_STANDALONE from the noxx-cb env in ecosystem.config.js and reload.');
  process.exit(1);
}

const cbm            = require('../core/CustomBrandingManager');
const CustomBranding = require('../../Schemas/customBrandingSchema');

const CB_PORT = parseInt(process.env.CB_PORT || '5183', 10);
const ts  = () => `[${new Date().toLocaleTimeString()}]`;
const log = (...a) => console.log(ts(),  '[CB-MANAGER]', ...a);
const err = (...a) => console.error(ts(), '[CB-MANAGER][ERROR]', ...a);

log(`Starting standalone CB manager…  Node ${process.version}  PID ${process.pid}`);

// ── MongoDB ────────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.mongodbURL || process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) { err('No MongoDB URI — set mongodbURL in .env'); process.exit(1); }

// Auto-retry MongoDB on initial failure — never exit, always reconnect.
async function connectMongo(attempt = 0) {
  const delay = Math.min(5_000 * (2 ** attempt), 5 * 60_000);
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 45_000,
    });
    log('MongoDB connected');
    if (attempt === 0) {
      startManager();
    } else {
      log('MongoDB reconnected after ' + attempt + ' attempt(s).');
    }
  } catch (e) {
    err(`MongoDB connection attempt ${attempt + 1} failed: ${e.message} — retrying in ${(delay / 1000).toFixed(0)}s…`);
    setTimeout(() => connectMongo(attempt + 1), delay);
  }
}

// Handle MongoDB disconnections and auto-reconnect
mongoose.connection.on('disconnected', () => {
  if (mongoose.connection.readyState !== 0) return; // only if fully disconnected
  err('MongoDB disconnected — will attempt auto-reconnect via Mongoose built-in retry.');
});
mongoose.connection.on('reconnected', () => log('MongoDB reconnected.'));
mongoose.connection.on('error', e => err('MongoDB error:', e.message));

connectMongo();

// ── Initialise CBM + HTTP API ─────────────────────────────────────────────────
async function startManager() {
  // CBM.init() normally takes a Discord client to emit events.
  // In standalone mode we pass a lightweight stub — CBM only uses
  // the client for logging; it doesn't call any Discord.js methods here.
  const clientStub = { emit: () => {} };
  await cbm.init(clientStub);

  const app = express();
  app.use(express.json());

  // ── Auth guard — loopback always allowed, remote requires x-cb-secret ──────
  // CB manager now runs on a separate server; the main server reaches it over
  // the network so requests arrive from a non-loopback IP. We authenticate
  // those via the shared CB_API_SECRET header instead of an IP allowlist.
  // This is MANDATORY - must be set in production for security.
  const _CB_SECRET = process.env.CB_API_SECRET || '';
  app.use((req, res, next) => {
    const ip = req.socket?.remoteAddress || '';
    const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (isLoopback) return next();
    // Remote request — require the shared secret
    if (!_CB_SECRET) {
      console.error('[CB-MANAGER] FATAL: CB_API_SECRET is not set in environment!');
      return res.status(500).json({ error: 'Internal server configuration error' });
    }
    if (req.headers['x-cb-secret'] !== _CB_SECRET) return res.status(403).json({ error: 'Invalid CB API secret' });
    next();
  });

  // ── GET all CB statuses ────────────────────────────────────────────────────
  app.get('/cb/status', (_req, res) => res.json(cbm.getAllStatus()));

  // ── GET status for one guild ───────────────────────────────────────────────
  app.get('/cb/status/:guildId', (req, res) => res.json(cbm.getStatus(req.params.guildId)));

  // ── GET config (no token) + live status ───────────────────────────────────
  app.get('/cb/config/:guildId', async (req, res) => {
    try {
      const config = await CustomBranding.findOne({ guildId: req.params.guildId }).select('+encryptedToken').lean();
      if (!config) return res.json({});
      const { encryptedToken: _t, ...safe } = config;
      const live = cbm.getStatus(req.params.guildId);
      safe.liveState  = live.state;
      safe.botTag     = live.botTag;
      safe.botId      = live.botId;
      safe.botAvatar  = live.botAvatar;
      safe.livePing   = live.ping;
      safe.liveUptime = live.uptime;
      safe.hasToken   = !!_t;
      return res.json(safe);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST setup (submit token) ──────────────────────────────────────────────
  app.post('/cb/setup/:guildId', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { token, alertChannelId, ownerId } = req.body;
      if (!token || !token.includes('.'))
        return res.status(400).json({ error: 'Invalid token format.' });

      const update = {
        ownerId, grantedBy: ownerId,
        enabled: true,
        setupState: 'pending', setupError: null,
      };
      if (alertChannelId) update.alertChannelId = alertChannelId;

      await CustomBranding.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });

      try { await cbm.launchGuild(guildId, token); }
      catch (e) {
        return res.status(400).json({ error: e.message, hint: 'Check token, intents, and bot invite.' });
      }

      const live = cbm.getStatus(guildId);
      return res.json({ success: true, state: live.state, botTag: live.botTag, ping: live.ping });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST save branding fields ──────────────────────────────────────────────
  app.post('/cb/save/:guildId', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { botName, avatarUrl, embedColor, footerText, statusText, statusType, alertChannelId } = req.body;
      const update = {};
      if (botName        !== undefined) update.botName       = botName?.trim()?.slice(0, 32)    || null;
      if (avatarUrl      !== undefined) update.avatarUrl      = avatarUrl                        || null;
      if (embedColor     !== undefined) update.embedColor     = embedColor                       || null;
      if (footerText     !== undefined) update.footerText     = footerText?.trim()?.slice(0,128) || null;
      if (statusText     !== undefined) update.statusText     = statusText?.trim()?.slice(0,128) || null;
      if (statusType     !== undefined) update.statusType     = statusType                       || null;
      if (alertChannelId !== undefined) update.alertChannelId = alertChannelId                   || null;
      const updated = await CustomBranding.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true, new: true });
      const live = cbm.getStatus(guildId);
      if (live.state === 'running') await cbm.updatePresence(guildId, updated);
      const { encryptedToken: _t, ...safe } = updated.toObject();
      return res.json({ success: true, config: safe });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST toggle (start / stop) ─────────────────────────────────────────────
  app.post('/cb/toggle/:guildId', async (req, res) => {
    try {
      const { guildId } = req.params;
      const { enabled } = req.body;

      if (enabled) {
        const existing = await CustomBranding.findOne({ guildId }).lean();
        if (existing?.setupState === 'error') {
          return res.status(400).json({
            error: existing.setupError || 'Bot is in an error state — please reset and re-submit your token.',
            code: 'SETUP_ERROR',
          });
        }
        await CustomBranding.updateOne({ guildId }, { $set: { enabled: true } });
        try { await cbm.launchGuild(guildId); }
        catch (e) { return res.status(400).json({ error: e.message }); }
        return res.json({ success: true, ...cbm.getStatus(guildId) });
      } else {
        await cbm.stopGuild(guildId);
        await CustomBranding.updateOne({ guildId }, { $set: { enabled: false, setupState: 'disabled' } });
        return res.json({ success: true, state: 'stopped' });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE reset ───────────────────────────────────────────────────────────
  app.delete('/cb/:guildId', async (req, res) => {
    try {
      await cbm.stopGuild(req.params.guildId);
      await CustomBranding.deleteOne({ guildId: req.params.guildId });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST launch / stop (called by bot proxy) ─────────────────────────────
  app.post('/cb/launch/:guildId', async (req, res) => {
    try {
      await cbm.launchGuild(req.params.guildId, req.body?.token);
      return res.json({ success: true, ...cbm.getStatus(req.params.guildId) });
    } catch (e) { return res.status(400).json({ error: e.message }); }
  });

  app.post('/cb/stop/:guildId', async (req, res) => {
    try {
      await cbm.stopGuild(req.params.guildId);
      return res.json({ success: true, state: 'stopped' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  app.post('/cb/stopAll', async (_req, res) => {
    try { await cbm.stopAll(); return res.json({ success: true }); }
    catch (e) { return res.status(500).json({ error: e.message }); }
  });

  app.post('/cb/presence/:guildId', async (req, res) => {
    try {
      await cbm.updatePresence(req.params.guildId, req.body.config);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  // ── POST command sync ──────────────────────────────────────────────────────
  app.post('/cb/commands/:guildId/sync', (req, res) => {
    const live = cbm.getStatus(req.params.guildId);
    if (live.state === 'running') cbm.sendToWorker(req.params.guildId, { type: 'RELOAD_COMMANDS' });
    return res.json({ success: true });
  });

  // ── POST toggle single command enabled/disabled ────────────────────────────
  app.post('/cb/commands/:guildId/:cmdName/toggle', async (req, res) => {
    try {
      const { guildId, cmdName } = req.params;
      const { enabled } = req.body;
      
      // Update the disabledCommands array in MongoDB
      if (enabled) {
        await CustomBranding.collection.updateOne({ guildId }, { $pull: { disabledCommands: cmdName } });
      } else {
        await CustomBranding.collection.updateOne({ guildId }, { $addToSet: { disabledCommands: cmdName } });
      }
      
      // Tell the worker to reload commands to pick up the change
      const live = cbm.getStatus(guildId);
      if (live.state === 'running') cbm.sendToWorker(guildId, { type: 'RELOAD_COMMANDS' });
      
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  // ── POST REST proxy — forward a REST call through the CB worker ────────────
  app.post('/cb/rest/:guildId', async (req, res) => {
    try {
      const guildId = req.params.guildId;
      const live = cbm.getStatus(guildId);
      if (live.state !== 'running') {
        return res.status(400).json({ error: 'CB bot is not running for this guild' });
      }

      const { corrId, method, route, body } = req.body || {};
      if (!method || !route) return res.status(400).json({ error: 'Missing method or route' });

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('CB REST proxy timed out')), 15_000);

        function onResult({ guildId: gid, restResult, corrId: respId }) {
          if (gid !== guildId || respId !== corrId) return;
          clearTimeout(timeout);
          cbm.removeListener('restResult', onResult);
          resolve(restResult);
        }

        cbm.on('restResult', onResult);
        cbm.sendToWorker(guildId, { type: 'REST_PROXY', corrId, method, route, body });
      });

      return res.json(result);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  // ── Start HTTP server ──────────────────────────────────────────────────────
  // Bind on all interfaces so the main server can reach us.
  // Secured by the x-cb-secret header check above.
  const CB_BIND = process.env.CB_BIND || '0.0.0.0';
  app.listen(CB_PORT, CB_BIND, () => {
    log(`CB manager API listening on ${CB_BIND}:${CB_PORT}`);
  });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────
async function shutdown(signal) {
  log(`${signal} received — stopping all CB bots…`);
  await cbm.stopAll();
  await mongoose.disconnect();
  log('Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
// Anti-crash: log all exceptions but never exit — PM2 handles critical restarts.
const _managerFatalTimes = [];
process.on('uncaughtException', e => {
  err('Uncaught exception (suppressed):', e?.message || e);
  if (e?.stack) err(e.stack);
  // Death-spiral guard: >10 uncaught exceptions in 60s -> controlled restart
  const now = Date.now();
  while (_managerFatalTimes.length && _managerFatalTimes[0] < now - 60_000) _managerFatalTimes.shift();
  _managerFatalTimes.push(now);
  if (_managerFatalTimes.length >= 10) {
    err('Death spiral detected (10 exceptions in 60s) — performing controlled restart.');
    shutdown('DEATH_SPIRAL');
  }
});
process.on('unhandledRejection', e => {
  err('Unhandled rejection (suppressed):', e?.message || String(e));
  if (e?.stack) err(e.stack);
  // Never exit on unhandled rejections.
});