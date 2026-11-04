'use strict';

/**
 * blacklist.js — interaction blacklist gate with in-memory cache.
 *
 * WHY: checkBlacklist() runs on every interactionCreate before ANY handler
 * responds. A DB round-trip here (even 20-50 ms) can push showModal() past
 * Discord's hard 3-second ack deadline, causing DiscordAPIError[10062].
 *
 * FIX: Load all blacklisted userIds into a Map on startup and refresh every
 * 60 seconds. The synchronous Map.has() lookup costs ~0 ms, so the interaction
 * token is never burned before showModal/reply is called.
 *
 * Exports:
 *   checkBlacklist(interaction, client) — drop-in replacement, same signature.
 *   refreshBlacklist()                  — call after /blacklist add|remove to
 *                                         update the cache immediately.
 */

const blacklistDB  = require('../../../Schemas/blacklistSchema');
const { MessageFlags } = require('discord.js');

// ── In-memory cache ───────────────────────────────────────────────────────────
// Map<userId, reason>
const _cache      = new Map();
let   _lastLoad   = 0;
const TTL_MS      = 60_000; // refresh floor: every 60 s
let   _refreshing = false;

async function _load() {
  if (_refreshing) return;
  _refreshing = true;
  try {
    const rows = await blacklistDB.find({}, { userId: 1, reason: 1, _id: 0 }).lean();
    _cache.clear();
    for (const row of rows) _cache.set(row.userId, row.reason ?? 'No reason provided.');
    _lastLoad = Date.now();
  } catch (err) {
    console.error('[Blacklist] Cache refresh failed:', err.message);
  } finally {
    _refreshing = false;
  }
}

// Kick off initial load immediately (non-blocking -- interactions arriving before
// it completes fall back to a live DB query, see checkBlacklist below).
_load();

// Periodic background refresh so the cache stays fresh without blocking anything.
setInterval(_load, TTL_MS).unref();

/**
 * Force an immediate cache refresh. Call this from /blacklist add and /blacklist remove
 * so the change takes effect in the next interaction without waiting for the TTL.
 */
async function refreshBlacklist() {
  await _load();
}

// ── Drop-in replacement ───────────────────────────────────────────────────────

module.exports = async function checkBlacklist(interaction, client) {
  const userId = interaction.user?.id;
  if (!userId) return false;

  // If the cache has never loaded (bot just started, still awaiting first _load),
  // fall back to a live query so we don't skip the check entirely.
  let reason;
  if (_lastLoad === 0) {
    const row = await blacklistDB.findOne({ userId }).lean();
    reason = row?.reason;
  } else {
    reason = _cache.get(userId); // synchronous -- costs ~0 ms
  }

  if (reason !== undefined) {
    try {
      await interaction.reply({
        content: `**You are blacklisted from using this bot.**\nReason: **${reason}**`,
        flags: MessageFlags.Ephemeral,
      });
    } catch { /* interaction may already be dead */ }

    try {
      const { sendAlert } = require('./slash');
      sendAlert('blacklist-blocked', { interaction, reason }, client);
    } catch { /* non-critical */ }

    return true;
  }

  return false;
};

module.exports.refreshBlacklist = refreshBlacklist;