/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              ROCO DASHBOARD BOT CLIENT SHIM                     ║
 * ║                                                                  ║
 * ║  Used by the standalone dashboard process.                      ║
 * ║  Mirrors the Discord.js Client API but proxies every call       ║
 * ║  to the bot's internal API (127.0.0.1:5182).                    ║
 * ║                                                                  ║
 * ║  This means dashboard routes can keep using:                    ║
 * ║    req.client.guilds.cache.get(id)                              ║
 * ║    guild.channels.cache.filter(...)                             ║
 * ║    guild.members.fetch(userId)                                  ║
 * ║    guild.autoModerationRules.fetch()                            ║
 * ║    req.client.manager.players.get(guildId)                      ║
 * ║    req.client.emit('devPresence', ...)                          ║
 * ║  …and everything resolves transparently over HTTP.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict';

const INTERNAL_BASE = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';

// ─── BotOfflineError ─────────────────────────────────────────────────────────
// Thrown when the internal API is unreachable (bot restarting / offline).
// Routes and middleware can catch this specifically to return 503 instead of
// crashing the process with an unhandled rejection.
class BotOfflineError extends Error {
  constructor(msg = 'Bot internal API unreachable') {
    super(msg);
    this.name    = 'BotOfflineError';
    this.status  = 503;
    this.isBotOffline = true;
  }
}

// ─── Connection state tracker ─────────────────────────────────────────────────
// We track consecutive failures so we can log reconnection without spamming.
let _consecutiveFails = 0;
let _wasOffline       = false;

// ─── HTTP helper ─────────────────────────────────────────────────────────────
// • 8-second timeout — prevents routes from hanging while bot restarts
// • Throws BotOfflineError for connection failures (ECONNREFUSED, ECONNRESET,
//   ETIMEDOUT, fetch abort) so callers can detect "bot offline" vs real errors
// • All other errors are re-thrown as-is
async function apiFetch(path, opts = {}) {
  const url        = `${INTERNAL_BASE}${path}`;
  const controller = new AbortController();
  const timeoutMs  = opts.timeout ?? 8_000;
  const timer      = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...opts,
      signal: controller.signal,
headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
    });

    clearTimeout(timer);
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });

    // Reconnect log — only fires once after a period of failures
    if (_wasOffline) {
      console.log('[botClient] Internal API reconnected.');
      _wasOffline       = false;
      _consecutiveFails = 0;
    }

    return data;

  } catch (err) {
    clearTimeout(timer);

    // Classify connection-level errors as BotOfflineError
    const code = err.cause?.code || err.code || '';
    const isConnErr =
      err.name === 'AbortError'                                    ||  // our 8s timeout
      code === 'ECONNREFUSED'                                      ||  // port closed (bot restarting)
      code === 'ECONNRESET'                                        ||  // connection dropped mid-request
      code === 'ETIMEDOUT'                                         ||  // TCP timeout
      code === 'ENOTFOUND'                                         ||  // DNS/hostname not found
      code === 'UND_ERR_CONNECT_TIMEOUT'                           ||  // undici connect timeout
      code === 'UND_ERR_SOCKET'                                    ||  // undici socket error
      (err.message || '').includes('fetch failed')                 ||  // Node fetch wrapper
      (err.message || '').includes('ECONNREFUSED')                 ||
      (err.message || '').includes('The operation was aborted');

    if (isConnErr) {
      _consecutiveFails++;
      if (!_wasOffline) {
        console.warn(`[botClient] Internal API offline (${code || err.name}) — bot may be restarting. Requests will return 503 until it recovers.`);
        _wasOffline = true;
      }
      throw new BotOfflineError();
    }

    // Re-throw all other errors (HTTP 4xx/5xx, JSON parse errors, etc.)
    throw err;
  }
}

async function apiGet(path)         { return apiFetch(path); }
async function apiPost(path, body)  { return apiFetch(path, { method: 'POST',   body: JSON.stringify(body || {}) }); }
async function apiDel(path, body)   { return apiFetch(path, { method: 'DELETE', body: JSON.stringify(body || {}) }); }

// ─── Fake Collection (enough of the Collection API used by routes) ────────────
class FakeCollection {
  constructor(items = []) {
    this._map = new Map(items.map(i => [i.id, i]));
  }
  get(id)            { return this._map.get(id); }
  has(id)            { return this._map.has(id); }
  get size()         { return this._map.size; }
  map(fn)            { return [...this._map.values()].map(fn); }
  filter(fn)         { const c = new FakeCollection(); [...this._map.values()].filter(fn).forEach(v => c._map.set(v.id, v)); return c; }
  find(fn)           { return [...this._map.values()].find(fn); }
  some(fn)           { return [...this._map.values()].some(fn); }
  forEach(fn)        { this._map.forEach((v, k) => fn(v, k)); }
  sort(fn)           { const sorted = [...this._map.values()].sort(fn); const c = new FakeCollection(); sorted.forEach(v => c._map.set(v.id, v)); return c; }
  keys()             { return this._map.keys(); }
  values()           { return this._map.values(); }
  [Symbol.iterator](){ return this._map.values(); }
  // Collection methods used in routes
  get first()        { return this._map.values().next().value; }
  toArray()          { return [...this._map.values()]; }
}

// ─── Fake Sized Collection (reports a count without actual data) ──────────────
// Used when the bot exposes a count (e.g. roleCount, emojiCount) but the full
// list hasn't been fetched yet.  Routes that call .size get the right number;
// routes that iterate get an empty set (which is the safe fallback).
class FakeSizedCollection extends FakeCollection {
  constructor(count = 0, items = []) {
    super(items);
    this._count = count;
  }
  get size() { return this._map.size > 0 ? this._map.size : this._count; }
}

// ─── Fake Channel ─────────────────────────────────────────────────────────────
class FakeChannel {
  constructor(data, guildId) {
    Object.assign(this, data);
    this._guildId = guildId;
    // serializeChannel() on the internal API omits guildId, so we must set it
    // explicitly here. canSend() in the giveaway route checks ch.guildId — if
    // it is undefined the ownership check fails and every create/send errors
    // with "Channel not found or bot cannot send messages there".
    this.guildId = guildId;
  }
  isTextBased()  { return this.type === 0 || this.type === 'GuildText'; }
  isVoiceBased() { return this.type === 2 || this.type === 'GuildVoice'; }

  // channel.permissionsFor(guild.members.me) → returns object with has()
  permissionsFor(_member) {
    return {
      has: async (flag) => {
        try {
          const r = await apiGet(`/internal/guild/${this._guildId}/channel/${this.id}/can-send`);
          return r.canSend;
        } catch { return false; }
      },
    };
  }

  async send(payload) {
    // Serialise file attachments before sending over JSON.
    // discord.js accepts { attachment: Buffer, name } but Buffer does not survive
    // JSON.stringify — it becomes an object of byte values, which is both huge and
    // unreadable on the other side.  Convert each attachment to base64 so the
    // internal API can reconstruct the Buffer cleanly.
    const serialised = { ...payload };
    if (Array.isArray(payload.files) && payload.files.length) {
      serialised.files = payload.files.map(f => {
        const buf = f.attachment ?? f;
        const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
        return { name: f.name || 'file.png', data: raw.toString('base64'), contentType: f.contentType || 'image/png' };
      });
    }

    const data = await apiPost(`/internal/guild/${this._guildId}/channel/${this.id}/send`, serialised);
    // Normalise: internal API returns { success, messageId } — callers expect { id, edit() }
    const msgId = data.messageId || data.id;
    if (!msgId) throw new Error('Send failed: no message ID returned from internal API');
    const guildId   = this._guildId;
    const channelId = this.id;
    return {
      id: msgId,
      edit: async (newPayload) =>
        apiPost(`/internal/guild/${guildId}/channel/${channelId}/message/${msgId}/edit`, newPayload),
    };
  }

  // Needed by giveaway edit/end/delete routes to fetch then edit the Discord message
  get messages() {
    const guildId   = this._guildId;
    const channelId = this.id;
    return {
      fetch: async (messageId) => {
        await apiGet(`/internal/guild/${guildId}/channel/${channelId}/message/${messageId}`);
        // Return a message-like object; the actual content isn't needed by the routes,
        // only .id and .edit() are used.
        return {
          id: messageId,
          edit: async (payload) =>
            apiPost(`/internal/guild/${guildId}/channel/${channelId}/message/${messageId}/edit`, payload),
        };
      },
    };
  }

  async fetchWebhooks() {
    const list = await apiGet(`/internal/guild/${this._guildId}/channel/${this.id}/webhooks`);
    return new FakeCollection(list);
  }
}

// ─── Fake AutoMod Rule ────────────────────────────────────────────────────────
class FakeAutoModRule {
  constructor(data, guildId) {
    Object.assign(this, data);
    this._guildId = guildId;
  }
  async edit(data) {
    // Route-level edits are already handled by the internal API routes
    // so this is only called from the dashboard route after it calls the shim methods
    throw new Error('Use guild.autoModerationRules.toggle/mention/keyword instead');
  }
  async delete() {
    throw new Error('Use guild.autoModerationRules.deleteKeyword instead');
  }
}

// ─── Fake AutoMod Manager ─────────────────────────────────────────────────────
class FakeAutoModManager {
  constructor(guildId) {
    this._guildId = guildId;
    this.cache = new FakeCollection();
    this._fetched = false;
  }

  async fetch() {
    const data = await apiGet(`/internal/guild/${this._guildId}/automod`);
    // Store the raw result so route-level .cache.some/find/filter calls work
    this._data = data;
    // Build a synthetic cache from the summary so the automod route's patterns work
    // The automod route in the dashboard queries this._data directly via the shim
    this._fetched = true;
    return data;
  }

  // Expose raw data as well, so the dashboard route can access it
  getRawData() { return this._data; }

  async toggle(type, enabled) {
    return apiPost(`/internal/guild/${this._guildId}/automod/toggle`, { type, enabled });
  }
  async mention(limit) {
    return apiPost(`/internal/guild/${this._guildId}/automod/mention`, { limit });
  }
  async deleteKeyword(word) {
    return apiDel(`/internal/guild/${this._guildId}/automod/keyword`, { word });
  }

  async create(ruleData) {
    // Map ruleData to the internal API action
    const { triggerType, enabled } = ruleData;
    const { AutoModerationRuleTriggerType: T } = require('discord.js');
    if (triggerType === T.Keyword && ruleData.triggerMetadata?.keywordFilter?.length) {
      return apiPost(`/internal/guild/${this._guildId}/automod/keyword`, { word: ruleData.triggerMetadata.keywordFilter[0] });
    }
    // For profanity/spam/antilink
    const typeMap = {
      [T.KeywordPreset]: 'profanity',
      [T.Spam]:          'spam',
    };
    if (typeMap[triggerType]) {
      return apiPost(`/internal/guild/${this._guildId}/automod/toggle`, { type: typeMap[triggerType], enabled: true });
    }
    if (triggerType === T.MentionSpam) {
      return apiPost(`/internal/guild/${this._guildId}/automod/mention`, { limit: ruleData.triggerMetadata?.mentionTotalLimit });
    }
    throw new Error(`Unsupported automod rule type: ${triggerType}`);
  }
}

// ─── Fake Guild ───────────────────────────────────────────────────────────────
class FakeGuild {
  constructor(data) {
    // Strip keys that are defined as class getters or methods so Object.assign
    // doesn't overwrite them with plain data values from the API response.
    // e.g. the internal API serialises iconURL as a string; we must not let
    // that clobber the iconURL() method defined on this class.
    const { roles, channels, members, emojis, iconURL: _iconURL, ...rest } = data;
    Object.assign(this, rest);
    // Lazily-populated caches
    this._channels  = null;
    this._roles     = null;
    this._members   = null;
    // Store counts that arrive with the guild list payload
    this._roleCount    = data._roleCount    || 0;
    this._channelCount = data._channelCount || 0;
    this._emojiCount   = data._emojiCount   || 0;
    this.autoModerationRules = new FakeAutoModManager(this.id);
  }

  iconURL(opts = {}) {
    if (!this.icon) return null;
    return `https://cdn.discordapp.com/icons/${this.id}/${this.icon}.png?size=${opts.size || 256}`;
  }

  async fetchOwner() {
    const u = await apiGet(`/internal/user/${this.ownerId}`);
    return { user: { username: u.username, discriminator: u.discriminator ?? '0' } };
  }

  async leave() {
    return apiPost(`/internal/guild/${this.id}/leave`);
  }

  async createInvite() {
    return apiPost(`/internal/guild/${this.id}/invite`);
  }

  get channels() {
    const guildId = this.id;
    const self = this;
    return {
      // Populated lazily — routes call guild.channels.cache.X
      get cache() {
        if (!self._channels) {
          // Return an empty collection synchronously — caller must await guild.channels.fetchAll()
          // OR the routes use the shim's pre-populated cache
          return self._channels || new FakeCollection();
        }
        return self._channels;
      },
      async fetch(channelId) {
        const ch = await apiGet(`/internal/guild/${guildId}/channel/${channelId}`);
        return new FakeChannel(ch, guildId);
      },
      async fetchAll() {
        const list = await apiGet(`/internal/guild/${guildId}/channels`);
        self._channels = new FakeCollection(list.map(c => new FakeChannel(c, guildId)));
        return self._channels;
      },
    };
  }

  get roles() {
    const self = this;
    return {
      get cache() { return self._roles || new FakeSizedCollection(self._roleCount || 0); },
    };
  }

  get members() {
    const guildId = this.id;
    const self = this;
    return {
      get cache() { return self._members || new FakeCollection(); },
      get me() { return self._botMember || null; },
      async fetch(userIdOrOpts) {
        if (!userIdOrOpts) {
          const list = await apiGet(`/internal/guild/${guildId}/members`);
          // Normalise raw API objects into Discord.js-style member objects so that
          // callers can safely access m.user.bot, m.user.username, etc.
          const normalised = list.map(m => {
            // If the API already returns a nested .user object, keep it as-is.
            if (m && m.user) return m;
            // Otherwise promote the flat fields into a .user sub-object.
            return {
              id:          m.id,
              displayName: m.displayName || m.username || m.id,
              user: {
                id:       m.id,
                username: m.username || m.id,
                bot:      m.bot || false,
                displayAvatarURL: (opts = {}) =>
                  m.avatar
                    ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.webp?size=${opts.size || 64}`
                    : `https://cdn.discordapp.com/embed/avatars/0.png`,
              },
              displayAvatarURL: (opts = {}) =>
                m.avatar
                  ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.webp?size=${opts.size || 64}`
                  : `https://cdn.discordapp.com/embed/avatars/0.png`,
            };
          });
          self._members = new FakeCollection(normalised);
          return self._members;
        }
        const userId = typeof userIdOrOpts === 'string' ? userIdOrOpts : userIdOrOpts.user;
        return apiGet(`/internal/guild/${guildId}/member/${userId}`);
      },
    };
  }

  get emojis() {
    return { cache: new FakeSizedCollection(this._emojiCount || 0) };
  }
}

// ─── Fake Guild Manager ───────────────────────────────────────────────────────
class FakeGuildManager {
  constructor() {
    this._cache = new FakeCollection();
  }

  get cache() { return this._cache; }

  async fetch(guildId) {
    const data = await apiGet(`/internal/guild/${guildId}`);
    const guild = new FakeGuild(data);
    // Always keep cache up to date so cache.has() works after a fetch
    this._cache._map.set(guild.id, guild);
    return guild;
  }

  _set(guild) {
    this._cache._map.set(guild.id, guild);
  }
}

// ─── Fake Player ─────────────────────────────────────────────────────────────
class FakePlayer {
  constructor(data, guildId) {
    Object.assign(this, data);
    this._guildId = guildId;
  }
  async skip()    { return apiPost(`/internal/guild/${this._guildId}/player/skip`); }
  async destroy() { return apiPost(`/internal/guild/${this._guildId}/player/stop`); }
  pause(val)      { return apiPost(`/internal/guild/${this._guildId}/player/${val ? 'pause' : 'resume'}`); }
  setVolume(v)    { return apiPost(`/internal/guild/${this._guildId}/player/volume`, { volume: v }); }
  seek(pos)       { return apiPost(`/internal/guild/${this._guildId}/player/seek`,   { position: pos }); }
  setLoop(mode)   { return apiPost(`/internal/guild/${this._guildId}/player/loop`,   { mode }); }
  shuffle()       { return apiPost(`/internal/guild/${this._guildId}/player/shuffle`); }
  clearQueue()    { return apiPost(`/internal/guild/${this._guildId}/player/queue/clear`); }
}

// ─── Fake Player Manager ─────────────────────────────────────────────────────
class FakePlayerManager {
  players = {
    get: (guildId) => this._syncGet(guildId),
    _store: new Map(),
  };

  _syncGet(guildId) {
    // Returns the cached player — callers must have awaited fetchPlayer first
    return this.players._store.get(guildId) || null;
  }

  async fetchPlayer(guildId) {
    try {
      const data = await apiGet(`/internal/guild/${guildId}/player`);
      const p = new FakePlayer(data, guildId);
      this.players._store.set(guildId, p);
      return p;
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async createPlayer(opts) {
    await apiPost(`/internal/guild/${opts.guildId}/player/create`, {
      userId:        opts.userId,
      textChannelId: opts.textId,
    });
    return this.fetchPlayer(opts.guildId);
  }
}

// ─── Fake User Manager ────────────────────────────────────────────────────────
class FakeUserManager {
  cache = new FakeCollection();

  async fetch(userId, opts = {}) {
    const force = opts.force || false;
    const data  = await apiGet(`/internal/user/${userId}?force=${force}`);
    this.cache._map.set(data.id, data);
    return data;
  }
}

// ─── Fake REST ────────────────────────────────────────────────────────────────
// CRIT-2: All Discord REST calls go through the internal bot API so the dashboard
// process never needs the bot token in its own environment.
class FakeREST {
  async get(route) {
    return apiFetch(`/internal/rest/get?route=${encodeURIComponent(route)}`);
  }
  async post(route, { body } = {}) {
    const r = await apiPost('/internal/rest/post', { route, body });
    return r?.result ?? r;
  }
  async patch(route, { body } = {}) {
    const r = await apiFetch('/internal/rest/patch', { method: 'PATCH', body: JSON.stringify({ route, body }) });
    return r?.result ?? r;
  }
  async delete(route) {
    const r = await apiFetch('/internal/rest/delete', { method: 'DELETE', body: JSON.stringify({ route }) });
    return r?.result ?? r;
  }
  // Alias used by discord.js REST client for raw PUT (application command syncs)
  async put(route, { body } = {}) {
    const r = await apiFetch('/internal/rest/put', { method: 'PUT', body: JSON.stringify({ route, body }) });
    return r?.result ?? r;
  }
}

// ─── Main Bot Client Shim ─────────────────────────────────────────────────────
class BotClientShim {
  constructor(config) {
    this.config   = config;
    this.emoji    = require('../../src/data/emoji.json');
    this.logs     = require('../../Utils/logs.js');
    this.isStandaloneMode = true;

    this.guilds   = new FakeGuildManager();
    this.users    = new FakeUserManager();
    this.manager  = new FakePlayerManager(); // music
    this.rest     = new FakeREST();

    this.ws = { ping: -1, status: 0 };
    this.uptime = 0;
    this.user = null;
    this._online = false;     // true only when internal API is reachable
    this._refreshing = false; // in-flight guard — prevents concurrent refresh() calls racing

    // Module manager proxy — forwards to internal API
    this.moduleManager = this._makeModuleManagerProxy();

    // Granular manager proxy — forwards to internal API
    this.granularManager = this._makeGranularManagerProxy();

    // Global permission manager proxy — forwards bulk apply to bot process
    this.globalPerms = this._makeGlobalPermsProxy();

    // Channels — expose a working .fetch() and .cache.get() so that:
    //   client.channels.fetch(channelId)       — used by dashboard fetchChannel()
    //   client.channels.cache.get(channelId)   — used by endGiveaway() and others
    // Both search the hydrated guild channel caches first, then fall back to the
    // internal API endpoint that scans all guilds for the channel by ID.
    this.channels = {
      cache: {
        get: (channelId) => {
          for (const guild of this.guilds.cache._map.values()) {
            if (guild._channels) {
              const ch = guild._channels.get(channelId);
              if (ch) return ch;
            }
          }
          return undefined;
        },
        size: 0,
      },
      fetch: async (channelId) => {
        // 1. Try hydrated guild caches first (zero network cost)
        for (const guild of this.guilds.cache._map.values()) {
          if (guild._channels) {
            const ch = guild._channels.get(channelId);
            if (ch) return ch;
          }
        }
        // 2. Fall back: ask internal API to scan all guilds
        try {
          const data  = await apiGet(`/internal/channel/${channelId}`);
          return new FakeChannel(data, data.guildId);
        } catch { return null; }
      },
    };
    this.application = { commands: { cache: new FakeCollection() } };

    // commands — fetched from internal API for the Command Manager dashboard page.
    // Truthy so guild-commands route's `if (!commands)` guard passes, but actual
    // data is fetched via apiGet in the route itself.
    this.commands = { _isShim: true };

    // Start periodic refresh immediately so _online is current on first request
    this._refreshInterval = setInterval(() => this.refresh().catch(() => {}), 5_000);
  }

  isReady() { return this._online; }

  // Emit events on the bot process
  emit(event, data) {
    apiPost('/internal/emit', { event, data }).catch(() => {});
  }

  // Refresh bot info from internal API
  async refresh() {
    // Guard against concurrent calls racing — the 5s poll and fast-retry can
    // overlap during a restart window. Without this, the slower call may land a
    // stale failure result *after* the faster one already set _online = true,
    // leaving the shim permanently stuck in the offline state.
    if (this._refreshing) return;
    this._refreshing = true;
    // Use a short timeout for health/refresh calls so failures are detected fast
    // and the fast-retry loop can kick in quickly after a restart.
    const REFRESH_TIMEOUT = 8_000;
    try {
      // Fetch sequentially so a slow /guilds response doesn't abort /bot-info too.
      const info      = await apiFetch('/internal/bot-info', { timeout: REFRESH_TIMEOUT });
      const guildList = await apiFetch('/internal/guilds',   { timeout: REFRESH_TIMEOUT });

      this.ws.ping             = info.ping;
      this.uptime              = info.uptime;
      // Only update user identity when the bot is actually ready — the internal
      // endpoint now returns null fields when isReady() is false, so we guard
      // against clobbering a previously-valid user object with null.
      if (info.id) this.user = { id: info.id, username: info.username };
      // FakeCollection.size is a getter-only — store counts separately
      if (info.channelCount != null) this.channels.cache._count = info.channelCount;
      if (info.userCount    != null) this.users.cache._count    = info.userCount;
      // Only overwrite the guild cache when the API returned a non-empty list.
      // An empty list almost always means the bot is mid-restart or the internal
      // /guilds endpoint raced ahead of the gateway being fully ready — not that
      // the bot genuinely left every server.  Keeping the last-known-good cache
      // alive prevents every server card from flipping to "Invite Bot" for the
      // duration of the restart window.
      const freshGuilds = guildList.map(g => new FakeGuild(g));
      if (freshGuilds.length > 0) {
        this.guilds._cache = new FakeCollection(freshGuilds);
      }
      // _online mirrors the bot's isReady() via the new `ready` field.
      // During a Discord gateway reconnect, info.ready is false — we keep
      // _online false so the servers page shows the offline banner instead of
      // serving stale guild membership data.
      // Also force _online false when the guild list came back empty even though
      // info.ready is true — this is the transient race where the internal API
      // responds before the guild cache is populated.  The fast-retry will flip
      // us back to true as soon as the guilds endpoint returns real data.
      const guildListReady = guildList.length > 0;
      this._online             = info.ready === true && guildListReady;
      this._refreshFails       = 0;

      // If we just recovered from offline, cancel any pending fast-retry
      if (this._fastRetryTimer) {
        clearTimeout(this._fastRetryTimer);
        this._fastRetryTimer = null;
      }

      // If the bot is reachable but not yet ready (e.g. mid-reconnect), schedule
      // a fast retry so we detect the transition to ready quickly.
      // NOTE: do NOT reset _refreshFails here — refreshStatus() uses the same
      // counter for its debounce. Resetting it here would let refreshStatus()
      // immediately flip _online=false on the next ready:false response,
      // racing against this fast-retry and keeping /servers stuck on offline.
      if (!this._online) {
        this._scheduleFastRetry();
      }
    } catch (refreshErr) {
      // Bot is offline or internal API unreachable — clear stale state
      console.error('[botClient] refresh() failed:', refreshErr?.message || refreshErr);
      this._online       = false;
      this.ws.ping       = -1;
      this.uptime        = 0;
      this._refreshFails = (this._refreshFails || 0) + 1;
      // Don't clear guilds cache — servers page needs it to stay populated for
      // users who loaded before the bot went offline. It refreshes on recovery.

      // Schedule a fast retry so recovery is detected within ~2-3 s instead of
      // waiting the full 5-second normal interval.
      this._scheduleFastRetry();
    } finally {
      this._refreshing = false;
    }
  }

  // Fast-retry with capped exponential backoff: 2s → 4s → 8s → 8s → ...
  // Stops as soon as refresh() succeeds AND _online is true.
  _scheduleFastRetry() {
    if (this._fastRetryTimer) return; // already pending
    const fails   = this._refreshFails || 1;
    const delayMs = Math.min(2_000 * Math.pow(2, fails - 1), 8_000); // 2s, 4s, 8s cap
    this._fastRetryTimer = setTimeout(async () => {
      this._fastRetryTimer = null;
      await this.refresh().catch(() => {});
    }, delayMs);
  }

  // Lightweight status-only refresh — only calls /internal/bot-info (no guild fetch).
  // Used by the status API on every request so it stays fast. Does not update guild cache.
  async refreshStatus() {
    // If a full refresh() is already in-flight, wait for it to complete instead of
    // returning early with stale _online state. This prevents the servers page
    // from getting stuck on "bot is offline" after a restart when the full refresh()
    // cycle is in progress but hasn't finished yet.
    if (this._refreshing) {
      let waited = 0;
      while (this._refreshing && waited < 5000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
      // After waiting, _online has been updated by refresh(), so we're done
      if (waited >= 5000) return;
      return;
    }
    try {
      const info   = await apiFetch('/internal/bot-info', { timeout: 3_000 });
      this.ws.ping    = info.ping;
      this.uptime     = info.uptime;
      if (info.id) this.user = { id: info.id, username: info.username };
      // Mirror the bot's isReady() — but apply the same 2-failure debounce to
      // the ready:false case as the catch block uses for network errors.
      // Without this, a single ready:false response (normal during the Discord
      // gateway reconnect window after a restart) immediately stomps _online=false,
      // racing against the refresh() fast-retry and leaving /servers stuck on
      // "offline" until the next 5s poll cycle. The catch block already had this
      // debounce; the ready:false success path was missing it — that was the bug.
      if (info.ready === true) {
        this._online       = true;
        this._refreshFails = 0;
      } else {
        // API reachable but gateway not ready yet (mid-reconnect after restart).
        // Don't flip _online immediately — wait for 2+ consecutive not-ready
        // responses before declaring offline, matching the catch block behaviour.
        this._refreshFails = (this._refreshFails || 0) + 1;
        if (this._refreshFails >= 2) {
          this._online = false;
        }
        // refresh() fast-retry is already in progress; no need to schedule here.
      }
    } catch (err) {
      // Only flip _online to false after 2+ consecutive failures — a single
      // transient error (e.g. a brief bot restart window) shouldn't override
      // the last known-good state set by refresh().
      this._refreshFails = (this._refreshFails || 0) + 1;
      if (this._refreshFails >= 2) {
        this._online = false;
      }
      this.ws.ping = -1;
      this.uptime  = 0;
    }
  }

  // Pre-populate a guild's channels and roles (call before route handler needs them)
  async hydrateGuild(guildId) {
    const guild = this.guilds.cache.get(guildId);
    if (!guild) return null;
    const [channels, roles] = await Promise.all([
      guild.channels.fetchAll(),
      apiGet(`/internal/guild/${guildId}/roles`).then(list => new FakeCollection(list)),
    ]);
    guild._channels = channels;
    guild._roles    = roles;
    return guild;
  }

  _makeModuleManagerProxy() {
    return {
      getAllStatus: async () => apiGet('/internal/modules'),
      getStatus:   async (name) => apiGet(`/internal/modules/${name}`),
      getLogs:     async (name, limit = 50) => apiGet(`/internal/modules/${name}/logs?limit=${limit}`),
      start:       async (name) => apiPost(`/internal/modules/${name}/start`),
      stop:        async (name) => apiPost(`/internal/modules/${name}/stop`),
      restart:     async (name) => apiPost(`/internal/modules/${name}/restart`),
      disable:     async (name) => apiPost(`/internal/modules/${name}/disable`),
      enable:      async (name) => apiPost(`/internal/modules/${name}/enable`),
    };
  }

  _makeGranularManagerProxy() {
    return {
      getAll:          ()          => apiGet('/internal/granular'),
      getAllEvents:     ()          => apiGet('/internal/granular/events'),
      getAllCommands:   ()          => apiGet('/internal/granular/commands'),
      getAllSystems:    ()          => apiGet('/internal/granular/systems'),
      enableEvent:     (key)       => apiPost(`/internal/granular/events/${encodeURIComponent(key)}/enable`),
      disableEvent:    (key)       => apiPost(`/internal/granular/events/${encodeURIComponent(key)}/disable`),
      enableCommand:   (name)      => apiPost(`/internal/granular/commands/${encodeURIComponent(name)}/enable`),
      disableCommand:  (name)      => apiPost(`/internal/granular/commands/${encodeURIComponent(name)}/disable`),
      enableSystem:    (key)       => apiPost(`/internal/granular/systems/${encodeURIComponent(key)}/enable`),
      disableSystem:   (key)       => apiPost(`/internal/granular/systems/${encodeURIComponent(key)}/disable`),
      isCommandEnabled: (name)     => true, // optimistic; real state lives on the bot side
      isEventEnabled:   (key)      => true,
      isSystemEnabled:  (key)      => true,
    };
  }
  _makeGlobalPermsProxy() {
    return {
      // Global-perms bulk updates can take several minutes on large servers.
      // Use a 5-minute timeout so the dashboard doesn't prematurely throw
      // BotOfflineError while Discord is still processing the permission changes.
      apply: (guildId, body) => apiFetch(`/internal/guild/${guildId}/global-perms/apply`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
        timeout: 5 * 60 * 1000,
      }),
    };
  }
}

module.exports = { BotClientShim, FakeGuild, FakeChannel, FakeCollection, apiGet, apiPost, apiDel, BotOfflineError };