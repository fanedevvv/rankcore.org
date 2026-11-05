/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              RANKCORE INTERNAL BOT PROXY API                        ║
 * ║  Port 5182 — localhost only, no auth (loopback trust)           ║
 * ║                                                                  ║
 * ║  The standalone dashboard process calls these endpoints          ║
 * ║  instead of touching the Discord.js client directly.            ║
 * ║                                                                  ║
 * ║  Every req.client.* usage in dashboard routes has a             ║
 * ║  corresponding endpoint here.                                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Route files (all under ./routes/):
 *   bot.js          — /internal/bot-info, /internal/guilds, /internal/guild/:id
 *   channels.js     — /internal/guild/:id/channels/*, /internal/channel/:channelId
 *   roles.js        — /internal/guild/:id/roles
 *   members.js      — /internal/guild/:id/member/:userId, /internal/guild/:id/members
 *   automod.js      — /internal/guild/:id/automod/*
 *   music.js        — /internal/guild/:id/player/*
 *   users.js        — /internal/user/:id, /internal/user/:id/dm
 *   commands.js     — /internal/commands, /internal/application/commands, /internal/guild/:id/commands/*
 *   modules.js      — /internal/modules/*
 *   granular.js     — /internal/granular/*
 *   globalperms.js  — /internal/guild/:id/global-perms/*
 *   custombrand.js  — /internal/cb/*
 *   rest.js         — /internal/rest/*
 *   health.js       — /internal/health
 */

'use strict';

const express = require('express');

const INTERNAL_PORT = 5182;

// ─── Middleware ───────────────────────────────────────────────────────────────

// Layer 1: Only allow localhost connections.
function onlyLocalhost(req, res, next) {
  const ip = req.socket.remoteAddress;
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

// Layer 2: Shared-secret check — defence-in-depth against other localhost processes.
// Generate with: openssl rand -hex 32
// Add INTERNAL_API_SECRET=<value> to .env (same value read by both bot and dashboard).
// This is MANDATORY - must be set in production for security.
function requireInternalSecret(req, res, next) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error('[INTERNAL API] FATAL: INTERNAL_API_SECRET is not set in environment!');
    return res.status(500).json({ error: 'Internal server configuration error' });
  }
  if (req.headers['x-internal-secret'] !== secret)
    return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ─── App factory ─────────────────────────────────────────────────────────────

module.exports = (client) => {
  const app = express();
  app.disable('x-powered-by');
  app.use(onlyLocalhost);
  app.use(requireInternalSecret);

  // Image cards (welcome/goodbye/booster test routes) serialise a PNG buffer
  // into the JSON payload — a 500x150 card is ~150-400 KB. Files are now sent
  // as multipart by the shim, but we raise the limit here as a safety net for
  // any other large payloads that transit this API.
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: false, limit: '8mb' }));

  // ─── Mount route modules ──────────────────────────────────────────────────
  app.use(require('./internalroutes/bot')(client));
  app.use(require('./internalroutes/channels')(client));
  app.use(require('./internalroutes/roles')(client));
  app.use(require('./internalroutes/members')(client));
  app.use(require('./internalroutes/automod')(client));
  app.use(require('./internalroutes/music')(client));
  app.use(require('./internalroutes/users')(client));
  app.use(require('./internalroutes/commands')(client));
  app.use(require('./internalroutes/modules')(client));
  app.use(require('./internalroutes/granular')(client));
  app.use(require('./internalroutes/globalperms')(client));
  app.use(require('./internalroutes/custombrand')(client));
  app.use(require('./internalroutes/rest')(client));
  app.use(require('./internalroutes/health')(client));
  app.use(require('./internalroutes/stafflist')(client));
  app.use(require('./internalroutes/jtc')(client));

  // 404 fallback
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // ─── Start ────────────────────────────────────────────────────────────────
  // Retry on EADDRINUSE — the previous process may not have released the port yet
  // (common during PM2 solo restarts). Retry every 500ms for up to 10s.
  // Keep idle sockets open longer than the dashboard's 5s poll interval.
  // Node's default keepAliveTimeout is also 5s, so the dashboard would sometimes
  // reuse a socket at the exact moment the server closed it → ECONNRESET.
  function tuneKeepAlive(server) {
    server.keepAliveTimeout = 65_000;
    server.headersTimeout   = 66_000;
    return server;
  }

  function startListening(app, client) {
    const s = app.listen(INTERNAL_PORT, '127.0.0.1', () => {
      console.log(`[INTERNAL API] Listening on 127.0.0.1:${INTERNAL_PORT}`);
    });
    tuneKeepAlive(s);
    s.on('error', (err) => {
      s.close();
      if (err.code !== 'EADDRINUSE') {
        console.error(`[INTERNAL API] Listen error: ${err.message}`);
        return;
      }
      console.warn(`[INTERNAL API] Port ${INTERNAL_PORT} in use — retrying in 500ms…`);
      let attempts = 0;
      const retry = setInterval(() => {
        attempts++;
        const s2 = app.listen(INTERNAL_PORT, '127.0.0.1', () => {
          clearInterval(retry);
          console.log(`[INTERNAL API] Listening on 127.0.0.1:${INTERNAL_PORT} (retry ${attempts})`);
          if (client._internalApiServer) client._internalApiServer = s2;
        });
        tuneKeepAlive(s2);
        s2.on('error', (e) => {
          s2.close();
          if (e.code !== 'EADDRINUSE' || attempts >= 20) {
            clearInterval(retry);
            console.error(`[INTERNAL API] ${e.code === 'EADDRINUSE' ? 'Giving up after ' + attempts + ' retries' : e.message}`);
          }
        });
      }, 500);
    });
    return s;
  }

  const server = startListening(app, client);
  return server;
};