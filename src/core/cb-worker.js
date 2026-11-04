"use strict";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           CUSTOM BRANDING WORKER  v3.1                      ║
 * ║                                                             ║
 * ║  Runs as a child_process.fork() — one per CB bot.          ║
 * ║  Communicates with CustomBrandingManager via IPC.          ║
 * ║                                                             ║
 * ║  Incoming IPC messages (from manager → worker):            ║
 * ║    { type: 'start',  guildId, token, config }              ║
 * ║    { type: 'stop'  }                                        ║
 * ║    { type: 'updatePresence', config }                       ║
 * ║    { type: 'RELOAD_COMMANDS' }                             ║
 * ║    { type: 'REST_PROXY', corrId, method, route, body }     ║
 * ║                                                             ║
 * ║  Outgoing IPC messages (worker → manager):                 ║
 * ║    { type: 'state',  state, botTag, ping, uptime }         ║
 * ║    { type: 'error',  message }                             ║
 * ║    { type: 'ready',  botTag, botId }                       ║
 * ║    { type: 'ping',   value }                               ║
 * ║    { type: 'restResult', corrId, restResult }              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require("dotenv").config();
// Use a unique pre-start identity so early logs (before the 'start' IPC
// message arrives with the real guildId) are never stored under the bare
// 'CB' namespace that cb-manager-standalone.js also uses.  If the pre-start
// identity were 'CB', the manager's flush loop would pick up these orphaned
// worker logs and mix them into the CB manager's Discord batches.
// We use the worker's PID as a unique suffix; it is replaced with the real
// CB_<guildId> identity as soon as the 'start' IPC message is received.
process.env.LOG_PROCESS_NAME = `CB_INIT_${process.pid}`;
require("../../Utils/logs"); // hook console.* → CB webhook

// ── Async event crash protection ──────────────────────────────────────────────
require('../../Utils/patchAsyncEvents').patchAsyncEvents();
require('../../Utils/componentExpiry').install();

const {
  Client, GatewayIntentBits, Partials, Collection,
  ActivityType, REST, Routes, SlashCommandBuilder,
} = require("discord.js");
const djs = require("discord.js");
for (const [key, val] of Object.entries(djs)) {
  if (global[key] === undefined) global[key] = val;
}
const mongoose = require("mongoose");

// ── Schema imports ─────────────────────────────────────────────────────────────
const CustomBranding   = require("../../Schemas/customBrandingSchema");
const CustomCommand    = require("../../Schemas/customCommandSchema");
const { decryptToken } = require("../../Utils/tokenCrypto");

// ── Interaction handlers (shared with main bot) ────────────────────────────────
const handleModal        = require("../../Events/Client/interaction/modal");
const handleButton       = require("../../Events/Client/interaction/button");
const handleSlashCommand = require("../../Events/Client/interaction/slash");
const handleError        = require("../../Events/Client/interaction/error");
const { handleCustomCommand } = require("../../Utils/customcommandshandler");
const { patchCBClient, preloadCBEmojis } = require("../../Utils/cbEmojiResolver");

// ── Constants ──────────────────────────────────────────────────────────────────
// Reconnect: exponential backoff with jitter, base 15 s, cap 5 min.
const RECONNECT_BASE_MS   = 15_000;
const RECONNECT_CAP_MS    = 5 * 60_000;
const MAX_RECONNECT_TRIES = 5;
const PING_INTERVAL_MS    = 30_000;

// How long after gateway READY to wait before hitting the REST API.
// Gives Discord's edge nodes time to propagate the new session.
const POST_READY_DELAY_MS = 3_000;

// Command registration is heavily rate-limited by Discord.
// Delay between global PUT and guild PUT to avoid back-to-back hammer.
const CMD_REG_INTER_DELAY_MS = 2_000;

// Fixed fallback shown when no custom status is configured
const CB_ACTIVITY_DEFAULT = { type: ActivityType.Watching, name: 'Custom Branding Roco' };

// Map dashboard statusType strings → discord.js ActivityType integers
const ACTIVITY_TYPE_MAP = {
  watching:    ActivityType.Watching,
  playing:     ActivityType.Playing,
  listening:   ActivityType.Listening,
  competing:   ActivityType.Competing,
  custom:      ActivityType.Custom,
};

// ── State ──────────────────────────────────────────────────────────────────────
let guildId        = null;
let token          = null;
let config         = null;
let mainClientStub = null;   // lightweight stub for handlers
let cbClient       = null;
let launchedAt     = null;
let reconnectCount = 0;
let stopping       = false;
let pingTimer      = null;
let _initialized   = false;    // true after emoji preloading completes

// Reuse a single REST instance per worker to share the built-in rate-limit
// bucket tracking that discord.js's REST manager provides.
// Recreated whenever the token changes (i.e. on re-setup).
let _rest = null;
function getRESTClient() {
  if (!_rest) _rest = new REST({ version: "10" }).setToken(token);
  return _rest;
}

// Cache of the last command payload hash so we skip re-registration when nothing changed.
let _lastGlobalCmdHash   = null;
let _lastGuildCmdHash    = null;

// Only send the "bot is online" alert once per worker lifetime — not on every reconnect.
let _hasAlertedOnline = false;

// Resolved tick emoji for this CB bot's own application emoji cache.
// Falls back to ✅ if the emoji isn't found (e.g. bot hasn't uploaded it yet).
let _cbTick = '✅';

// ── IPC send ───────────────────────────────────────────────────────────────────
function send(msg) {
  if (!process.send) return;
  try {
    process.send(msg);
  } catch (e) {
    // IPC channel may be closed during shutdown/restart — swallow silently.
    if (e.code !== "ERR_IPC_CHANNEL_CLOSED") throw e;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Sleep for `ms` milliseconds. */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Jittered exponential backoff delay.
 * delay = min(base * 2^attempt, cap) ± 20% jitter
 */
function backoffDelay(attempt, baseMs = RECONNECT_BASE_MS, capMs = RECONNECT_CAP_MS) {
  const expo   = Math.min(baseMs * (2 ** attempt), capMs);
  const jitter = expo * 0.2 * (Math.random() * 2 - 1); // ±20%
  return Math.round(expo + jitter);
}

/**
 * Stable JSON hash — stringify keys in sorted order so reordering doesn't
 * look like a change.
 */
function stableHash(obj) {
  return JSON.stringify(obj, Object.keys(obj ?? {}).sort());
}

/**
 * Retry an async function up to `tries` times with exponential backoff.
 * Respects Discord's Retry-After header when available.
 * @param {() => Promise<any>} fn
 * @param {string}             label   For logging
 * @param {number}             tries
 */
async function withRetry(fn, label, tries = 4) {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === tries - 1;
      // discord.js throws DiscordAPIError with .status and .rawError
      const status     = err.status ?? err.httpStatus ?? 0;
      const retryAfter = err.rawError?.retry_after ?? err.retryAfter ?? null;

      if (status === 429) {
        // Rate-limited: respect the Retry-After header
        const waitMs = retryAfter != null
          ? Math.ceil(retryAfter * 1000)
          : backoffDelay(attempt, 5_000, 60_000);
        console.warn(`[CB-Worker:${guildId}] ${label} rate-limited — waiting ${(waitMs / 1000).toFixed(1)}s (attempt ${attempt + 1}/${tries})`);
        if (!isLast) { await sleep(waitMs); continue; }
      } else if (!isLast && (status >= 500 || status === 0)) {
        // Transient server-side or network error — backoff then retry
        const waitMs = backoffDelay(attempt, 2_000, 30_000);
        console.warn(`[CB-Worker:${guildId}] ${label} transient error (${status || err.code || err.message}) — retrying in ${(waitMs / 1000).toFixed(1)}s`);
        await sleep(waitMs);
        continue;
      }

      // Non-retryable or exhausted retries — rethrow
      throw err;
    }
  }
}


async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.mongodbURL || process.env.MONGO_URI || process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
}

// ── Load all command handlers into a Collection ────────────────────────────────
function loadCommandHandlers() {
  const fs   = require("fs");
  const path = require("path");
  const cmds = new Collection();
  const commandsPath = path.join(__dirname, "..", "..", "Commands");

  try {
    const folders = fs.readdirSync(commandsPath)
      .filter(f => fs.statSync(path.join(commandsPath, f)).isDirectory());

    for (const folder of folders) {
      const folderPath = path.join(commandsPath, folder);
      for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith(".js"))) {
        try {
          const cmd = require(path.join(folderPath, file));
          if (cmd?.data && typeof cmd.execute === "function") {
            cmd.category = folder;
            cmds.set(cmd.data.name, cmd);
          }
        } catch (e) {
          console.warn(`[CB-Worker] Failed to load command ${file}: ${e.message}`);
        }
      }
    }
    console.log(`[CB-Worker:${guildId}] Loaded ${cmds.size} command handlers`);
  } catch (e) {
    console.error(`[CB-Worker] Failed to load commands directory: ${e.message}`);
  }
  return cmds;
}

// ── Build a minimal stub so interaction handlers don't crash ──────────────────
function buildMainStub() {
  // Load Roco's config.js directly — cb-worker is a forked child process and
  // does NOT share memory with the parent bot.  require("./client") was returning
  // an empty module (client.js is a 0-byte placeholder) so .config was always
  // undefined.  Loading config.js directly gives us all API keys, prefix, etc.
  let noxxConfig = {};
  try {
    const _cfg = require("../config/bot");
    if (_cfg && typeof _cfg === "object") {
      noxxConfig = _cfg;
    } else {
      console.error(`[CB-Worker:${guildId}] config.js did not export a valid object.`);
    }
  } catch (e) {
    console.error(`[CB-Worker:${guildId}] Failed to load config.js: ${e.message}`);
  }

  // Key-level .env fallbacks — mirrors index.js so CB bots benefit from the
  // same env vars even if config.js is incomplete.
  const _env = process.env;
  const _defaults = {
    embedColor:   _env.embedColor          || "#6C53FF",
    embed:        _env.embedColor          || "#6C53FF",
    // prefix: removed
    gemini_api:   _env.GEMINI_API_KEY      || _env.gemini_api,
    imageGenAPI:  _env.IMAGE_GEN_API_KEY   || _env.imageGenAPI,
    logchannel:   _env.LOG_CHANNEL_ID      || _env.logchannel,
    clientId:     _env.clientId            || _env.CLIENT_ID,
    status:       _env.BOT_STATUS          || _env.status    || "online",
    activity:     _env.BOT_ACTIVITY        || _env.activity   || "Roco",
    botsuggestions: _env.BOT_SUGGESTIONS_CHANNEL || _env.botsuggestions,
    bugreport:    _env.BUG_REPORT_CHANNEL  || _env.bugreport,
    feedback:     _env.FEEDBACK_CHANNEL    || _env.feedback,
    dev:          _env.DEV_USER_ID         || _env.dev,
  };
  for (const [key, fallback] of Object.entries(_defaults)) {
    if ((noxxConfig[key] === undefined || noxxConfig[key] === null) && fallback != null) {
      noxxConfig[key] = fallback;
    }
  }

  const cbConfig = {
    ...noxxConfig,
    // CB overrides — only set if the guild has configured them
    ...(config?.embedColor  ? { embedColor:  config.embedColor  } : {}),
    ...(config?.footerText  ? { footerText:  config.footerText  } : {}),
    ...(config?.botName     ? { botName:     config.botName     } : {}),
    // Never log CB bot command usage to Roco's logging channels
    slashCommandLoggingChannel: null,
  };

  return {
    commands:        loadCommandHandlers(),
    config:          cbConfig,
    moduleManager:   null,
    granularManager: null,
    webhook:         null,
  };
}

// ── Spawn Discord client ───────────────────────────────────────────────────────
async function spawnClient() {
  if (stopping) return;

  cbClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildEmojisAndStickers,
    ],
    partials: [
      Partials.Message, Partials.Channel, Partials.GuildMember,
      Partials.Reaction, Partials.User,
    ],
  });

  // Raise the listener limit before any events are attached —
  // mirrorEvents() registers one listener per event file, easily exceeding
  // Node's default of 10 and triggering MaxListenersExceededWarning.
  cbClient.setMaxListeners(100);

  // Shared references so handlers work unchanged
  cbClient._cbGuildId      = guildId;
  cbClient._isCBClient     = true;
  cbClient._mainClient     = mainClientStub;
  cbClient.commands        = mainClientStub.commands;
  cbClient.config          = mainClientStub.config;
  cbClient.moduleManager   = null;
  cbClient.granularManager = null;
  cbClient.webhook         = null;
  cbClient.music           = null;

  // Monkey-patch send/reply/edit to auto-rewrite emoji IDs on every outbound
  // payload — catches hardcoded emoji strings that the E/B module cache patch
  // (done in the ready handler) cannot reach.
  patchCBClient(cbClient);

  // ── Ready ────────────────────────────────────────────────────────────────────
  cbClient.once("clientReady", async () => {
    launchedAt     = Date.now();
    reconnectCount = 0;

    const curAvatar = cbClient.user.avatar ?? null;
    send({ type: "ready",  botTag: cbClient.user.tag, botId: cbClient.user.id, botAvatar: curAvatar });
    // Send "starting" — manager won't suppress the main bot's responses yet.
    // "running" is sent after emoji preloading is complete so the main bot
    // falls back while this CB bot is still loading emojis into its store.
    send({ type: "state",  state: "starting", botTag: cbClient.user.tag, ping: cbClient.ws.ping, uptime: 0, botAvatar: curAvatar });

    // Seed the last-applied cache from the bot's ACTUAL current username/avatar
    // so applyIdentity() skips the Discord PATCH if nothing has changed.
    // Without this, every restart attempts a rename and hits the rate limit.
    _lastAppliedName = cbClient.user.username ?? null;

    // Presence is purely local (no REST call) — safe to apply immediately.
    applyPresence();

    // ── Post-ready REST delay ─────────────────────────────────────────────────
    // Wait before making any REST calls. Discord's edge servers need time to
    // fully propagate the new gateway session. Hitting REST immediately after
    // login (especially when many CB bots start concurrently) causes extra
    // 429s and occasional "Unknown Interaction" errors from stale sessions.
    await sleep(POST_READY_DELAY_MS);

    // Guild enforcement — leave any guilds this bot shouldn't be in.
    await enforceGuildLock();

    // Seed invite cache so guildMemberAdd_invite resolves correctly from the
    // very first join after this worker starts.  Without this, the "before"
    // state is an empty Map and invite attribution silently fails until the
    // next inviteCreate/inviteDelete event repopulates the cache naturally.
    try {
      const inviteCache = require('../../Utils/inviteCache');
      const guild = cbClient.guilds.cache.get(guildId);
      if (guild) {
        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) {
          const map = new Map();
          invites.forEach(inv => map.set(inv.code, {
            code:      inv.code,
            uses:      inv.uses ?? 0,
            inviterId: inv.inviter?.id ?? null,
          }));
          inviteCache.set(guildId, map);
          console.log(`[CB-Worker:${guildId}] Invite cache seeded with ${map.size} invite(s)`);
        }
      }
    } catch (e) {
      console.warn(`[CB-Worker:${guildId}] Failed to seed invite cache: ${e.message}`);
    }

    // Identity (username/avatar PATCH) — done before commands so any username
    // change is visible when users first see the bot respond.
    await applyIdentity();

    // Short pause between identity PATCH and command registration so we don't
    // slam two separate REST routes in rapid succession.
    await sleep(CMD_REG_INTER_DELAY_MS);

    // Command registration — diff-checked inside, skips if nothing changed.
    await registerAllCommands();

    // Start log handlers (same as the log-handlers module does for the main bot,
    // but without uptimePinger which is Roco-infrastructure only)
    try {
      const { handleLogs } = require("../../Events/Others/logsmain");
      handleLogs(cbClient);
      console.log(`[CB-Worker:${guildId}] Log handlers attached`);
    } catch (e) {
      console.warn(`[CB-Worker:${guildId}] Log handlers failed to load: ${e.message}`);
    }

    // ── Emoji preloading ──────────────────────────────────────────────────────
    // Resolve this CB bot's own application emojis so all commands and embeds
    // render correctly.  Each CB bot is a separate Discord application and has
    // its own emoji IDs — the main bot's hardcoded IDs mean nothing here.
    // We patch the shared E/B objects in the module cache (safe because this
    // is a separate worker process — the main bot is unaffected).
    try {
      const appEmojis = await cbClient.application.emojis.fetch();

      // ── tick for the online alert ────────────────────────────────────────
      const tickEmoji = appEmojis.find(e => e.name === 'tickyy');
      if (tickEmoji) _cbTick = tickEmoji.animated
        ? `<a:${tickEmoji.name}:${tickEmoji.id}>`
        : `<:${tickEmoji.name}:${tickEmoji.id}>`;

      // ── patch every emoji in E and B with this bot's real IDs ───────────
      const { E, B } = require('../../Utils/emojis');
      for (const emoji of appEmojis.values()) {
        // E  — text strings like  <:name:id>  or  <a:name:id>
        for (const [key, val] of Object.entries(E)) {
          if (typeof val !== 'string') continue;
          const m = val.match(/^<(a?):([^:>]+):(\d+)>$/);
          if (m && m[2] === emoji.name) {
            E[key] = emoji.animated
              ? `<a:${emoji.name}:${emoji.id}>`
              : `<:${emoji.name}:${emoji.id}>`;
          }
        }
        // B  — button objects  { id, name, animated }
        for (const [key, val] of Object.entries(B)) {
          if (val && typeof val === 'object' && val.name === emoji.name) {
            B[key] = { id: emoji.id, name: emoji.name, animated: emoji.animated ?? false };
          }
        }
      }
    } catch { /* keep hardcoded fallbacks */ }

    // Proactively upload all E.* emojis to this CB bot's application emoji
    // store so the lazy monkey-patch (patchCBClient) never needs to download
    // and upload an emoji on the user's first command — it'll find it cached.
    // AWAITED — the bot stays in "starting" state until preloading finishes,
    // so the main bot handles interactions as fallback during this window.
    await preloadCBEmojis(cbClient, require('../../Utils/emojis').E).catch(() => {});
    _initialized = true;

    // ── Mark fully ready ─────────────────────────────────────────────────────
    // All expensive initialisation (emojis, commands, identity) is done.
    // The manager now knows this CB bot can handle interactions.
    send({ type: "state", state: "running", botTag: cbClient.user.tag, ping: cbClient.ws.ping, uptime: 0, botAvatar: curAvatar });

    await CustomBranding.updateOne(
      { guildId },
      { setupState: "active", setupError: null, botClientId: cbClient.user.id }
    ).catch(() => {});

    // Only alert once per worker lifetime — reconnects re-fire this ready
    // handler but the bot was never truly "offline" from the user's perspective.
    if (!_hasAlertedOnline) {
      _hasAlertedOnline = true;
      await sendAlert(`${_cbTick} Custom branded bot is now **online**!`);
    }

    // Periodic ping reporting
    pingTimer = setInterval(() => {
      if (cbClient?.ws) send({ type: "ping", value: cbClient.ws.ping });
    }, PING_INTERVAL_MS);
  });

  // ── Leave wrong guilds ───────────────────────────────────────────────────────
  cbClient.on("guildCreate", async (guild) => {
    if (guild.id !== guildId) {
      await guild.leave().catch(() => {});
    }
  });

  // ── Interactions ─────────────────────────────────────────────────────────────
  cbClient.on("interactionCreate", async (interaction) => {
    try { await handleInteraction(interaction); }
    catch (err) {
      console.error(`[CB-Worker:${guildId}] Interaction error:`, err.message);
      // Always acknowledge so the user never sees "The application did not respond"
      try {
        if (interaction.isRepliable() && !interaction.deferred && !interaction.replied) {
          await interaction.reply({ content: 'An unexpected error occurred. Please try again.', flags: 64 });
        }
      } catch { /* interaction already gone */ }
    }
  });

  // ── Mirror other events ──────────────────────────────────────────────────────
  mirrorEvents();
  loadSystems();

  // ── Error / disconnect ───────────────────────────────────────────────────────
  cbClient.on("error", (err) => {
    console.error(`[CB-Worker:${guildId}] Client error:`, err.message);
    send({ type: "error", message: err.message });
  });

  cbClient.on("shardDisconnect", (event) => {
    if (stopping) return;
    console.warn(`[CB-Worker:${guildId}] Disconnected (code ${event.code})`);
    send({ type: "state", state: "reconnecting" });
    scheduleReconnect();
  });

  // ── Login ────────────────────────────────────────────────────────────────────
  try {
    await cbClient.login(token);
  } catch (err) {
    const friendly = friendlyLoginError(err.message);
    send({ type: "state", state: "error", error: friendly });
    await CustomBranding.updateOne({ guildId }, { setupState: "error", setupError: friendly }).catch(() => {});
    console.error(`[CB-Worker:${guildId}] Login failed:`, friendly);
    // Auth errors (invalid token, wrong intents) are permanent — mark error and exit so manager
    // can surface the issue to the user. Network/transient errors get auto-retried.
    const isPermanent = err.message?.includes("TOKEN_INVALID")
      || err.message?.includes("401")
      || err.message?.includes("disallowed intents")
      || err.message?.includes("4014");
    if (isPermanent) {
      process.exit(1);
    } else {
      console.warn(`[CB-Worker:${guildId}] Login error appears transient — scheduling reconnect.`);
      scheduleReconnect();
    }
  }
}

// ── Guild lock ─────────────────────────────────────────────────────────────────
async function enforceGuildLock() {
  for (const [id, guild] of cbClient.guilds.cache) {
    if (id !== guildId) await guild.leave().catch(() => {});
  }
}

// ── Presence — uses config statusText/statusType when set ────────────────────
function applyPresence() {
  if (!cbClient?.user) return;
  try {
    let activity = CB_ACTIVITY_DEFAULT;
    if (config?.statusText) {
      const actType = ACTIVITY_TYPE_MAP[(config.statusType || '').toLowerCase()] ?? ActivityType.Watching;
      activity = { type: actType, name: config.statusText };
    }
    // Presence status (online/idle/dnd/invisible) — default to online
    const presenceStatus = ['online', 'idle', 'dnd', 'invisible'].includes(config?.onlineStatus)
      ? config.onlineStatus : 'online';
    cbClient.user.setPresence({ status: presenceStatus, activities: [activity] });
  } catch {}
}

// ── Identity — update username and/or avatar via direct REST PATCH ─────────────
// Discord.js's client.user.edit() can silently fail in worker contexts.
// We PATCH /users/@me directly using our own REST instance instead.
// Discord rate-limits username edits to 2/hour — only call when value changed.
let _lastAppliedName   = null;
let _lastAppliedAvatar = null;

function discordErrMessage(err) {
  // discord.js REST throws DiscordAPIError — rawError has the full Discord body
  const raw = err.rawError ?? err.body;
  if (raw) {
    // raw.message is the top-level Discord message e.g. "Invalid Form Body"
    // raw.errors has per-field detail e.g. { username: { _errors: [{ message: "..." }] } }
    const parts = [raw.message].filter(Boolean);
    if (raw.errors) {
      const walk = (obj, path = "") => {
        for (const [k, v] of Object.entries(obj)) {
          if (k === "_errors" && Array.isArray(v)) {
            v.forEach(e => parts.push(path ? `${path}: ${e.message}` : e.message));
          } else if (typeof v === "object" && v !== null) {
            walk(v, path ? `${path}.${k}` : k);
          }
        }
      };
      walk(raw.errors);
    }
    return parts.join(" — ") || err.message;
  }
  // HTTP status codes Discord commonly returns
  if (err.status === 429) return `Rate limited — Discord only allows 2 username changes per hour`;
  if (err.status === 400) return `Bad request — check username (2–32 chars) or avatar URL`;
  return err.message;
}

async function applyIdentity() {
  if (!token || !config) return;

  const wantName   = config.botName?.trim()   || null;
  const wantAvatar = config.avatarUrl?.trim() || null;

  const nameChanged   = wantName   !== null && wantName   !== _lastAppliedName;
  const avatarChanged = wantAvatar !== null && wantAvatar !== _lastAppliedAvatar;

  if (!nameChanged && !avatarChanged) return;

  const body = {};
  if (nameChanged) body.username = wantName;

  if (avatarChanged) {
    try {
      const resp = await fetch(wantAvatar);
      if (resp.ok) {
        const buf  = await resp.arrayBuffer();
        const mime = resp.headers.get("content-type") || "image/png";
        body.avatar = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
      } else {
        const msg = `Avatar fetch failed (HTTP ${resp.status}) — check the URL is a direct image link`;
        console.warn(`[CB-Worker:${guildId}] ${msg}`);
        send({ type: "identityError", message: msg });
      }
    } catch (e) {
      const msg = `Avatar fetch error: ${e.message}`;
      console.warn(`[CB-Worker:${guildId}] ${msg}`);
      send({ type: "identityError", message: msg });
    }
  }

  if (!Object.keys(body).length) return;

  try {
    // Use the shared REST client (rate-limit bucket tracking is preserved)
    // and retry on 429/5xx with respect for Retry-After.
    const result = await withRetry(
      () => getRESTClient().patch("/users/@me", { body }),
      "identity PATCH",
      3  // username edits are rate-limited to 2/hour — don't spam retries
    );
    if (nameChanged)   _lastAppliedName   = wantName;
    if (avatarChanged) {
      _lastAppliedAvatar = wantAvatar;
      // Send updated avatar hash so the manager can reflect it in status
      const newAvatar = result?.avatar ?? null;
      send({ type: "state", state: "running", botTag: cbClient.user.tag, ping: cbClient.ws.ping, uptime: Date.now() - launchedAt, botAvatar: newAvatar });
    }
    console.log(`[CB-Worker:${guildId}] Identity updated — username: ${wantName ?? "(unchanged)"}, avatar: ${avatarChanged}`);
    send({ type: "identityOk", username: wantName, avatarChanged });
  } catch (err) {
    const friendly = discordErrMessage(err);
    console.error(`[CB-Worker:${guildId}] Identity update failed: ${friendly}`);
    send({ type: "identityError", message: friendly });
  }
}

// ── Command registration ───────────────────────────────────────────────────────
// Uses a stable hash to diff against the last registered payload so we skip
// the expensive PUT when nothing has changed (avoids hammering Discord on every
// reconnect / process restart when commands are identical).
// 
// Logic:
// - No GuildCommands doc = all commands enabled (default)
// - enabledCommands = [] (empty) = all disabled
// - enabledCommands = ["cmd1", "cmd2"] = only those enabled
async function registerAllCommands() {
  if (!cbClient?.isReady()) return;
  const rest  = getRESTClient();
  const appId = cbClient.user.id;

  // Fetch which Roco commands are enabled for this guild from GuildCommandsSchema
  let enabledCommands = null; // null = all enabled, [] = none enabled, [items] = only those
  let commandDescriptions = {};
  console.log(`[CB-Worker] registerAllCommands starting for guildId: ${guildId}`);
  try {
    const GuildCommands = require('../../Schemas/Guildcommandsschema');
    const gCmd = await GuildCommands.findOne({ guildId }).lean();
    if (gCmd) {
      enabledCommands = gCmd.enabledCommands; // can be undefined, [], or array
      commandDescriptions = gCmd.commandDescriptions || {};
      console.log(`[CB-Worker] Found GuildCommands doc for ${guildId}: enabledCommands =`, enabledCommands);
    } else {
      console.log(`[CB-Worker] No GuildCommands doc found for ${guildId} - will enable all commands`);
    }
  } catch (err) {
    console.error(`[CB-Worker] Error fetching GuildCommands for ${guildId}:`, err.message);
  }

  // ── 1. Global commands (Roco slash commands registered on the CB bot's app) ──
  try {
    const cmdPath = require.resolve("../data/registeredCommands.json");
    delete require.cache[cmdPath];
    const registered = require("../data/registeredCommands.json");

    console.log(`[CB-Worker:${guildId}] registerAllCommands: enabledCommands =`, enabledCommands, '| total in JSON:', registered?.length);

    if (Array.isArray(registered) && registered.length) {
      // Filter based on enabledCommands config
      let filtered;
      if (enabledCommands === null || enabledCommands === undefined) {
        // No config = all enabled (default)
        filtered = registered;
      } else if (enabledCommands.length === 0) {
        // Empty array = all disabled
        filtered = [];
      } else {
        // Specific commands enabled
        filtered = registered.filter(cmd => enabledCommands.includes(cmd.name));
      }
      
      // Apply description overrides
      filtered = filtered.map(cmd => {
        const overrides = commandDescriptions?.[cmd.name];
        if (!overrides) return cmd;
        return { ...cmd, description: overrides.description || cmd.description };
      });

      // Discord hard cap: max 100 global application commands per bot.
      // Guilds with no GuildCommands doc (enabledCommands = null) default to
      // "all enabled" which can exceed 100 and cause the PUT to fail entirely.
      // Truncate here so the registration always succeeds; server owners can
      // use the dashboard to select a specific subset if they need commands
      // that were cut off.
      if (filtered.length > 100) {
        console.warn(`[CB-Worker:${guildId}] Command list (${filtered.length}) exceeds Discord's 100-command limit — truncating to 100.`);
        filtered = filtered.slice(0, 100);
      }

      const hash = stableHash(filtered);

      if (hash !== _lastGlobalCmdHash) {
        await withRetry(
          () => rest.put(Routes.applicationCommands(appId), { body: filtered }),
          "global command PUT"
        );
        _lastGlobalCmdHash = hash;
        console.log(`[CB-Worker:${guildId}] Registered ${filtered.length} global commands (enabledCommands: ${enabledCommands?.length ?? 'all'})`);
      } else {
        console.log(`[CB-Worker:${guildId}] Global commands unchanged — skipping PUT`);
      }
    }
  } catch (err) {
    console.error(`[CB-Worker:${guildId}] Global cmd registration failed:`, err.message);
  }

  // ── 2. Guild-scoped custom commands ──────────────────────────────────────────
  //    Short delay between the global PUT and the guild PUT to avoid hitting
  //    two different rate-limit buckets back-to-back.
  await sleep(CMD_REG_INTER_DELAY_MS);

  try {
    const customCmds = await CustomCommand.find({ Guild: guildId, Enabled: { $ne: false } }).lean();

    if (!customCmds.length) {
      // If there were commands before but now there are none, clear the guild registration.
      if (_lastGuildCmdHash !== null && _lastGuildCmdHash !== "empty") {
        await withRetry(
          () => rest.put(Routes.applicationGuildCommands(appId, guildId), { body: [] }),
          "guild command clear"
        );
        _lastGuildCmdHash = "empty";
        console.log(`[CB-Worker:${guildId}] Cleared guild-scoped custom commands`);
      }
      return;
    }

    const builtCmds = [];
    for (const cmd of customCmds) {
      try {
        const builder = new SlashCommandBuilder()
          .setName(cmd.Name.toLowerCase().replace(/\s+/g, "-"))
          .setDescription(cmd.Description || "A custom command");
        for (const arg of (cmd.Arguments || [])) addArgToBuilder(builder, arg);
        builtCmds.push(builder.toJSON());
      } catch (e) {
        console.warn(`[CB-Worker:${guildId}] Skipping custom cmd "${cmd.Name}":`, e.message);
      }
    }

    if (builtCmds.length) {
      const hash = stableHash(builtCmds);
      if (hash !== _lastGuildCmdHash) {
        await withRetry(
          () => rest.put(Routes.applicationGuildCommands(appId, guildId), { body: builtCmds }),
          "guild command PUT"
        );
        _lastGuildCmdHash = hash;
        console.log(`[CB-Worker:${guildId}] Registered ${builtCmds.length} guild-scoped custom commands`);
      } else {
        console.log(`[CB-Worker:${guildId}] Guild commands unchanged — skipping PUT`);
      }
    }
  } catch (err) {
    console.warn(`[CB-Worker:${guildId}] Custom cmd registration failed:`, err.message);
  }
}

function addArgToBuilder(builder, arg) {
  const name = arg.name.toLowerCase().replace(/\s+/g, "-");
  const desc = arg.description || "An argument";
  const req  = arg.required ?? false;
  switch (arg.type) {
    case "INTEGER":     builder.addIntegerOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "NUMBER":      builder.addNumberOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "BOOLEAN":     builder.addBooleanOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "USER":        builder.addUserOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "CHANNEL":     builder.addChannelOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "ROLE":        builder.addRoleOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "ATTACHMENT":  builder.addAttachmentOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    case "MENTIONABLE": builder.addMentionableOption(o => o.setName(name).setDescription(desc).setRequired(req)); break;
    default:            builder.addStringOption(o => o.setName(name).setDescription(desc).setRequired(req));
  }
}

// ── Interaction handling ───────────────────────────────────────────────────────
async function handleInteraction(interaction) {
  // While emoji preloading is in progress, let the main bot handle interactions.
  // This avoids timeouts caused by on-demand emoji resolution in reply().
  if (!_initialized) return;

  try {
    // ── Ticket interactions ───────────────────────────────────────────────────
    // Ticket panels are sent by the CB bot (via cbSend), so Discord routes all
    // interactions from those messages back here. ticketActions.js owns all
    // ticket interaction logic — call it directly instead of the generic routers
    // which have no ticket routing at all.
    const customId = interaction.customId ?? '';
    const isTicketInteraction =
      (interaction.isStringSelectMenu() && (customId === 'ticket-dropdown' || customId === 'ticket-tag-select')) ||
      (interaction.isUserSelectMenu()   && (customId === 'ticket-manage-menu' || customId === 'ticket-assign-menu')) ||
      (interaction.isButton()           && (customId.startsWith('ticket-') || customId.startsWith('ticket_')));

    if (isTicketInteraction) {
      const { handleTicketInteraction } = require('../../Events/Ticket/ticketActions');
      return await handleTicketInteraction(interaction, cbClient);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Staff application interactions ────────────────────────────────────────
    // Mirror the main bot's interactions.js which calls staffApps.execute() for
    // every interaction so staffapp_apply / staffapp_accept / staffapp_deny
    // buttons and modals work on CB bots instead of silently deferring.
    // Gate on the staffapp_ prefix so we only pay the require cost when needed,
    // and return early so the generic button/modal routers below don't double-fire.
    if (customId.startsWith('staffapp_')) {
      try {
        const staffApps = require('../../Events/Interaction/staffApplications');
        await staffApps.execute(interaction);
      } catch (err) {
        console.error(`[CB-Worker:${guildId}] staffApps error:`, err.message);
        await handleError(interaction, cbClient, err).catch(() => {});
      }
      return;
    }

    // ── Suggestion vote / review buttons ──────────────────────────────────────
    // suggestions.js registers its interactionCreate listener through handelEvents.js
    // which gates on cbMgr.isActive() — so that listener never fires for CB guilds.
    // Call handleSuggestionButton directly so vote and review buttons work on CB bots.
    if (
      interaction.isButton() && (
        customId.startsWith('suggest_up_') ||
        customId.startsWith('suggest_down_') ||
        customId.startsWith('suggest_approve_') ||
        customId.startsWith('suggest_reject_') ||
        customId.startsWith('suggest_implement_')
      )
    ) {
      try {
        const { handleSuggestionButton } = require('../../Events/Others/suggestions');
        await handleSuggestionButton(interaction, cbClient);
      } catch (err) {
        console.error(`[CB-Worker:${guildId}] suggestion button error:`, err.message);
        await handleError(interaction, cbClient, err).catch(() => {});
      }
      return;
    }

    if (await handleCustomCommand(interaction, cbClient)) return;
    if (interaction.isModalSubmit())     return await handleModal(interaction, cbClient);
    if (interaction.isButton())          return await handleButton(interaction, cbClient, null);
    if (interaction.isAnySelectMenu())   return await handleSelectMenu(interaction);
    if (interaction.isChatInputCommand()) return await handleSlashCommand(interaction, cbClient);
    if (interaction.isAutocomplete()) {
      const cmd = cbClient.commands?.get(interaction.commandName);
      if (cmd?.autocomplete) await cmd.autocomplete(interaction, cbClient);
    }
  } catch (err) {
    await handleError(interaction, cbClient, err).catch(() => {});
  }
}

async function handleSelectMenu(interaction) {
  const { customId } = interaction;
  if (customId === "category-select" || customId.startsWith("page_")) return;

  // Ticket select menus are already handled by the ticket gate above in
  // handleInteraction — this branch is never reached for them, but guard
  // anyway so a future code path can't accidentally deferUpdate them.
  if (customId === 'ticket-dropdown' || customId === 'ticket-tag-select' ||
      customId === 'ticket-manage-menu' || customId === 'ticket-assign-menu') return;

  if (customId === "ticket_category_select") {
    const tm = require("../../Events/Ticket/ticketManage");
    if (tm?.handleSelect) return tm.handleSelect(interaction, cbClient);
  }
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
}

// ── Event mirroring ────────────────────────────────────────────────────────────
// Load all feature systems (AFK, leveling, automod, etc.) for the CB guild
function loadSystems() {
  const fs   = require("fs");
  const path = require("path");
  const dir  = path.join(__dirname, "Systems");
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".js"))) {
    try {
      const fullPath = path.join(dir, file);
      const system   = require(fullPath);
      if (typeof system !== "function") continue;
      // Wrap client.on so each handler is guild-scoped
      const _origOn   = cbClient.on.bind(cbClient);
      const _origOnce = cbClient.once.bind(cbClient);
      cbClient.on = (event, handler) => _origOn(event, async (...args) => {
        const g = args[0]?.guild ?? args[0]?.channel?.guild;
        if (g?.id && g.id !== guildId) return;
        return handler(...args);
      });
      cbClient.once = (event, handler) => _origOnce(event, async (...args) => {
        const g = args[0]?.guild ?? args[0]?.channel?.guild;
        if (g?.id && g.id !== guildId) return;
        return handler(...args);
      });
      system(cbClient);
      cbClient.on   = _origOn;
      cbClient.once = _origOnce;
      console.log(`[CB-Worker:${guildId}] Loaded system: ${file}`);
    } catch (e) {
      console.warn(`[CB-Worker:${guildId}] Failed to load system ${file}: ${e.message}`);
    }
  }
}

function mirrorEvents() {
  const fs   = require("fs");
  const path = require("path");

  // Specific filenames to skip regardless of directory
  // These are Roco-infrastructure (uptime, social notifiers, vote tracking)
  const SKIP_FILES = new Set([
    "uptimePinger.js",
    "twitch.js",
    "twitternotification.js",
    "youtubeNotification.js",
    "vote.js",           // top.gg vote webhooks — Roco account only
    "guildDelete.js",    // Roco tracks when it's removed from servers — not relevant for CB
    "logbackup.js",      // Roco log backup system
    "changeLogs.js",     // Roco changelog announcements
  ]);

  // Entire subdirectories to skip — these are Roco-infrastructure events that
  // have no business running on a per-guild custom branded bot
  const SKIP_DIRS = new Set([
    "Lavalink",     // music player events — CB bots have no music player
    "Stripe",       // premium payment webhooks — Roco-only
    "interaction",  // individual interaction handlers — CB worker calls these directly
  ]);

  // Events handled directly by the CB worker — never double-register
  const SKIP_NAMES = new Set([
    "interactionCreate",  // CB worker handles this directly
    "ready",              // CB worker manages its own ready lifecycle
    "guildCreate",        // enforceGuildLock handles this directly
  ]);

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      if (SKIP_FILES.has(entry.name)) continue;
      try {
        const mod  = require(full);
        const name = mod?.name;
        if (!name || typeof mod.execute !== "function") continue;
        const evName = String(name).trim();
        if (SKIP_NAMES.has(evName)) continue;
        // Skip ClientReady variants (Events.ClientReady resolves to "ready" at runtime)
        if (/^ready$/i.test(evName) || /clientready/i.test(evName)) continue;

        cbClient.on(evName, (...args) => {
          const guild = args[0]?.guild ?? args[0]?.channel?.guild ?? args[0];
          if (guild?.id && guild.id !== guildId) return;
          mod.execute(...args, cbClient).catch(() => {});
        });
        console.log(`[CB-Worker:${guildId}] Mirroring event: ${evName} (${entry.name})`);
      } catch { /* not an event file */ }
    }
  };

  try { walk(path.join(__dirname, "..", "..", "Events")); }
  catch (err) { console.warn(`[CB-Worker:${guildId}] Event mirror failed:`, err.message); }
}

// ── Reconnect ──────────────────────────────────────────────────────────────────
function scheduleReconnect() {
  if (stopping) return;

  // Backoff is capped at RECONNECT_CAP_MS (5 min) — retries continue indefinitely.
  // reconnectCount is reset to 0 on successful ready, so the backoff resets too.
  const delay = backoffDelay(reconnectCount, RECONNECT_BASE_MS, RECONNECT_CAP_MS);
  reconnectCount++;
  console.log(`[CB-Worker:${guildId}] Reconnect attempt ${reconnectCount} in ${(delay / 1000).toFixed(1)}s (will keep retrying)`);
  send({ type: "state", state: "reconnecting" });

  setTimeout(async () => {
    if (stopping) return;
    try {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (cbClient)  { cbClient.removeAllListeners(); cbClient.destroy(); cbClient = null; }
      _rest = null;
      await spawnClient();
    } catch (err) {
      console.error(`[CB-Worker:${guildId}] Reconnect attempt ${reconnectCount} failed:`, err.message);
      scheduleReconnect();
    }
  }, delay);
}

// ── Alert ─────────────────────────────────────────────────────────────────────
async function sendAlert(message) {
  if (!config?.alertChannelId || !cbClient) return;
  try {
    const ch = await cbClient.channels.fetch(config.alertChannelId).catch(() => null);
    if (ch?.isTextBased()) await ch.send({ content: message });
  } catch {}
}

// ── Friendly error ────────────────────────────────────────────────────────────
function friendlyLoginError(msg) {
  if (msg?.includes("TOKEN_INVALID") || msg?.includes("401"))
    return "Invalid bot token — reset and submit a fresh token from the Developer Portal";
  if (msg?.includes("disallowed intents") || msg?.includes("4014"))
    return "Missing Privileged Gateway Intents — enable all intents in the Developer Portal";
  if (msg?.includes("ENOTFOUND") || msg?.includes("ECONNREFUSED"))
    return "Network error — cannot reach Discord's gateway";
  return msg ?? "Unknown login error";
}

// ── IPC message handler ────────────────────────────────────────────────────────
process.on("message", async (msg) => {
  switch (msg.type) {
    case "start": {
      guildId = msg.guildId;
      token   = msg.token;
      config  = msg.config;
      // Give this worker a unique process identity so its log documents in the
      // BotLogs collection are isolated from the CB manager and other workers.
      // logs.js reads LOG_PROCESS_NAME dynamically, so this takes effect immediately.
      process.env.LOG_PROCESS_NAME = `CB_${guildId}`;
      mainClientStub = buildMainStub();
      send({ type: "state", state: "starting" });
      try {
        await connectDB();
        await spawnClient();
      } catch (err) {
        console.error(`[CB-Worker:${guildId}] Startup error:`, err.message);
        send({ type: "state", state: "error", error: err.message });
        // Schedule a reconnect instead of dying — manager tracks state and will
        // surface persistent failures without the whole worker going away.
        setTimeout(() => scheduleReconnect(), 5_000);
      }
      break;
    }
    case "updatePresence": {
      config = { ...config, ...msg.config };
      // Re-apply CB branding overlay so live embed colour / footer / status changes take effect
      if (cbClient) {
        cbClient.config = {
          ...cbClient.config,
          ...(config.embedColor  ? { embedColor:  config.embedColor  } : {}),
          ...(config.footerText  ? { footerText:  config.footerText  } : {}),
          ...(config.botName     ? { botName:     config.botName     } : {}),
          ...(config.statusText  !== undefined ? { statusText:  config.statusText  } : {}),
          ...(config.statusType  !== undefined ? { statusType:  config.statusType  } : {}),
          ...(config.onlineStatus !== undefined ? { onlineStatus: config.onlineStatus } : {}),
        };
      }
      applyPresence();
      await applyIdentity();
      break;
    }
    case "RELOAD_COMMANDS": {
      if (cbClient?.isReady()) {
        try {
          await registerAllCommands();
          send({ type: "commandsReloaded" });
        } catch (err) {
          console.error(`[CB-Worker:${guildId}] RELOAD_COMMANDS error:`, err.message);
        }
      }
      break;
    }
    case "REST_PROXY": {
      // Proxy a Discord REST call from the dashboard through this worker's token.
      // This ensures custom command registrations go to the CB bot's application.
      const { corrId, method, route, body: proxyBody } = msg;
      if (!cbClient?.isReady() || !token) {
        send({ type: "restResult", corrId, restResult: { error: "CB bot not ready" } });
        break;
      }
      try {
        // Use the shared REST client so rate-limit buckets are preserved across calls.
        const rest = getRESTClient();
        const exec = () => {
          switch (method?.toUpperCase()) {
            case "GET":    return rest.get(route);
            case "POST":   return rest.post(route, { body: proxyBody });
            case "PATCH":  return rest.patch(route, { body: proxyBody });
            case "DELETE": return rest.delete(route);
            case "PUT":    return rest.put(route, { body: proxyBody });
            default: throw new Error(`Unknown REST method: ${method}`);
          }
        };
        const result = await withRetry(exec, `REST_PROXY ${method} ${route}`);
        send({ type: "restResult", corrId, restResult: result ?? {} });
      } catch (err) {
        console.error(`[CB-Worker:${guildId}] REST_PROXY error (${method} ${route}):`, err.message);
        send({ type: "restResult", corrId, restResult: { error: err.message } });
      }
      break;
    }
    case "stop": {
      stopping = true;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      if (cbClient) {
        try { cbClient.removeAllListeners(); cbClient.destroy(); } catch {}
        cbClient = null;
      }
      send({ type: "state", state: "stopped" });
      process.exit(0);
      break;
    }
  }
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  stopping = true;
  if (cbClient) { try { cbClient.destroy(); } catch {} }
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error(`[CB-Worker:${guildId ?? 'INIT'}] Uncaught exception:`, err.stack || err.message);
  send({ type: "error", message: err.message });
  // If the client appears dead after uncaught exception, schedule a reconnect.
  // Never exit here -- the manager handles worker lifecycle.
  if (!stopping && (!cbClient || !cbClient.isReady())) {
    console.warn(`[CB-Worker:${guildId ?? 'INIT'}] Client appears down after uncaught exception -- scheduling reconnect.`);
    setTimeout(() => scheduleReconnect(), 3_000);
  }
});

process.on("unhandledRejection", (reason) => {
  const msg = reason?.stack || reason?.message || String(reason);
  console.error(`[CB-Worker:${guildId ?? 'INIT'}] Unhandled rejection (swallowed):`, msg);
  send({ type: "error", message: typeof reason === "string" ? reason : (reason?.message || "Unhandled rejection") });
  // Never exit on unhandled rejections -- async errors must not kill the worker.
});

console.log(`[CB-Worker] Process started (pid ${process.pid})`);