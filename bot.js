/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                  ROCO BOT — ENTRY POINT                     ║
 * ║  Modules are isolated.  The dashboard, music, systems,      ║
 * ║  etc. can each crash and restart without killing the bot.   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
// Force BOT identity — never allow a .env or ecosystem env to override this.
// Each entry-point (index.js / dashboard-standalone.js / cb-manager-standalone.js)
// owns its own identity and must set it unconditionally.
process.env.LOG_PROCESS_NAME = 'BOT';
// CB_STANDALONE not forced - real manager runs CB workers in-process
process.env.DASHBOARD_MODE   = process.env.DASHBOARD_MODE   || 'standalone';

// ─── Logger ───────────────────────────────────────────────────────────────────
const theme = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', yellow: '\x1b[33m', green: '\x1b[32m',
  blue: '\x1b[34m', magenta: '\x1b[35m', red: '\x1b[31m', gray: '\x1b[90m',
};
const sep     = theme.gray + '══════════════════════════════════════════════' + theme.reset;
const startTime = Date.now();
const ts      = () => `${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset}`;
const elapsed = () => `${theme.dim}+${((Date.now() - startTime) / 1000).toFixed(2)}s${theme.reset}`;
const logStep = (label, msg, c = theme.cyan) =>
  console.log(`${sep}\n${ts()} ${c}${theme.bright}[${label}]${theme.reset} ${msg} ${elapsed()}\n${sep}`);
const logInfo  = msg => console.log(`${ts()} ${theme.cyan}[<:n_info:1555544473008873565> INFO]${theme.reset}    ${msg}`);
const logOk    = msg => console.log(`${ts()} ${theme.green}${theme.bright}[<a:tickyy:1555544712687915008> OK]${theme.reset}      ${msg}`);
const logWarn  = msg => console.log(`${ts()} ${theme.yellow}${theme.bright}[<:error:1555544434601369620> WARN]${theme.reset}    ${msg}`);
const logError = msg => console.log(`${ts()} ${theme.red}${theme.bright}[<:crossy:1555544390221562048> ERROR]${theme.reset}   ${msg}`);

console.clear();
console.log(sep);
console.log(`${theme.bright}${theme.cyan}   <:n_bot:1555544367886770176>  Roco — Modular Boot Manager${theme.reset}`);
console.log(sep);
logInfo(`Node ${process.version}  |  PID: ${process.pid}  |  ${process.platform}`);

// ─── Auto-install missing deps ────────────────────────────────────────────────
logStep('DEP-CHECK', 'Scanning for missing npm dependencies…', theme.magenta);
const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const nmPath  = path.join(__dirname, 'node_modules');

const isInstalled = name => {
  const dir = name.startsWith('@')
    ? path.join(nmPath, ...name.split('/').slice(0, 2))
    : path.join(nmPath, name.split('/')[0]);
  return fs.existsSync(dir);
};

if (fs.existsSync(pkgPath)) {
  const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = { ...pkg.dependencies || {}, ...pkg.devDependencies || {} };
  const missing = Object.keys(allDeps).filter(n => !isInstalled(n));

  if (missing.length) {
    logWarn(`Missing ${missing.length} package(s): ${missing.join(', ')}`);
    spawnSync('npm', ['install', '--no-audit', '--no-fund', ...missing],
      { stdio: 'inherit', cwd: __dirname, shell: false });
    logOk('Dependencies installed.');
  } else {
    logOk('All dependencies present.');
  }
}

// ─── Core Imports ─────────────────────────────────────────────────────────────
logStep('INIT', 'Importing core modules…', theme.magenta);

const mongoose = require('mongoose');
const express  = require('express');
const { scheduleDailyBackup } = require('./src/lib/mongoBackup');
const { getClient: getRedis } = require('./src/lib/redis');

// ── Async event crash protection — must run before discord.js is loaded ────────
require('./Utils/patchAsyncEvents').patchAsyncEvents();

// ── Global Discord API shield (swallows DiscordAPIError, AbortError, ECONNRESET) ──
require('./Functions/globalApiShield')();

const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { Api }  = require('@top-gg/sdk');

// ─── Module Manager ───────────────────────────────────────────────────────────
const { instance: moduleManager }   = require('./src/core/moduleManager');
const { instance: granularManager } = require('./src/core/GranularManager');

// ─── Custom Branding Manager ─────────────────────────────────────────────────
const customBrandingManager = require('./src/core/CustomBrandingManager');

// ─── WSS Status Server ──────────────────────────────────────────────────────
const StatusWebSocketServer = require('./src/ws/statusServer');
let _wssServer = null;

// Wire up module event listeners for console visibility + WSS broadcast
moduleManager.on('moduleStateChange', ({ name, state }) => {
  const icon = { running: '<a:tickyy:1555544712687915008>', error: '<:crossy:1555544390221562048>', stopped: '■', starting: '…', stopping: '…', disabled: '○' }[state] || '?';
  logInfo(`[MODULE] ${icon} ${name} → ${state}`);

  if (_wssServer) {
    const mod = moduleManager.getStatus(name);
    _wssServer.broadcastModuleUpdate(name, state, {
      label: mod?.label || name,
      group: mod?.group || 'Other',
      uptime: mod?.uptime,
      error: mod?.error,
    });
  }
});

moduleManager.on('moduleError', ({ name, error }) => {
  logError(`[MODULE] "${name}" threw: ${error.message}`);
  if (_wssServer) {
    _wssServer.broadcastModuleUpdate(name, 'error', { error: error.message });
  }
});

// Register module definitions (must happen before startAll)
require('./modules/index');

// ─── Discord Client ───────────────────────────────────────────────────────────
logStep('CLIENT', 'Initialising Discord client…', theme.blue);

const client = new Client({
  intents:    [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials:   Object.values(Partials),
  shards:     'auto',
  shardCount: 1,
});

// Attach shared state
client.commands        = new Collection();
// ── Safe config load ──────────────────────────────────────────────────────────
// Ensures client.config is ALWAYS a plain object even if config.js throws,
// returns null/undefined, or is missing a key the codebase expects.
// Critical keys fall back to process.env so the bot degrades gracefully
// rather than crashing with "Cannot read properties of undefined".
try {
  const _cfg = require('./src/config/bot');
  if (_cfg && typeof _cfg === 'object') {
    client.config = _cfg;
  } else {
    console.error('[BOOT] config.js did not export a valid object — using empty config fallback.');
    client.config = {};
  }
} catch (e) {
  console.error('[BOOT] Failed to load config.js:', e.message);
  client.config = {};
}

// Key-level fallbacks: any key missing from config.js is sourced from .env instead.
const _env = process.env;
const _cfgDefaults = {
  token:                          _env.token                          || _env.BOT_TOKEN,
  clientId:                       _env.clientId                       || _env.CLIENT_ID,
  embedColor:                     _env.embedColor                     || '#6C53FF',
  embed:                          _env.embedColor                     || '#6C53FF',
  // prefix: removed
  gemini_api:                     _env.GEMINI_API_KEY                 || _env.gemini_api,
  imageGenAPI:                    _env.IMAGE_GEN_API                  || _env.imageGenAPI,
  logchannel:                     _env.LOG_CHANNEL_ID                 || _env.logchannel,
  // prefixCommandLoggingChannel removed
  slashCommandLoggingChannel:     _env.SLASH_LOG_CHANNEL              || _env.slashCommandLoggingChannel,
  buttonLoggingChannel:           _env.BUTTON_LOG_CHANNEL             || _env.buttonLoggingChannel,
  botsuggestions:                 _env.BOT_SUGGESTIONS_CHANNEL        || _env.botsuggestions,
  bugreport:                      _env.BUG_REPORT_CHANNEL             || _env.bugreport,
  feedback:                       _env.FEEDBACK_CHANNEL               || _env.feedback,
  dev:                            _env.DEV_USER_ID                    || _env.dev,
  status:                         _env.BOT_STATUS                     || _env.status        || 'online',
  activity:                       _env.BOT_ACTIVITY                   || _env.activity       || 'Roco',
};
for (const [key, fallback] of Object.entries(_cfgDefaults)) {
  if ((client.config[key] === undefined || client.config[key] === null) && fallback != null) {
    client.config[key] = fallback;
  }
}

// ── Safe color getters ────────────────────────────────────────────────────────
// EmbedBuilder.setColor() uses @sapphire/shapeshift strict validation and
// throws on null/undefined.  Wrapping embedColor + embed as getters here means
// every file in the codebase gets a safe integer with zero changes elsewhere.
(function patchConfigColor(cfg) {
  const DEFAULT_COLOR = 0x6C53FF;
  function hexToInt(value) {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const int = parseInt(value.replace('#', ''), 16);
      if (!isNaN(int)) return int;
    }
    return DEFAULT_COLOR;
  }
  cfg._embedColorRaw = cfg.embedColor;
  Object.defineProperties(cfg, {
    embedColor: {
      get()      { return hexToInt(this._embedColorRaw); },
      set(value) { this._embedColorRaw = value; },
      enumerable: true, configurable: true,
    },
    embed: {
      get()      { return hexToInt(this._embedColorRaw); },
      enumerable: true, configurable: true,
    },
  });
})(client.config);
client.emoji           = require('./src/data/emoji.json');
client.logs            = require('./Utils/logs.js');
client.topgg           = new Api(process.env.TOP_GG_TOKEN);
client.moduleManager   = moduleManager;
client.granularManager = granularManager;

client.setMaxListeners(50);

require('./Utils/patchEphemeral')(client);
require('./Utils/componentExpiry').install();
require('./Utils/patchEvents')(client);

// Load the handleEvents utility so modules/events can call client.handleEvents()
require('./Functions/handelEvents')(client);

logOk('Discord client initialised.');

// ─── Startup Sequence ─────────────────────────────────────────────────────────
(async () => {
  logStep('BOOT', 'Starting module boot sequence…', theme.bright);

  // 1. Core handlers (no network needed)
  await moduleManager.start('error-handlers',   client);
  await moduleManager.start('slash-commands',   client);
  await moduleManager.start('functions',        client);
  await moduleManager.start('triggers',         client);
  await moduleManager.start('events',           client);

  // 2. Connect to MongoDB first, then start CB bots before Roco logs in
  //    CB bots get a head-start so they're fully up before Roco hits Discord.
  logStep('DB', 'Connecting to MongoDB…', theme.blue);
  await mongoose.connect(process.env.mongodbURL)
    .then(() => {
      logOk('MongoDB connected.');
      scheduleDailyBackup();
    })
    .catch(err => { logError(`MongoDB failed: ${err.message}`); process.exit(1); });

  // Initialize Redis (non-fatal if unavailable)
  try {
    const redis = getRedis();
    await redis.ping();
    logOk('Redis connected.');
  } catch (err) {
    logWarn(`Redis unavailable — caching disabled (${err.message})`);
  }

  // Sync GranularManager state from MongoDB — overwrites the local file
  // fallback with the authoritative DB copy so deploy-time file wipes
  // don't reset the enabled/disabled state of commands, events and systems.
  await granularManager.syncFromDB().catch(err =>
    console.warn('[GranularManager] syncFromDB non-fatal at boot:', err.message)
  );

  // 2b. CB manager — runs inline on this server alongside the main bot.
  logStep('CB', 'Starting CB manager inline…', theme.cyan);
  customBrandingManager.init(client).catch(err =>
    logError(`[CB-Manager] Init error: ${err.message}`)
  );

  // 3. Connect to Discord (CB bots already logging in in background)
  logStep('AUTH', 'Connecting to Discord…', theme.magenta);
  try {
    await client.login(process.env.token);
    logOk('Logged in to Discord.');
  } catch (err) {
    logError(`Discord login failed: ${err.message}`);
    process.exit(1);
  }

  // 3b. Internal API — start immediately after login so the standalone dashboard
  //     can reconnect within seconds instead of waiting for music/systems to boot.
  await moduleManager.start('internal-api',  client);

  // Keep the top.gg server count accurate (needs TOP_GG_TOKEN)
  require('./src/lib/topggStats')(client);
  require('./src/lib/changelogAnnouncer')(client);

  // 3. Music (needs shard context)
  await moduleManager.start('music', client);

  // 4. Systems & API
  await moduleManager.start('systems',       client);
  await moduleManager.start('api-server',    client);
  await moduleManager.start('cron',          client);
  await moduleManager.start('log-handlers',  client);

  // 4b. WSS Status server — real-time status push to connected clients
  logStep('WSS', 'Starting WebSocket status server…', theme.cyan);
  try {
    _wssServer = new StatusWebSocketServer(client);
    await _wssServer.start();
    client._wssServer = _wssServer;
    logOk(`WSS status server listening on ws://127.0.0.1:5185/status`);
  } catch (err) {
    logError(`WSS status server failed to start: ${err.message}`);
  }

  // 5. Dashboard — only start inline if NOT in standalone PM2 mode
  //    When DASHBOARD_MODE=standalone the dashboard runs as its own process (noxx-dashboard)
  if (process.env.DASHBOARD_MODE !== 'standalone') {
    logStep('DASHBOARD', 'Starting dashboard (inline/isolated mode)…', theme.green);
    await moduleManager.start('dashboard', client);
  } else {
    logInfo('[DASHBOARD] Standalone mode — dashboard runs as separate process.');
  }

  // 6. MongoDB connection is already established above (step 2)

  // 7. Health-check & module-status server
  const { collectStatus, lookupGuild } = require('./src/ws/statusCollector');
  const healthApp = express();
  healthApp.get('/', (_req, res) => res.send('Roco is alive <a:tickyy:1555544712687915008>'));
  healthApp.get('/health', (_req, res) => {
    const status = collectStatus(client);
    res.json(status);
  });
  healthApp.get('/modules', (_req, res) => res.json(moduleManager.getAllStatus()));
  healthApp.get('/lookup/:guildId', (req, res) => {
    if (!/^\d{17,20}$/.test(req.params.guildId))
      return res.status(400).json({ error: 'Invalid guild ID.' });
    const result = lookupGuild(client, req.params.guildId);
    res.json(result);
  });

  const PORT = 2585;
  healthApp.listen(PORT, '127.0.0.1', () => {
    logStep('READY',
      `<a:tickyy:1555544712687915008>  System active on port ${PORT}  |  WSS: ws://127.0.0.1:5185/status  |  boot: ${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      theme.green
    );
  });
})();

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[SHUTDOWN] ${signal} — stopping all modules…`);
  try {
    if (_wssServer) await _wssServer.stop();
    await moduleManager.stopAll();
    await client.destroy();
    // No mongoose.disconnect(): background timers may still be querying and
    // would log MongoNotConnectedError; process.exit closes the socket anyway.
    const { closeClient } = require('./src/lib/redis');
    await closeClient();
  } catch {}
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = client;