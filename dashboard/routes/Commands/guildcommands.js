'use strict';
const express          = require('express');
const router           = express.Router();
const path             = require('path');
const { isAuth, checkDashboardAccess, sendHTMLWithNonce } = require('../../middleware');
const GuildCommands    = require('../../../Schemas/Guildcommandsschema');
const CustomBranding   = require('../../../Schemas/customBrandingSchema');

const BOT_API = () => process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';
const API_SECRET = () => process.env.INTERNAL_API_SECRET || '';

// ── Helper: sync a command enable/disable to Discord (RankCore or CB) ─────────────
// For RankCore: PUT guild-scoped command to appear only in that guild (enable),
//           or DELETE it (disable).
// For CB:   hit the CB-specific internal API toggle which updates disabledCommands
//           and sends RELOAD_COMMANDS to the live worker.
//
// commandPayload — the full command JSON from registeredCommands.json (only needed for enable on RankCore).
// We lazy-load registeredCommands once per process.
// Re-read on each call: the bot rewrites this file on every start.
const REGISTERED_FILE = path.join(__dirname, '../../../src/data/registeredCommands.json');
function getRegisteredCommands() {
  try { return JSON.parse(require('fs').readFileSync(REGISTERED_FILE, 'utf8')); } catch { return []; }
}

// Built-in commands are global and ON by default; the DB stores what a server switched OFF.
const ALWAYS_ON = new Set(['help', 'report', 'redeem', 'premium']);
async function getDisabledSet(guildId) {
  const doc = await GuildCommands.findOne({ guildId }, { disabledCommands: 1 }).lean();
  return new Set(doc?.disabledCommands ?? []);
}

async function syncCommandToDiscord(guildId, commandName, enabled) {
  const base = BOT_API();
  const headers = { 'Content-Type': 'application/json', 'x-internal-secret': API_SECRET() };

  // Check if this guild has an active CB bot
  const cb = await CustomBranding.findOne({ guildId, setupState: 'active' }).select('botClientId').lean();

  if (cb?.botClientId) {
    // ── CB path: let the internal API update disabledCommands + reload the worker ──
    const r = await fetch(`${base}/internal/cb/commands/${guildId}/${encodeURIComponent(commandName)}/toggle`, {
      method: 'POST', headers,
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `CB toggle failed: ${r.status}`);
    }
    return { target: 'cb' };
  }

  // ── RankCore path: register/deregister as a guild-scoped command ─────────────────
  // This makes it appear (or disappear) immediately in just this guild's command list.
  const r = await fetch(`${base}/internal/guild/${guildId}/commands/sync`, {
    method: 'POST', headers,
    body: JSON.stringify({ commandName, enabled }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Guild command sync failed: ${r.status}`);
  }
  return { target: 'noxx' };
}

// ── Helper: fetch with timeout ────────────────────────────────────────────────
// Default raised to 30 s. Bulk Discord syncs pass 120_000 explicitly because
// registering/deregistering 50-100 guild-scoped commands hits Discord rate
// limits and can take well over 10 s. The old 10 s default was the root cause
// of the "operation was aborted" + commands-disappear-on-restart bug:
//   1. bulkSyncToDiscord timed out at 10 s before Discord finished syncing.
//   2. The error was swallowed, leaving Discord with no guild-scoped commands.
//   3. On restart nothing re-registers them, so they stay gone.
function fetchWithTimeout(url, opts = {}, ms = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ── Helper: bulk sync (toggle multiple commands at once) ─────────────────────
// Fully self-contained — MUST NOT throw. All errors are swallowed here so
// a background Discord sync failure never crashes the dashboard process.
async function bulkSyncToDiscord(guildId, commandNames, enabled) {
  try {
    const base    = BOT_API();
    const headers = { 'Content-Type': 'application/json', 'x-internal-secret': API_SECRET() };

    const cb = await CustomBranding.findOne({ guildId, setupState: 'active' })
      .select('botClientId').lean().catch(() => null);

    if (cb?.botClientId) {
      // CB path: toggle each command (best-effort, no throw on individual failure)
      // 120 s timeout — toggling many commands against Discord rate-limits is slow.
      for (const name of commandNames) {
        await fetchWithTimeout(
          `${base}/internal/cb/commands/${guildId}/${encodeURIComponent(name)}/toggle`,
          { method: 'POST', headers, body: JSON.stringify({ enabled }) },
          120_000
        ).catch(() => {});
      }
      // Single resync at the end
      await fetchWithTimeout(
        `${base}/internal/cb/commands/${guildId}/sync`,
        { method: 'POST', headers },
        120_000
      ).catch(() => {});
      return { target: 'cb' };
    }

    // RankCore path: single bulk-sync call — 120 s, same reasoning
    const r = await fetchWithTimeout(
      `${base}/internal/guild/${guildId}/commands/bulk-sync`,
      { method: 'POST', headers, body: JSON.stringify({ commandNames, enabled }) },
      120_000
    );
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      console.warn(`[guildcommands] Bulk sync non-fatal: ${e.error || r.status}`);
    }
    return { target: 'noxx' };
  } catch (err) {
    // Swallow all errors — background sync is best-effort and must never crash
    console.warn('[guildcommands] bulkSyncToDiscord swallowed error:', err?.message ?? err);
    return { target: 'error' };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
router.get('/guild/:id/commands',
  isAuth, checkDashboardAccess('commands'),
  (req, res) => sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/guild-commands.html'))
);

// ── GET current enabled commands for guild ────────────────────────────────────
router.get('/api/guild/:id/commands', isAuth, checkDashboardAccess('commands'), async (req, res) => {
  const disabled = await getDisabledSet(req.params.id);
  const enabledCommands = getRegisteredCommands().map(c => c.name).filter(n => !disabled.has(n));
  res.json({ enabledCommands, disabledCommands: [...disabled] });
});

// ── GET all available commands ────────────────────────────────────────────────
// When running inline (noxx-bot), req.client.commands is a real Collection.
// When running as a standalone dashboard process, req.client.commands is the
// shim sentinel ({ _isShim: true }), so we proxy to the bot's internal API.
router.get('/api/guild/:id/commands/available', isAuth, checkDashboardAccess('commands'), async (req, res) => {
  const commands = req.client?.commands;

  // Standalone dashboard — proxy to internal API
  if (!commands || commands._isShim) {
    try {
      const BOT_API = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';
      const resp = await fetch(`${BOT_API}/internal/commands`, {
        headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || '' },
      });
      if (!resp.ok) return res.status(503).json({ error: 'Bot not ready' });
      return res.json(await resp.json());
    } catch {
      return res.status(503).json({ error: 'Bot not reachable' });
    }
  }

  // Inline mode — read directly from the Collection.
  // Guard: if commands somehow isn't a real Collection (no .filter), treat as not ready.
  if (typeof commands.filter !== 'function') {
    return res.status(503).json({ error: 'Bot not ready' });
  }

  let list = commands
    .filter(c => c?.data && typeof c.data.toJSON === 'function')
    .map(c => ({
      name:        c.data.name,
      description: c.data.description || '',
      category:    c.category || 'Uncategorized',
      premium:     !!c.premium,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  // #11 — ?enabledOnly=true filters to only enabled commands for this guild
  // Used by the Command Builder so disabled commands don't clutter the picker.
  if (req.query.enabledOnly === 'true') {
    try {
      const disabled = await getDisabledSet(req.params.id);
      list = list.filter(c => ALWAYS_ON.has(c.name) || !disabled.has(c.name));
    } catch (_) { /* non-critical — return full list on error */ }
  }

  res.json(list);
});

// ── POST toggle a command on/off ──────────────────────────────────────────────
router.post('/api/guild/:id/commands/toggle', isAuth, checkDashboardAccess('commands'), async (req, res) => {
  const guildId = req.params.id;
  const { command, enabled } = req.body;
  if (!command || typeof command !== 'string') return res.status(400).json({ error: 'Invalid command' });
  if (ALWAYS_ON.has(command)) return res.status(400).json({ error: `/${command} is always available and cannot be turned off` });

  try {
    await GuildCommands.findOneAndUpdate(
      { guildId },
      enabled ? { $pull: { disabledCommands: command } } : { $addToSet: { disabledCommands: command } },
      { upsert: true }
    );
    res.json({ success: true });

    // Custom Branding bots register their own command list — keep them in sync (best-effort)
    syncCommandToDiscord(guildId, command, enabled).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST enable/disable many commands at once ─────────────────────────────────
router.post('/api/guild/:id/commands/bulk', isAuth, checkDashboardAccess('commands'), async (req, res) => {
  const guildId = req.params.id;
  const { commands, enabled } = req.body;
  if (!Array.isArray(commands)) return res.status(400).json({ error: 'commands must be an array' });

  const filtered = commands.filter(c => typeof c === 'string' && !ALWAYS_ON.has(c));

  try {
    await GuildCommands.findOneAndUpdate(
      { guildId },
      enabled
        ? { $pullAll: { disabledCommands: filtered } }
        : { $addToSet: { disabledCommands: { $each: filtered } } },
      { upsert: true }
    );
    res.json({ success: true });
    bulkSyncToDiscord(guildId, filtered, enabled).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET custom descriptions for guild ────────────────────────────────────────
router.get('/api/guild/:id/commands/descriptions', isAuth, checkDashboardAccess('commands'), async (req, res) => {
  const doc = await GuildCommands.findOne({ guildId: req.params.id }).lean();
  const map = doc?.commandDescriptions || {};
  // Mongoose lean() returns Map as plain object already; ensure it's serialisable
  res.json(map instanceof Map ? Object.fromEntries(map) : map);
});

// ── POST set a custom description for one command ─────────────────────────────
router.post('/api/guild/:id/commands/description', isAuth, checkDashboardAccess('commands'), async (req, res) => {
  const guildId = req.params.id;
  const { command, description } = req.body;
  if (!command || typeof command !== 'string') return res.status(400).json({ error: 'Invalid command' });
  if (command === 'help' || command === 'report') return res.status(400).json({ error: `/${command} is a global command and cannot be customised` });
  if (typeof description !== 'string') return res.status(400).json({ error: 'description must be a string' });

  const trimmed = description.trim().slice(0, 100); // Discord max is 100 chars

  try {
    if (trimmed) {
      await GuildCommands.findOneAndUpdate(
        { guildId },
        { $set: { [`commandDescriptions.${command}`]: trimmed } },
        { upsert: true }
      );
    } else {
      // Empty string = remove override (revert to default)
      await GuildCommands.findOneAndUpdate(
        { guildId },
        { $unset: { [`commandDescriptions.${command}`]: '' } },
        { upsert: true }
      );
    }

    res.json({ success: true, description: trimmed || null });

    // Background: re-sync the command to Discord with the new description
    syncCommandToDiscord(guildId, command, true).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Startup: restore guild-scoped command registrations after restart ─────────
// The bot wipes in-memory Discord command registrations on restart. Fire a
// background restore as soon as this router is loaded so the DB state is
// reflected in Discord without any user action needed.
// We defer by 15 s to give the bot time to finish its Ready event + guild cache
// population before we start hitting Discord's REST API.
setTimeout(() => {
  const base    = BOT_API();
  const headers = { 'Content-Type': 'application/json', 'x-internal-secret': API_SECRET() };
  fetch(`${base}/internal/guild/commands/restore-all`, { method: 'POST', headers })
    .catch(err => console.warn('[guildcommands] Startup restore-all fire failed (non-fatal):', err.message));
}, 15_000);

module.exports = router;