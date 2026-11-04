/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           ROCO DASHBOARD — STANDALONE PROCESS                   ║
 * ║                                                                  ║
 * ║  Runs as its own PM2 process: noxx-dashboard                    ║
 * ║                                                                  ║
 * ║  The BotClientShim proxies all Discord.js client calls          ║
 * ║  to the bot's internal API on 127.0.0.1:5182.                   ║
 * ║                                                                  ║
 * ║  Dashboard routes can keep using:                               ║
 * ║    req.client.guilds.cache.get(id)                              ║
 * ║    guild.channels.cache.filter(...)                             ║
 * ║    guild.autoModerationRules.fetch()                            ║
 * ║    req.client.manager.players.get(guildId)                      ║
 * ║    req.client.emit('devPresence', ...)                          ║
 * ║  …everything proxies transparently over HTTP.                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';
require('dotenv').config();
process.env.LOG_PROCESS_NAME = 'DASHBOARD'; // forced — entry point owns its identity
require('../../Utils/logs');

// ─── Logger ────────────────────────────────────────────────────────────────
// Defined FIRST so the crash handlers below can use it.
const ts  = () => `[${new Date().toLocaleTimeString()}]`;
const log = (...a) => console.log(ts(), '[DASHBOARD]', ...a);
const err = (...a) => console.error(ts(), '[DASHBOARD][ERROR]', ...a);

// ─── Global crash handlers — registered BEFORE any other require() ─────────
// auth.js runs passport strategy setup synchronously at require-time.
// If clientId / CLIENT_SECRET are missing it throws before the handlers
// below were previously registered, causing a silent crash with no PM2 log.
// Moving them here ensures every startup error is captured and logged.
process.on('uncaughtException', e => {
  err('Uncaught exception:', e.message, e.stack);
  // Do NOT exit — PM2 will restart; bot is unaffected
});
process.on('unhandledRejection', reason => {
  err('Unhandled rejection:', reason);
});

const path       = require('path');
const express    = require('express');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const passport   = require('passport');
const mongoose   = require('mongoose');

const { BotClientShim }  = require('../../dashboard/lib/botClient');
const hydrateGuild       = require('../../dashboard/middleware/hydrateGuild');

log('Starting standalone dashboard process…');
log(`Node ${process.version}  |  PID ${process.pid}`);

// ─── MongoDB ────────────────────────────────────────────────────────────────
mongoose.connect(process.env.mongodbURL)
  .then(() => log('MongoDB connected.'))
  .catch(e  => err('MongoDB failed:', e.message));

// ─── Bot client shim ────────────────────────────────────────────────────────
// Safe config load — same defensive wrapper as index.js
let config;
try {
  const _cfg = require('../config/bot');
  config = (_cfg && typeof _cfg === 'object') ? _cfg : {};
  if (!_cfg || typeof _cfg !== 'object') {
    err('config.js did not export a valid object — using empty config fallback.');
  }
} catch (e) {
  err('Failed to load config.js:', e.message);
  config = {};
}

// Key-level .env fallbacks (mirrors index.js _cfgDefaults)
const _env = process.env;
const _cfgDefaults = {
  embedColor:   _env.embedColor   || '#6C53FF',
  gemini_api:   _env.GEMINI_API_KEY || _env.gemini_api,
  imageGenAPI:  _env.IMAGE_GEN_API_KEY || _env.imageGenAPI,
  // prefix: removed
  status:       _env.BOT_STATUS || _env.status || 'online',
  activity:     _env.BOT_ACTIVITY || _env.activity || 'Roco',
};
for (const [key, fallback] of Object.entries(_cfgDefaults)) {
  if ((config[key] === undefined || config[key] === null) && fallback != null) {
    config[key] = fallback;
  }
}

const botClient = new BotClientShim(config);

// Kick off the first refresh immediately — app.listen is deferred until this
// resolves so the guild cache is populated before the first request arrives.

// ─── Auth strategy ────────────────────────────────────────────────────────
// Validate required env vars BEFORE requiring auth.js — passport-discord's
// DiscordStrategy constructor throws synchronously if clientId or
// CLIENT_SECRET are missing/undefined, which was the silent crash source.
const _missingAuthVars = ['clientId', 'CLIENT_SECRET'].filter(k => !process.env[k]);
if (_missingAuthVars.length) {
  err(`Cannot start: missing required env var(s): ${_missingAuthVars.join(', ')}`);
  err('Set these in your .env file and restart the dashboard process.');
  process.exit(1);
}
try {
  require('../../dashboard/auth');
} catch (e) {
  err('Failed to initialise Discord auth strategy:', e.message);
  err('Check clientId, CLIENT_SECRET, and the callbackURL in your config.');
  process.exit(1);
}

// ─── Express App ──────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);

const sessionSecret = process.env.SESSION_SECRET;
const mongoUrl      = process.env.mongodbURL;

if (!sessionSecret) { err('SESSION_SECRET not set — exiting.'); process.exit(1); }
if (!mongoUrl)      { err('mongodbURL not set — exiting.'); process.exit(1); }

// Public website data (rocobot.xyz/api/site/*) — forwarded to the bot's API on
// 127.0.0.1:5181, which applies its own rate limiting by the visitor's IP.
app.get('/api/site/:endpoint(stats|commands|uptime|changelogs)', async (req, res) => {
  try {
    const r = await fetch(`http://127.0.0.1:5181/api/site/${req.params.endpoint}`, {
      headers: { 'x-forwarded-for': req.ip, 'user-agent': req.get('user-agent') || '' },
      signal: AbortSignal.timeout(10_000),
    });
    res.status(r.status).type('application/json').send(await r.text());
  } catch {
    res.status(503).json({ error: 'Bot is starting up.' });
  }
});

// Stripe webhook (raw body must come first)
app.use(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  require('../../dashboard/webhooks/Stripe')(botClient)
);

// Lemon Squeezy webhook (raw body for signature check)
app.use(
  '/webhooks/lemonsqueezy',
  express.raw({ type: '*/*', limit: '1mb' }),
  require('../../dashboard/webhooks/LemonSqueezy')()
);

// ─── Static file serving with JS auth guards ─────────────────────────────
// SEC-FIX: The public static handler must NOT serve /js/* unauthenticated.
// All /js/* requests are intercepted here with proper auth before any static
// handler runs. A hard 403 catch-all ensures nothing falls through.
const publicDir = path.join(__dirname, '../../dashboard', 'public');
const jsDir     = path.join(publicDir, 'js');
const { isAuth, devOnly } = require('../../dashboard/middleware');

// Body parsers (needed before session/passport — must come before auth guards
// that may call next(), but static serving needs no body parsing)
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(express.json({ limit: '256kb' }));

// Sessions
app.use(session({
  secret:            sessionSecret,
  resave:            false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 604_800_000 },
  store:  MongoStore.create({ mongoUrl, ttl: 604_800, touchAfter: 3600 }),
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Attach the shim as req.client on every request ──
app.set('client', botClient);  // for routes using req.app.get('client')
app.use((req, _res, next) => { req.client = botClient; next(); });

// ── Guild hydration middleware ──
// For any request with a :id or :guildId param, pre-populate
// guild.channels.cache and guild.roles.cache from the internal API.
app.use(hydrateGuild);

// Request logger
try { app.use(require('../../Utils/requestLogger')); } catch {}

// Maintenance middleware
try { app.use(require('../../dashboard/middleware/maintenance')); } catch {}

// ── JS auth guards ───────────────────────────────────────────────────────
// Scripts must be revalidated on every load (and never stored by Cloudflare's shared cache),
// otherwise browsers keep running old code for hours after an update.
const noCacheJs = { index: false, setHeaders: (res) => res.setHeader('Cache-Control', 'private, no-cache') };
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) res.setHeader('Cache-Control', 'private, no-cache');
  next();
});
// Owner panel JS: owner only
// (the mount path is stripped, so each needs its own target: a file route and a folder)
app.get('/js/devmain.js', isAuth, devOnly, (req, res) =>
  res.set('Cache-Control', 'private, no-cache').type('application/javascript').sendFile(path.join(jsDir, 'devmain.js')));
app.use('/js/devjs', isAuth, devOnly, express.static(path.join(jsDir, 'devjs'), noCacheJs));

// Public JS: the docs page and the consent popup are shown to logged-out visitors.
// The mount path is stripped, so docsjs gets its own mount pointing at its folder.
app.get(['/js/docsmain.js', '/js/consent-popup.js'], (req, res) =>
  res.type('application/javascript').sendFile(path.join(jsDir, path.basename(req.path))));
app.use('/js/docsjs', express.static(path.join(jsDir, 'docsjs'), noCacheJs));

// Everything else (feature page modules): any logged-in user
app.use('/js', isAuth, express.static(jsDir, noCacheJs));

// Hard-deny: catches anything that slipped past (unauthenticated, non-dev, etc.)
app.use('/js', (req, res) => res.status(403).end());

// Public static — CSS, images, root-level JS (loading.js, noxx.js, etc.)
// /js requests are already terminated above and never reach this handler.
app.use(express.static(publicDir, { setHeaders: (res, file) => { if (file.endsWith('.js')) res.setHeader('Cache-Control', 'private, no-cache'); } }));

// All dashboard routes
app.use('/', require('../../dashboard/routes/index'));

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.DASHBOARD_PORT) || config.dashboard?.port || 3000;

botClient.refresh()
  .then(() => log('Bot cache populated.'))
  .catch(() => log('Bot offline — cache empty.'))
  .finally(() => {
    // In the Pterodactyl container nginx reaches us through the published port,
    // so DASHBOARD_HOST=0.0.0.0 there; default stays loopback-only.
    const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';
    app.listen(PORT, HOST, () => {
      log(`Dashboard running on ${HOST}:${PORT} (standalone mode).`);
      log(`Proxying Discord.js calls → http://127.0.0.1:5182`);
    });
  });



// ─── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGINT',  () => { log('Shutting down.'); process.exit(0); });
process.on('SIGTERM', () => { log('Shutting down.'); process.exit(0); });