"use strict";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           CUSTOM BRANDING MANAGER  v3                       ║
 * ║                                                             ║
 * ║  Each CB bot runs as a child_process.fork() so:            ║
 * ║   • A CB bot crash NEVER takes down RankCore or other bots     ║
 * ║   • Each bot is fully isolated (memory, event-loop, etc.)  ║
 * ║   • The manager only tracks PIDs + IPC state               ║
 * ║                                                             ║
 * ║  Communication is via IPC (process.send / process.on).     ║
 * ║  The worker file is ./cb-worker.js                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const EventEmitter = require("events");
const { fork }     = require("child_process");
const path         = require("path");

const CustomBranding   = require("../../Schemas/customBrandingSchema");
const CbBlacklist      = require("../../Schemas/cbBlacklistSchema");
const CbConfig         = require("../../Schemas/cbConfigSchema");
const { encryptToken, decryptToken } = require("../../Utils/tokenCrypto");
const getOwners        = require("../../Utils/getOwners");
const { hasBrandingAccess } = require("../../Utils/brandingAccess");

const WORKER_PATH         = path.join(__dirname, "cb-worker.js");
const RECONNECT_BASE_MS   = 15_000;
const RECONNECT_CAP_MS    = 5 * 60_000; // 5 minutes max
const MAX_RECONNECT_TRIES = 5;

/** Exponential backoff with ±20% jitter. */
function backoffDelay(attempt, baseMs = RECONNECT_BASE_MS, capMs = RECONNECT_CAP_MS) {
  const expo   = Math.min(baseMs * (2 ** attempt), capMs);
  const jitter = expo * 0.2 * (Math.random() * 2 - 1);
  return Math.round(expo + jitter);
}

class CustomBrandingManager extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    this._main              = null;
    this._instances         = new Map();
    this._globalDisabled    = false;
    this._blacklistedServers = new Set();
  }

  async init(mainClient) {
    // ── Guard: init() must only run once per process lifetime ─────────────────
    // Without this, anything that calls init() a second time (e.g. a hot-reload
    // or a misrouted request) would stop every running bot and restart them all.
    if (this._initStarted) {
      console.warn("[CB-Manager] init() called more than once — ignoring duplicate call.");
      return;
    }
    this._initStarted = true;

    this._main = mainClient;
    console.log("[CB-Manager] Initialising (child-process mode)…");

    // ── Load global disabled flag ─────────────────────────────────────────
    try {
      const cfg = await CbConfig.findById("global").lean();
      this._globalDisabled = cfg?.globalDisabled === true;
    } catch {
      this._globalDisabled = false;
    }
    // ── Load blacklisted servers ──────────────────────────────────────────
    try {
      const blacklisted = await CbBlacklist.find().lean();
      this._blacklistedServers = new Set(blacklisted.map(b => b.serverId));
    } catch {
      this._blacklistedServers = new Set();
    }
    if (this._globalDisabled) {
      console.log("[CB-Manager] CB is globally disabled — no bots will start.");
      return;
    }
    if (this._blacklistedServers.size) {
      console.log(`[CB-Manager] ${this._blacklistedServers.size} server(s) blacklisted from using CB.`);
    }

    let configs;
    try {
      // Relaunch bots that were active, pending (never started), or errored.
      // "pending" covers bots that were set up but the manager restarted before
      // the worker ever got to mark itself active.
      // "error" bots get one retry on boot — if the error is permanent (bad token)
      // the worker will set setupState back to "error" and won't be retried again
      // until the user fixes the config and re-enables.
      const skipIds = [...this._blacklistedServers];
      configs = await CustomBranding.find({
        enabled: true,
        setupState: { $in: ["active", "pending", "error"] },
        guildId: { $nin: skipIds },
      }).select("+encryptedToken").lean();
    } catch (err) {
      console.error("[CB-Manager] DB query failed during init:", err.message);
      return;
    }

    // Skip configs with no token — avoids error spam from old entries whose
    // encryptedToken was cleared (e.g. after a key rotation recovery).
    const withToken = configs.filter(c => c.encryptedToken);

    if (!withToken.length) {
      if (configs.length) console.log(`[CB-Manager] Found ${configs.length} config(s) but none have a token — nothing to start.`);
      else console.log("[CB-Manager] No enabled branded bots to start.");
      return;
    }

    const byState = withToken.reduce((a, c) => { a[c.setupState] = (a[c.setupState] || 0) + 1; return a; }, {});
    console.log(`[CB-Manager] Found ${withToken.length}/${configs.length} bot(s) with tokens to start — ${JSON.stringify(byState)}`);

    // ── Non-blocking staggered launch ─────────────────────────────────────────
    // Discord enforces a gateway IDENTIFY rate limit of 1 identify per 5 s per
    // max_concurrency bucket (most small bots share bucket 0). We use 6 s as
    // the base gap so a small amount of startup jitter won't tip us over.
    //
    // FIX: The old code used `await` inside the loop, which meant init() blocked
    // for (N-1) × STAGGER_MS before returning — 10 bots × 6 s = 54 s of startup
    // time where the HTTP API was unreachable and the process appeared hung.
    //
    // New approach: schedule each fork with setTimeout so they all queue up
    // immediately and init() returns right away. The stagger is preserved (each
    // fork still fires STAGGER_MS after the previous one) but the process is
    // fully responsive from the moment init() returns.
    const baseStagger = 6_000; // minimum gap — satisfies gateway identify limit
    const restPadding = Math.min(Math.floor(withToken.length / 5) * 2_000, 9_000);
    const STAGGER_MS  = baseStagger + restPadding;

    console.log(`[CB-Manager] Scheduling ${withToken.length} branded bot(s) with ${(STAGGER_MS / 1000).toFixed(0)}s stagger (non-blocking)…`);

    let launched = 0;

    withToken.forEach((cfg, i) => {
      const jitter  = Math.round((Math.random() - 0.5) * 1_000); // ±500 ms
      const delayMs = i === 0 ? 0 : i * STAGGER_MS + jitter;

      setTimeout(async () => {
        try {
          await this.launchGuild(cfg.guildId);
          launched++;
          console.log(`[CB-Manager] Launched ${cfg.guildId} (${launched}/${withToken.length})`);
          if (launched === withToken.length) {
            console.log(`[CB-Manager] Init complete — all ${withToken.length} branded bots started.`);
          }
        } catch (err) {
          console.error(`[CB-Manager] Failed to launch ${cfg.guildId}: ${err.message}`);
        }
      }, delayMs);
    });

    // init() returns immediately — forks are scheduled in the background.
    console.log(`[CB-Manager] Init scheduled — HTTP API is ready. Bots will start over the next ${((withToken.length - 1) * STAGGER_MS / 1000).toFixed(0)}s.`);
  }

  async isAllowed(userId, guildId = null) {
    // Dev whitelist (fast path — no DB hit for owners)
    const devs      = await getOwners();
    const whitelist = (process.env.CB_WHITELIST_USERS || "")
      .split(",").map(id => id.trim()).filter(Boolean);
    if ([...devs, ...whitelist].includes(userId)) return true;

    // Full tier + subscription check
    const { allowed } = await hasBrandingAccess({ userId, guildId });
    return allowed;
  }

  isGloballyDisabled() {
    return this._globalDisabled;
  }

  isBlacklisted(guildId) {
    return this._blacklistedServers.has(guildId);
  }

  /** Reload blacklist + global disabled from DB (e.g. after dev panel change). */
  async reloadRestrictions() {
    try {
      const cfg = await CbConfig.findById("global").lean();
      this._globalDisabled = cfg?.globalDisabled === true;
    } catch { /* keep current */ }
    try {
      const blacklisted = await CbBlacklist.find().lean();
      this._blacklistedServers = new Set(blacklisted.map(b => b.serverId));
    } catch { /* keep current */ }
  }

  async launchGuild(guildId, rawToken) {
    // ── Respect global disable + server blacklist ─────────────────────────────
    if (this._globalDisabled) {
      throw new Error("CB is globally disabled by a developer.");
    }
    if (this._blacklistedServers.has(guildId)) {
      throw new Error("This server is blacklisted from using CB.");
    }

    // ── Encrypt raw token with OUR key before persisting ────────────────────
    // This is the single point where token encryption happens — the decryption
    // below uses the same key, so standalone mode can never have a key mismatch.
    if (rawToken) {
      const encrypted = encryptToken(rawToken);
      await CustomBranding.findOneAndUpdate(
        { guildId },
        { $set: { encryptedToken: encrypted, setupState: "pending" } },
      );
    }

    // ── Skip if already running ───────────────────────────────────────────────
    // A second launchGuild() call for the same guild while it is running or
    // starting is almost always a duplicate request (e.g. HTTP retry, dashboard
    // double-click). Do not stop and restart it — that would cause a visible
    // flap and a needless IDENTIFY hit against Discord's rate limit.
    const existing = this._instances.get(guildId);
    if (existing) {
      if (existing.state === "running" || existing.state === "starting") {
        console.log(`[CB-Manager] launchGuild(${guildId}) skipped — already ${existing.state}.`);
        return;
      }
      // For any other state (reconnecting, error, stopping) stop cleanly first.
      await this.stopGuild(guildId);
    }

    const config = await CustomBranding.findOne({ guildId })
      .select("+encryptedToken").lean();

    if (!config)                throw new Error(`No CB config for guild ${guildId}`);
    if (!config.encryptedToken) throw new Error("No bot token — run setup first");
    if (!config.enabled)        throw new Error("CB is disabled for this guild");

    let token;
    try {
      token = decryptToken(config.encryptedToken);
    } catch (err) {
      await this._setError(guildId, "Token decryption failed — please re-submit your token");
      throw err;
    }

    const entry = {
      child: null, state: "starting",
      botTag: null, ping: null,
      launchedAt: null, reconnectCount: 0,
      _timer: null, token, config,
    };
    this._instances.set(guildId, entry);
    this.emit("stateChange", { guildId, state: "starting" });
    this._forkWorker(guildId, token, config);
  }

  _forkWorker(guildId, token, config) {
    const entry = this._instances.get(guildId);
    if (!entry) return;

    const child = fork(WORKER_PATH, [], {
      env: {
        ...process.env,
        // Explicitly set CB identity — overrides whatever the parent has
        // (e.g. 'BOT' when workers are forked inline from noxx-bot).
        // cb-worker.js then refines this to CB_<guildId> after IPC start.
        LOG_PROCESS_NAME: 'CB',
      },
      silent: false,
    });

    entry.child = child;

    child.on("message", (msg) => {
      if (!msg?.type) return;
      switch (msg.type) {
        case "ready":
          entry.botTag     = msg.botTag;
          entry.botId      = msg.botId;
          entry.botAvatar  = msg.botAvatar ?? null;
          entry.launchedAt = Date.now();
          break;
        case "state":
          entry.state = msg.state;
          if (msg.botTag    !== undefined) entry.botTag    = msg.botTag;
          if (msg.botId     !== undefined) entry.botId     = msg.botId;
          if (msg.botAvatar !== undefined) entry.botAvatar = msg.botAvatar;
          if (msg.ping      !== undefined) entry.ping      = msg.ping;
          this.emit("stateChange", { guildId, state: msg.state, botTag: entry.botTag, error: msg.error });
          break;
        case "ping":
          entry.ping = msg.value;
          break;
        case "error":
          console.error(`[CB-Manager] Worker error ${guildId}: ${msg.message}`);
          break;
        case "identityError":
          console.error(`[CB-Manager] Identity error ${guildId}: ${msg.message}`);
          entry.lastNotification = { ok: false, message: msg.message, at: Date.now() };
          break;
        case "identityOk":
          entry.lastNotification = { ok: true, message: `Identity updated${msg.username ? ` — username set to "${msg.username}"` : ""}${msg.avatarChanged ? ", avatar updated" : ""}`, at: Date.now() };
          break;
        case "restResult":
          // Forwarded by cb-worker.js in response to a REST_PROXY IPC message.
          // Bubble up as an event so the internal API route can resolve the promise.
          this.emit("restResult", { guildId, restResult: msg.restResult, corrId: msg.corrId });
          break;
      }
    });

    child.on("exit", (code, signal) => {
      if (entry.state === "stopping") return;

      // code=1 = permanent error (bad token, missing intents) — the worker itself
      // detected this and voluntarily exited. Re-forking would just repeat it.
      if (code === 1) {
        const msg = "Permanent error — check token and intents in the Developer Portal";
        console.error(`[CB-Manager] ${guildId} exited with permanent error — not retrying.`);
        entry.child = null;
        entry.state = "error";
        this.emit("stateChange", { guildId, state: "error", error: msg });
        this._setError(guildId, msg).catch(() => {});
        return;
      }

      // code=0 = clean shutdown (e.g. "stop" IPC message). Don't restart.
      if (code === 0) {
        console.log(`[CB-Manager] ${guildId} exited cleanly.`);
        entry.child = null;
        entry.state = "stopped";
        this.emit("stateChange", { guildId, state: "stopped" });
        return;
      }

      // Signal / non-zero code = crash or transient failure — retry with backoff.
      console.warn(`[CB-Manager] Worker for ${guildId} crashed (code=${code}, signal=${signal}) — will retry.`);
      entry.child = null;
      entry.state = "reconnecting";
      this.emit("stateChange", { guildId, state: "reconnecting" });
      this._scheduleReconnect(guildId, token, config);
    });

    child.on("error", (err) => {
      console.error(`[CB-Manager] Fork error ${guildId}:`, err.message);
    });

    child.send({ type: "start", guildId, token, config });
  }

  _scheduleReconnect(guildId, token, config) {
    const entry = this._instances.get(guildId);
    if (!entry || entry.state === "stopping") return;

    if (entry.reconnectCount >= MAX_RECONNECT_TRIES) {
      console.error(`[CB-Manager] ${guildId} exceeded max reconnects`);
      entry.state = "error";
      this.emit("stateChange", { guildId, state: "error", error: "Max reconnects exceeded" });
      this._setError(guildId, "Bot disconnected too many times — please reset and re-setup").catch(() => {});
      return;
    }

    entry.reconnectCount++;
    const delay = backoffDelay(entry.reconnectCount - 1, RECONNECT_BASE_MS, RECONNECT_CAP_MS);
    console.log(`[CB-Manager] ${guildId} reconnect ${entry.reconnectCount}/${MAX_RECONNECT_TRIES} in ${(delay / 1000).toFixed(1)}s (exponential backoff)`);

    entry._timer = setTimeout(() => {
      if (!this._instances.has(guildId)) return;
      this._forkWorker(guildId, token, config);
    }, delay);
  }

  async stopGuild(guildId) {
    const entry = this._instances.get(guildId);
    if (!entry) return;

    entry.state = "stopping";
    this.emit("stateChange", { guildId, state: "stopping" });

    if (entry._timer) { clearTimeout(entry._timer); entry._timer = null; }

    if (entry.child) {
      try { entry.child.send({ type: "stop" }); } catch {}
      setTimeout(() => { try { entry.child?.kill("SIGKILL"); } catch {} }, 5_000);
      entry.child = null;
    }

    this._instances.delete(guildId);
    this.emit("stateChange", { guildId, state: "stopped" });
    console.log(`[CB-Manager] Stopped branded bot for guild ${guildId}`);
  }

  async stopAll() {
    const ids = [...this._instances.keys()];
    await Promise.allSettled(ids.map(id => this.stopGuild(id)));
    console.log(`[CB-Manager] All ${ids.length} branded bots stopped.`);
  }

  async updatePresence(guildId, config) {
    const entry = this._instances.get(guildId);
    if (entry?.child) {
      try { entry.child.send({ type: "updatePresence", config }); } catch {}
    }
  }

  getStatus(guildId) {
    const entry = this._instances.get(guildId);
    if (!entry) return { state: "stopped", botTag: null, ping: null, uptime: null, botId: null, botAvatar: null };
    // Pop lastNotification so the dashboard only shows it once
    const notification = entry.lastNotification || null;
    if (notification) entry.lastNotification = null;
    return {
      state:        entry.state,
      botTag:       entry.botTag,
      botId:        entry.botId ?? null,
      botAvatar:    entry.botAvatar ?? null,
      ping:         entry.ping ?? null,
      uptime:       entry.launchedAt ? Date.now() - entry.launchedAt : null,
      notification,
    };
  }

  /**
   * Returns true if a CB bot is currently running (state === "running") for the guild.
   * Used to suppress normal RankCore behaviour in CB-active guilds.
   * @param {string} guildId
   * @returns {boolean}
   */
  isActive(guildId) {
    const entry = this._instances.get(guildId);
    return entry?.state === "running";
  }

  getAllStatus() {
    return [...this._instances.entries()].map(([guildId, entry]) => ({
      guildId, state: entry.state, botTag: entry.botTag,
      botId: entry.botId ?? null, botAvatar: entry.botAvatar ?? null,
      ping: entry.ping ?? null,
      uptime: entry.launchedAt ? Date.now() - entry.launchedAt : null,
      reconnectCount: entry.reconnectCount,
    }));
  }

  /**
   * Send an IPC message to a running CB worker.
   * Silently ignores if the worker is not running.
   * @param {string} guildId
   * @param {object} message
   */
  sendToWorker(guildId, message) {
    const entry = this._instances.get(guildId);
    if (!entry?.child || entry.state !== "running") return;
    try { entry.child.send(message); } catch {}
  }

  async _setError(guildId, errorMsg) {
    await CustomBranding.updateOne({ guildId }, { setupState: "error", setupError: errorMsg }).catch(() => {});
  }
}

/**
 * When the bot runs alongside a dedicated noxx-cb process (CB_STANDALONE=true),
 * CB lifecycle is owned by that process. The bot only needs:
 *   - isActive(guildId)  — checked via a lightweight in-process cache synced
 *                          from the CB manager's /cb/status endpoint.
 *   - isAllowed(userId)  — still local, no CB manager needed.
 *
 * All other mutating methods (launchGuild, stopGuild, etc.) are delegated to
 * the CB manager over HTTP on CB_PORT (default 5183).
 *
 * In combined mode (CB_STANDALONE not set) the class is used directly as before.
 */

const CB_STANDALONE = process.env.CB_STANDALONE === 'true';
const CB_PORT       = parseInt(process.env.CB_PORT || '5183', 10);
// CB manager runs on the same server as noxx-bot. Override via CB_HOST env var if needed.
const CB_HOST       = process.env.CB_HOST || '127.0.0.1';
const CB_BASE       = `http://${CB_HOST}:${CB_PORT}/cb`;
const CB_API_SECRET = process.env.CB_API_SECRET || '';

// Thin proxy that delegates to the standalone CB manager over HTTP.
// Only the methods the bot actually calls on CBM are proxied.
class CustomBrandingManagerProxy extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    this._statusCache   = new Map(); // guildId → { state, updatedAt }
    this._pollInterval  = null;
    this._pollStarted   = false;
  }

  async init(mainClient) {
    console.log('[CB-Manager] Running in STANDALONE mode — CB bots managed by noxx-cb process.');
    this._startPolling();
  }

  // Poll the CB manager for status every 5 s so isActive() stays current.
  // Also exposes a promise (_ready) that resolves after the first successful poll
  // so callers can await it before making decisions.
  _startPolling() {
    if (this._pollStarted) return;
    this._pollStarted = true;
    let firstPollDone = false;
    this._ready = new Promise(resolve => { this._resolveReady = resolve; });

    const poll = async () => {
      try {
        const http = require('http');
        const data = await new Promise((resolve, reject) => {
          const req = http.get({ hostname: CB_HOST, port: CB_PORT, path: '/cb/status', headers: { 'x-cb-secret': CB_API_SECRET } }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve([]); } });
          });
          req.on('error', reject);
          req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
        });
        if (Array.isArray(data)) {
          this._statusCache.clear();
          for (const entry of data) {
            this._statusCache.set(entry.guildId, { state: entry.state, ping: entry.ping, uptime: entry.uptime, botTag: entry.botTag, botId: entry.botId, botAvatar: entry.botAvatar });
          }
          if (!firstPollDone) {
            firstPollDone = true;
            this._pollSucceeded = true;
            this._resolveReady?.();
          }
        }
      } catch {
        // CB manager might not be up yet — resolve ready anyway after first attempt
        // so the bot doesn't block indefinitely if noxx-cb is down
        if (!firstPollDone) {
          firstPollDone = true;
          this._resolveReady?.();
        }
      }
    };
    poll();
    this._pollInterval = setInterval(poll, 5_000);
  }

  isActive(guildId) {
    // If the cache has never been populated (first poll not done yet),
    // check the DB synchronously-ish is not possible here, so we return false.
    // The 5s poll interval means this window is very small.
    return this._statusCache.get(guildId)?.state === 'running';
  }

  async isAllowed(userId) {
    // isAllowed is pure-DB, no CB manager involvement needed
    const getOwners = require('../../Utils/getOwners');
    const devs      = await getOwners();
    const whitelist = (process.env.CB_WHITELIST_USERS || '')
      .split(',').map(id => id.trim()).filter(Boolean);
    return [...devs, ...whitelist].includes(userId);
  }

  getStatus(guildId) {
    const entry = this._statusCache.get(guildId);
    if (!entry) return { state: 'stopped', botTag: null, ping: null, uptime: null, botId: null, botAvatar: null };
    return { state: entry.state, botTag: entry.botTag ?? null, ping: entry.ping ?? null, uptime: entry.uptime ?? null, botId: entry.botId ?? null, botAvatar: entry.botAvatar ?? null, notification: null };
  }

  getAllStatus() {
    return [...this._statusCache.entries()].map(([guildId, e]) => ({
      guildId, state: e.state, botTag: e.botTag ?? null, ping: e.ping ?? null, uptime: e.uptime ?? null, botId: e.botId ?? null, botAvatar: e.botAvatar ?? null,
    }));
  }

  // Delegating methods — proxy to noxx-cb over HTTP
  async launchGuild(guildId, rawToken)  { return this._post(`/launch/${guildId}`, { token: rawToken || null }); }
  async stopGuild(guildId)    { return this._post(`/stop/${guildId}`, {}); }

  async isGloballyDisabled() {
    try {
      const res = await this._get(`/restrictions`);
      return res?.globalDisabled === true;
    } catch { return false; }
  }

  async isBlacklisted(guildId) {
    try {
      const res = await this._get(`/restrictions`);
      return res?.blacklistedServers?.includes(guildId) === true;
    } catch { return false; }
  }

  /** Delegates to the standalone CB manager to reload restrictions from DB. */
  async reloadRestrictions() {
    return this._post(`/reload-restrictions`, {}).catch(() => {});
  }

  // stopAll() is intentionally a no-op in standalone mode.
  // Server 2 runs independently — noxx-bot shutting down on server 1 must NOT
  // stop CB bots. They should keep running for users regardless of server 1 state.
  async stopAll() {
    console.log('[CB-Proxy] stopAll() called on proxy — no-op in standalone mode (server 2 is independent).');
  }
  async updatePresence(guildId, config) { return this._post(`/presence/${guildId}`, { config }).catch(() => {}); }
  sendToWorker(guildId, msg)  {
    if (msg?.type === 'REST_PROXY') {
      // Route REST proxy requests to the dedicated CB manager endpoint,
      // then emit the restResult event so internal.js can resolve its promise.
      this._post(`/rest/${guildId}`, msg)
        .then(restResult => this.emit('restResult', { guildId, restResult, corrId: msg.corrId }))
        .catch(err => this.emit('restResult', { guildId, restResult: { error: err.message }, corrId: msg.corrId }));
    } else {
      this._post(`/commands/${guildId}/sync`, msg).catch(() => {});
    }
  }

  async _get(path) {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const req = http.get({ hostname: CB_HOST, port: CB_PORT, path: `/cb${path}`, headers: { 'x-cb-secret': CB_API_SECRET } }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { const j = JSON.parse(data); if (j.error) reject(new Error(j.error)); else resolve(j); }
          catch { resolve({}); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10_000, () => { req.destroy(); reject(new Error('CB manager GET timed out')); });
    });
  }

  async _post(path, body) {
    const http = require('http');
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const opts = {
        hostname: CB_HOST, port: CB_PORT, path: `/cb${path}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-cb-secret': CB_API_SECRET },
      };
      const req = http.request(opts, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { const j = JSON.parse(data); if (j.error) reject(new Error(j.error)); else resolve(j); }
          catch { resolve({}); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10_000, () => { req.destroy(); reject(new Error('CB manager request timed out')); });
      req.write(payload);
      req.end();
    });
  }
}

// ── Export the right instance based on CB_STANDALONE ─────────────────────────
// CB_STANDALONE=true  → noxx-cb is a separate PM2 process; use the HTTP proxy.
// CB_STANDALONE unset → CB workers run inside this process (legacy / dev mode).
const instance = CB_STANDALONE
  ? new CustomBrandingManagerProxy()
  : new CustomBrandingManager();
module.exports = instance;