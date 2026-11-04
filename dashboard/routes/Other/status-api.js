'use strict';

const express = require('express');
const router  = express.Router();
const path    = require('path');

const StatusSnapshot  = require('../../../Schemas/StatusSnapshot');
const Incident        = require('../../../Schemas/Incident');
const StatusOverride  = require('../../../Schemas/StatusOverride');
const redisCache = require('../../../src/lib/cache');
const { getStatus: getRedisStatus } = require('../../../src/lib/redis');

const { isAuth, sendHTMLWithNonce } = require('../../middleware');

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
const HISTORY_MAX_DAYS     = 180;

// ── Status Override ───────────────────────────────────────────────────────────
async function loadStatusOverride() {
  try {
    return await StatusOverride.getOverride();
  } catch { return null; }
}

// ── Snapshot recording ────────────────────────────────────────────────────────
async function recordSnapshot(status, ping, degradedModules = []) {
  return StatusSnapshot.recordSnapshot(Date.now(), status, ping, degradedModules);
}

// ── Daily history ─────────────────────────────────────────────────────────────
async function buildDailyHistory() {
  return StatusSnapshot.buildDailyHistory();
}

// ── Incident helpers ─────────────────────────────────────────────────────────
function fmtTs(ts) {
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });
}

function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1)  return 'less than 1 minute';
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''}`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}h${rm ? ` ${rm}m` : ''}`;
}

function sanitiseError(raw) {
  if (!raw) return null;
  return String(raw)
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{27,}/g, '[TOKEN]')
    .replace(/(token|secret|password|passwd|pwd|key|auth|bearer|api[_-]?key|client[_-]?secret|mongo(?:db)?(?:[_-]?uri)?|db[_-]?url|dsn|webhook)\s*[=:]\s*\S+/gi,
      (_, k) => `${k.toLowerCase()}=[REDACTED]`)
    .replace(/(?:mongodb(?:\+srv)?|redis|postgresql?|mysql|amqp):\/\/[^\s]+/gi, '[CONNECTION_STRING]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[IP]')
    .replace(/(?:\/(?:home|root|var|etc|opt|usr|srv|proc|app|bot|Roco)[^\s,]*|[A-Z]:\\[^\s,]+)/g, '[PATH]')
    .replace(/(?:src|dist|build|routes|events|commands|handlers|modules|systems)[\/\\][^\s,"']+/g, '[PATH]')
    .replace(/\bfile:\/\/[^\s]*/g, '[FILE_URL]')
    .slice(0, 300)
    .trim();
}

function moduleImpactSentence(modules) {
  if (!modules || !modules.length) return null;
  const byState = {};
  for (const m of modules) (byState[m.state] = byState[m.state] || []).push(m);
  const parts = [];
  for (const [state, mods] of Object.entries(byState)) {
    const names = mods.map(m => m.label || m.name).join(', ');
    parts.push(`${names} (${state})`);
  }
  const base = `Affected module${modules.length > 1 ? 's' : ''}: ${parts.join('; ')}.`;
  const withErrors = modules.filter(m => m.error);
  if (withErrors.length) {
    const errLines = withErrors
      .map(m => `${m.label || m.name}: "${sanitiseError(m.error)}"`)
      .join('; ');
    return base + ` Reported error${withErrors.length > 1 ? 's' : ''}: ${errLines}.`;
  }
  return base;
}

function incidentTitle(severity, modules) {
  if (severity === 'down') return 'Bot offline — connection lost';
  const names = (modules || []).map(m => m.label || m.name);
  if (names.length === 1) return `${names[0]} — module degraded`;
  if (names.length > 1)
    return `Multiple modules degraded (${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''})`;
  return 'Partial service degradation';
}

async function openIncident(context) {
  try {
    const existing = await Incident.findOne({ status: 'ongoing' });
    if (existing) return;

    const { severity, modules = [], ping = -1, uptimeMsAtFail = 0 } = context;
    const now = Date.now();
    const lines = [];

    if (severity === 'down') {
      lines.push('The bot lost its connection to Discord and is currently offline.');
      lines.push('The service is being monitored and will attempt to reconnect automatically.');
      if (ping > 0) lines.push(`Last recorded WebSocket ping before disconnect: ${ping}ms.`);
      if (context._cronError) lines.push(`Snapshot error: "${sanitiseError(context._cronError)}".`);
    } else {
      lines.push('One or more modules entered a degraded state. The bot process is running but some features may be unavailable.');
      const impact = moduleImpactSentence(modules);
      if (impact) lines.push(impact);
      if (ping > 0) lines.push(`WebSocket ping at time of detection: ${ping}ms.`);
    }

    if (uptimeMsAtFail > 60000) {
      lines.push(`Bot had been running continuously for ${fmtDuration(uptimeMsAtFail)} before this event.`);
    }

    lines.push(`Incident detected at ${fmtTs(now)}.`);

    await Incident.create({
      incidentId:        `inc_${now}`,
      openedAt:          now,
      resolvedAt:        null,
      status:            'ongoing',
      severity,
      title:             incidentTitle(severity, modules),
      body:              lines.join(' '),
      modulesAtOpen:     modules.map(m => m.name).sort(),
      updates:           [],
    });

    console.log(`[status/incidents] Incident opened: inc_${now} (${severity}) — ${modules.length} module(s) affected`);
  } catch (err) {
    console.error('[status/incidents] openIncident error:', err.message);
  }
}

async function maybeAddIncidentUpdate(currentModules) {
  try {
    const inc = await Incident.findOne({ status: 'ongoing' });
    if (!inc) return;

    const currentNames = currentModules.map(m => m.name).sort();
    const lastNames    = (inc.modulesAtOpen || []).slice().sort();

    if (JSON.stringify(currentNames) === JSON.stringify(lastNames)) return;

    const now      = Date.now();
    const added    = currentNames.filter(n => !lastNames.includes(n));
    const resolved = lastNames.filter(n => !currentNames.includes(n));

    const lines = [];
    if (added.length)    lines.push(`Additional module${added.length > 1 ? 's' : ''} now degraded: ${added.join(', ')}.`);
    if (resolved.length) lines.push(`Module${resolved.length > 1 ? 's' : ''} recovered: ${resolved.join(', ')}.`);

    const impact = moduleImpactSentence(currentModules);
    if (impact) lines.push(`Current state — ${impact}`);

    if (lines.length) {
      inc.updates.push({ ts: now, body: lines.join(' ') });
      inc.modulesAtOpen = currentNames;
      await inc.save();
      console.log(`[status/incidents] Update added to ${inc.incidentId}: ${lines[0]}`);
    }
  } catch (err) {
    console.error('[status/incidents] maybeAddIncidentUpdate error:', err.message);
  }
}

async function resolveIncident(context = {}) {
  try {
    const inc = await Incident.findOne({ status: 'ongoing' });
    if (!inc) return;

    const { ping = -1, recoveredModules = [] } = context;
    const now = Date.now();
    inc.status     = 'resolved';
    inc.resolvedAt = now;

    const durationMs = now - inc.openedAt;
    const lines = [];
    lines.push(`Incident resolved after ${fmtDuration(durationMs)}.`);

    if (recoveredModules.length) {
      lines.push(`Module${recoveredModules.length > 1 ? 's' : ''} restored: ${recoveredModules.join(', ')}.`);
    }
    if (ping > 0) {
      lines.push(`WebSocket ping restored to ${ping}ms.`);
    }
    lines.push(`All systems returned to operational at ${fmtTs(now)}.`);

    inc.body += ' ' + lines.join(' ');
    inc.updates.push({ ts: now, body: lines.join(' ') });

    await inc.save();
    console.log(`[status/incidents] Incident resolved: ${inc.incidentId} (duration: ${fmtDuration(durationMs)})`);
  } catch (err) {
    console.error('[status/incidents] resolveIncident error:', err.message);
  }
}

// ── Snapshot cron ─────────────────────────────────────────────────────────────
let _snapshotTimer = null;
let _cronStarted   = false;
let _clientRef     = null;
let _seenUpOnce    = false;
let _lastStatus    = null;

const STARTUP_GRACE_MS = 90_000;

async function startSnapshotCron(client) {
  if (_cronStarted) return;
  _cronStarted = true;
  _clientRef   = client;

  // Clean up old data on startup
  try { await Incident.cleanupOld(); } catch {}
  try {
    const cutoff = Date.now() - HISTORY_MAX_DAYS * 86400000;
    await StatusSnapshot.deleteMany({ ts: { $lt: cutoff } });
  } catch {}

  async function takeSnapshot() {
    try {
      if (_clientRef?.isStandaloneMode && typeof _clientRef.refreshStatus === 'function') {
        try { await _clientRef.refreshStatus(); } catch {}
      }

      const botReady      = _clientRef?.isReady?.() ?? false;
      const ping          = botReady ? (_clientRef.ws.ping ?? -1) : -1;
      const uptimeMsNow   = botReady ? (_clientRef.uptime ?? 0) : 0;

      let status          = 'down';
      let degradedModules = [];

      if (botReady) {
        try {
          if (_clientRef?.moduleManager) {
            const all = await _clientRef.moduleManager.getAllStatus();
            if (Array.isArray(all)) {
              const EXTERNAL_MODULES = new Set(['dashboard']);
              degradedModules = all
                .filter(m =>
                  !EXTERNAL_MODULES.has(m.name) && (
                    m.state === 'stopped' ||
                    m.state === 'error'   ||
                    m.state === 'disabled'
                  )
                )
                .map(m => ({
                  name:  m.name  ?? 'Unknown',
                  label: m.label ?? m.name ?? 'Unknown',
                  state: m.state,
                  ...(m.error ? { error: sanitiseError(String(m.error)) } : {}),
                }));
            }
          }
        } catch {}
        status = degradedModules.length > 0 ? 'degraded' : 'up';
      }

      await recordSnapshot(status, ping, degradedModules);
      if (status === 'up') _seenUpOnce = true;

      const canFireIncident = _lastStatus !== null;
      if (canFireIncident) {
        if (_lastStatus === 'up' && (status === 'degraded' || status === 'down')) {
          await openIncident({
            severity:       status === 'down' ? 'down' : 'degraded',
            modules:        degradedModules,
            ping,
            uptimeMsAtFail: uptimeMsNow,
          });
        } else if (status === 'degraded' && (_lastStatus === 'degraded' || _lastStatus === 'down')) {
          await maybeAddIncidentUpdate(degradedModules);
        } else if ((_lastStatus === 'degraded' || _lastStatus === 'down') && status === 'up') {
          const lastSnap = await StatusSnapshot.findOne({
            status: { $ne: 'up' },
            degradedModules: { $exists: true, $ne: [] },
          }).sort({ ts: -1 }).lean();

          const recoveredNames = (lastSnap?.degradedModules || [])
            .map(m => m.label || m.name || m).filter(Boolean);
          await resolveIncident({ ping, recoveredModules: recoveredNames });
        }
      }

      if (status === 'up' && _lastStatus === null) {
        const ongoingAfterRestart = await Incident.findOne({
          status: 'ongoing',
          manuallyTriggered: { $ne: true },
        });
        if (ongoingAfterRestart) {
          const lastSnap = await StatusSnapshot.findOne({
            degradedModules: { $exists: true, $ne: [] },
          }).sort({ ts: -1 }).lean();
          const recoveredNames = (lastSnap?.degradedModules || [])
            .map(m => m.label || m.name || m).filter(Boolean);
          await resolveIncident({ ping, recoveredModules: recoveredNames });
          console.log('[status/incidents] Auto-resolved lingering incident after service restart.');
        }
      }

      if (status === 'up') _seenUpOnce = true;
      _lastStatus = status;

    } catch (err) {
      console.error('[status/snapshot] Error recording uptime snapshot:', err.message);
      if (_seenUpOnce) {
        await recordSnapshot('down', -1);
        if (_lastStatus === 'up') {
          await openIncident({
            severity: 'down',
            modules:  [],
            ping:     -1,
            uptimeMsAtFail: 0,
            _cronError: err.message,
          });
        }
        _lastStatus = 'down';
      }
    }
  }

  setTimeout(() => {
    takeSnapshot();
    _snapshotTimer = setInterval(takeSnapshot, SNAPSHOT_INTERVAL_MS);
    if (_snapshotTimer.unref) _snapshotTimer.unref();
  }, STARTUP_GRACE_MS);
}

// ── Rate limiting ────────────────────────────────────────────────────────────
const RATE_WINDOW_MS   = 60_000;
const RATE_MAX         = 20;
const RATE_BLOCK_MS    = 5 * 60_000;
const RATE_MAX_STRIKES = 3;

const rateMap    = new Map();
const blocked    = new Map();
const strikes    = new Map();
const permBanned = new Set();

const CACHE_TTL_MS = 30_000;
let cache = { data: null, at: 0 };

let _granularInstance = null;
function getGranular() {
  if (_granularInstance) return _granularInstance;
  try {
    const { instance } = require('../../src/core/GranularManager');
    _granularInstance = instance;
  } catch {}
  return _granularInstance;
}

const MODULE_DEFS = [
  { label: 'Event Handlers',         group: 'Core',      key: 'events'          },
  { label: 'Slash Commands',         group: 'Core',      key: 'slash-commands'  },

  { label: 'Function Handlers',      group: 'Core',      key: 'functions'       },
  { label: 'Trigger Handlers',       group: 'Core',      key: 'triggers'        },
  { label: 'Bot Systems',            group: 'Systems',   key: 'systems'         },
  { label: 'Music',                  group: 'Systems',   key: 'music'           },
  { label: 'Cron / Scheduled Tasks', group: 'Systems',   key: 'cron'            },
  { label: 'Error Handlers',         group: 'Systems',   key: 'error-handlers'  },
  { label: 'REST API',               group: 'API',       key: 'api-server'      },
  { label: 'Internal Bridge',        group: 'API',       key: 'internal-api'    },
  { label: 'Log Handlers',           group: 'Utilities', key: 'log-handlers'    },
];

function getIp(req) {
  return (
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    'unknown'
  ).replace('::ffff:', '');
}

function addStrike(ip) {
  const n = (strikes.get(ip) || 0) + 1;
  strikes.set(ip, n);
  if (n >= RATE_MAX_STRIKES) {
    permBanned.add(ip);
    strikes.delete(ip);
    rateMap.delete(ip);
    blocked.delete(ip);
  }
}

function formatMs(ms) {
  if (!ms || ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || `${s}s`;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of rateMap) if (now - r.windowStart > RATE_WINDOW_MS) rateMap.delete(ip);
  for (const [ip, t] of blocked) if (now >= t)                             blocked.delete(ip);
}, 120_000);

function statusRateLimit(req, res, next) {
  const ip  = getIp(req);
  const now = Date.now();

  if (permBanned.has(ip))
    return res.status(403).json({ error: 'Forbidden.' });

  const blockedUntil = blocked.get(ip);
  if (blockedUntil) {
    if (now < blockedUntil)
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    blocked.delete(ip);
  }

  let r = rateMap.get(ip);
  if (!r || now - r.windowStart > RATE_WINDOW_MS) r = { count: 1, windowStart: now };
  else r.count++;
  rateMap.set(ip, r);

  if (r.count > RATE_MAX) {
    addStrike(ip);
    blocked.set(ip, now + RATE_BLOCK_MS);
    res.setHeader('Retry-After', Math.ceil(RATE_BLOCK_MS / 1000).toString());
    return res.status(429).json({ error: 'Rate limit exceeded. Slow down.' });
  }

  next();
}

function browserOnly(req, res, next) {
  const fetchSite = req.headers['sec-fetch-site'];
  const fetchMode = req.headers['sec-fetch-mode'];
  const fetchDest = req.headers['sec-fetch-dest'];
  const accept    = (req.headers['accept'] || '').toLowerCase();
  const ua        = (req.headers['user-agent'] || '').trim();

  if (!fetchSite || !fetchMode || !fetchDest) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const isApiRoute = req.path.startsWith('/api/');

  if (isApiRoute) {
    if (!['same-origin', 'same-site'].includes(fetchSite)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (!['cors', 'same-origin'].includes(fetchMode)) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (fetchDest !== 'empty') {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (!accept.includes('application/json') && !accept.includes('*/*')) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
  } else {
    if (fetchMode !== 'navigate' || fetchDest !== 'document') {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    if (!accept.includes('text/html') && !accept.includes('*/*')) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
  }

  if (!ua) return res.status(403).json({ error: 'Forbidden.' });
  if (/^(curl|wget|python[-/ ]|go[-/\s]http|httpie|axios|node-fetch|undici|libwww|java\/|ruby\/|php\/|perl\/|rust|powershell|insomnia|postman)/i.test(ua)) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  next();
}

async function buildStatusResponse(client, req) {
  const now = Date.now();

  if (client?.isStandaloneMode && typeof client.refreshStatus === 'function') {
    try { await client.refreshStatus(); } catch {}
  }

  const override = await loadStatusOverride();

  if (cache.data && (now - cache.at) < CACHE_TTL_MS) {
    const botReady_now    = client?.isReady?.() ?? false;
    const botReady_cached = cache.data?.bot?.ready ?? false;
    const genuinelyOffline = !botReady_now && (client?._refreshFails ?? 0) >= 2;
    if (botReady_now && !botReady_cached) {
      cache = { data: null, at: 0 };
    } else if (genuinelyOffline && botReady_cached) {
      cache = { data: null, at: 0 };
    } else {
      const rs = getRedisStatus();
      const cached = { ...cache.data, override: override ?? null };
      if (override) cached.status = override.status;
      cached.redis = {
        connected:  rs.connected,
        status:     rs.status,
        version:    rs.version || null,
        memory:     rs.usedMemory || null,
        connectedAt: rs.connectedAt,
      };
      cached.wss = {
        enabled:   true,
        connected: client?._wssServer?.connectedCount ?? 0,
      };
      const botReady_c        = botReady_now;
      const sessionStoreOk_c  = !!req?.sessionStore || !!req?.session;
      const oauthOk_c         = true;
      cached.dashboard = {
        state: 'operational',
        components: [
          { name: 'Express Server',   state: 'operational' },
          { name: 'Discord OAuth2',   state: oauthOk_c        ? 'operational' : 'degraded'    },
          { name: 'Session Store',    state: sessionStoreOk_c ? 'operational' : 'starting'    },
          { name: 'Internal Bridge',  state: botReady_c       ? 'operational' : 'degraded'    },
          { name: 'Route Middleware', state: 'operational' },
          { name: 'Maintenance Mode', state: 'operational' },
        ],
      };
      const dStates = cached.dashboard.components.map(c => c.state);
      if (dStates.includes('degraded'))      cached.dashboard.state = 'degraded';
      else if (dStates.includes('starting')) cached.dashboard.state = 'starting';
      return cached;
    }
  }

  const botReady = client?.isReady?.() ?? false;

  const moduleMap = new Map();
  let modulesAvailable = false;
  try {
    if (client?.moduleManager) {
      const all = await client.moduleManager.getAllStatus();
      if (Array.isArray(all) && all.length > 0) {
        for (const entry of all) moduleMap.set(entry.name, entry);
        modulesAvailable = true;
      }
    }
  } catch {}

  const effectiveBotReady = botReady || modulesAvailable;

  function moduleState(key) {
    if (!effectiveBotReady) return 'degraded';
    const entry = moduleMap.get(key);
    if (!entry) return 'operational';
    const s = entry.state;
    if (s === 'running')                                       return 'operational';
    if (s === 'starting' || s === 'stopping')                  return 'starting';
    if (s === 'stopped'  || s === 'error' || s === 'disabled') return 'degraded';
    return 'operational';
  }

  const modules = MODULE_DEFS.map(m => ({
    name:  m.label,
    group: m.group,
    state: moduleState(m.key),
  }));

  const runningCount = effectiveBotReady ? modules.filter(m => m.state === 'operational').length : 0;
  const hasError     = modules.some(m => m.state === 'degraded');
  const hasStarting  = modules.some(m => m.state === 'starting');

  let overall;
  if (!effectiveBotReady) overall = 'down';
  else if (hasError)      overall = 'degraded';
  else if (hasStarting)   overall = 'starting';
  else                    overall = 'operational';

  if (override) overall = override.status;

  const stats = effectiveBotReady ? {
    ping:            client.ws.ping,
    uptimeFormatted: formatMs(client.uptime ?? 0),
    guilds:          client.guilds.cache.size,
  } : {
    ping:            -1,
    uptimeFormatted: '0s',
    guilds:          0,
  };

  const dashboard = {
    state: 'operational',
    components: (() => {
      const sessionStoreOk  = !!req?.sessionStore || !!req?.session;
      const oauthConfigured = true;
      const bridgeOk        = botReady;
      return [
        { name: 'Express Server',   state: 'operational' },
        { name: 'Discord OAuth2',   state: oauthConfigured ? 'operational' : 'degraded' },
        { name: 'Session Store',    state: sessionStoreOk   ? 'operational' : 'starting' },
        { name: 'Internal Bridge',  state: bridgeOk         ? 'operational' : 'degraded' },
        { name: 'Route Middleware', state: 'operational' },
        { name: 'Maintenance Mode', state: 'operational' },
      ];
    })(),
  };

  const dashStates = dashboard.components.map(c => c.state);
  if (dashStates.includes('degraded'))    dashboard.state = 'degraded';
  else if (dashStates.includes('starting')) dashboard.state = 'starting';
  else                                      dashboard.state = 'operational';

  const granular = { commands: [], events: [], systems: [] };
  try {
    const gm = client?.granularManager ?? getGranular();
    if (gm) {
      const [cmds, evts, sys] = await Promise.all([
        Promise.resolve(gm.getAllCommands()),
        Promise.resolve(gm.getAllEvents()),
        Promise.resolve(gm.getAllSystems()),
      ]);
      granular.commands = (cmds || []).map(c => ({
        name:     c.name,
        category: c.category ? c.category.split('/').pop() : null,
        enabled:  c.enabled,
      }));
      granular.events = (evts || []).map(e => ({
        key:     e.key ? e.key.split('/').pop() : e.key,
        event:   e.event ?? null,
        group:   e.group ? e.group.split('/').pop() : (e.category ?? null),
        enabled: e.enabled,
      }));
      granular.systems = (sys || []).map(s => ({
        key:     s.key ? s.key.split('/').pop() : s.key,
        label:   s.label ?? (s.key ? s.key.split('/').pop() : s.key),
        group:   s.group ? s.group.split('/').pop() : null,
        enabled: s.enabled,
      }));
    }
  } catch {}

  const granularDisabled = {
    commands: granular.commands.filter(c => !c.enabled).map(c => ({ name: c.name, category: c.category })),
    events:   granular.events.filter(e => !e.enabled).map(e => ({ key: e.key, group: e.group })),
    systems:  granular.systems.filter(s => !s.enabled).map(s => ({ key: s.key, label: s.label, group: s.group })),
  };

  const rs = getRedisStatus();

  const payload = {
    status:      overall,
    override:    override ?? null,
    timestamp:   new Date().toISOString(),
    cachedUntil: new Date(now + CACHE_TTL_MS).toISOString(),
    redis: {
      connected:  rs.connected,
      status:     rs.status,
      version:    rs.version || null,
      memory:     rs.usedMemory || null,
      connectedAt: rs.connectedAt,
    },
    wss: {
      enabled:   true,
      connected: client?._wssServer?.connectedCount ?? 0,
    },
    bot: {
      ready: effectiveBotReady,
      ...stats,
      modules,
      modulesRunning: runningCount,
      modulesTotal:   MODULE_DEFS.length,
    },
    dashboard,
    granular,
    granularDisabled,
    meta: {
      version:        '2.0.5',
      commandCount:   146,
      categoryCount:  17,
      subsystemCount: 20,
    },
  };

  cache = { data: payload, at: now };
  return payload;
}

// ── Routes ─────────────────────────────────────────────────────────────────────
router.get('/status', isAuth, browserOnly, (req, res) => {
  startSnapshotCron(req.client);
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/pages/status.html'));
});

router.get('/api/status/incidents', browserOnly, statusRateLimit, isAuth, async (req, res) => {
  try {
    startSnapshotCron(req.client);
    const incidents = await Incident.find().sort({ openedAt: -1 }).lean();

    const safe = incidents.map(i => ({
      id:          i.incidentId,
      openedAt:    i.openedAt,
      resolvedAt:  i.resolvedAt ?? null,
      status:      i.status,
      severity:    i.severity,
      title:       i.title,
      body:        i.body,
      updates:     i.updates ?? [],
      manuallyTriggered: i.manuallyTriggered || false,
    }));
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ incidents: safe, total: safe.length });
  } catch (err) {
    console.error('[/api/status/incidents] Error:', err);
    res.status(503).json({ error: 'Incidents temporarily unavailable.' });
  }
});

router.get('/api/status/history', browserOnly, statusRateLimit, isAuth, async (req, res) => {
  try {
    startSnapshotCron(req.client);
    const history = await buildDailyHistory();
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(history);
  } catch (err) {
    console.error('[/api/status/history] Error:', err);
    res.status(503).json({ error: 'History temporarily unavailable.' });
  }
});

router.get('/api/status', browserOnly, statusRateLimit, isAuth, async (req, res) => {
  try {
    startSnapshotCron(req.client);
    const c = req.client ?? req.app.locals.client ?? null;
    const standalone = c?.isStandaloneMode ? 'standalone' : 'inline';

    const data = await redisCache.wrap('status', `page:${standalone}`,
      () => buildStatusResponse(c, req),
      15
    );

    res.setHeader('Cache-Control', 'private, no-store');
    res.json(data);
  } catch (err) {
    console.error('[/api/status] Error:', err);
    res.status(503).json({
      status:    'degraded',
      timestamp: new Date().toISOString(),
      error:     'Status temporarily unavailable.',
    });
  }
});

router.get('/api/status/cb-bots', isAuth, async (req, res) => {
  try {
    const CustomBranding = require('../../../Schemas/customBrandingSchema');

    const configs = await CustomBranding.find({}, 'guildId enabled setupState setupError botName').lean();
    if (!configs.length) return res.json([]);

    let liveArr = [];
    try {
      if (!req.client?.isStandaloneMode) {
        const cbm = require('../../../src/core/CustomBrandingManager');
        liveArr = cbm.getAllStatus();
      } else {
        const { apiGet } = require('../../lib/botClient');
        const data = await apiGet('/internal/cb/status');
        liveArr = Array.isArray(data) ? data : [];
      }
    } catch {}

    const liveMap = new Map(liveArr.map(b => [b.guildId, b]));

    const result = configs.map(cfg => {
      const live = liveMap.get(cfg.guildId);
      let state;
      if (live?.state) {
        state = live.state;
      } else if (!cfg.enabled || cfg.setupState === 'disabled') {
        state = 'stopped';
      } else if (cfg.setupState === 'error') {
        state = 'error';
      } else if (cfg.setupState === 'pending') {
        state = 'starting';
      } else {
        state = 'stopped';
      }

      return {
        guildId:  cfg.guildId,
        botTag:   live?.botTag  ?? cfg.botName ?? null,
        state,
        ping:     live?.ping    ?? null,
        uptime:   live?.uptime  ?? null,
        setupState: cfg.setupState,
        enabled:  cfg.enabled,
        error:    cfg.setupState === 'error' ? cfg.setupError : null,
      };
    });

    const order = { running: 0, starting: 1, reconnecting: 2, stopped: 3, error: 4 };
    result.sort((a, b) => (order[a.state] ?? 5) - (order[b.state] ?? 5));

    return res.json(result);
  } catch (e) {
    return res.json([]);
  }
});

router.use('/api/status/*', browserOnly, statusRateLimit, isAuth, (req, res) => {
  addStrike(getIp(req));
  res.status(404).json({ error: 'Not found.' });
});

function bustCache() {
  cache = { data: null, at: 0 };
  redisCache.invalidateNamespace('status').catch(() => {});
}

module.exports = router;
module.exports.bustCache = bustCache;
