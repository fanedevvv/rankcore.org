/**
 * dashboard/routes/Utils/giveawayRateLimit.js
 *
 * Lightweight in-memory rate limiter for giveaway mutation endpoints.
 * Keyed on  userId + guildId + action  so each user is limited independently
 * per server, per operation — no DB round-trip needed.
 *
 * Usage:
 *   const limit = require('./Utils/giveawayRateLimit');
 *   router.post('/api/guild/:id/giveaways', isAuth, checkDashboardAccess('giveaway'), limit('create'), handler);
 */

'use strict';

// ─── Limits per action ────────────────────────────────────────────────────────
// { max } requests per { windowMs } milliseconds.
// After the window expires the counter resets automatically.
const LIMITS = {
  create: { max: 3,  windowMs: 60_000,  label: 'create'  }, // 3 per minute
  end:    { max: 5,  windowMs: 60_000,  label: 'end'     }, // 5 per minute
  update: { max: 10, windowMs: 60_000,  label: 'update'  }, // 10 per minute
  delete: { max: 5,  windowMs: 60_000,  label: 'delete'  }, // 5 per minute
  reroll: { max: 5,  windowMs: 60_000,  label: 'reroll'  }, // 5 per minute
};

// ─── In-memory store ──────────────────────────────────────────────────────────
// Map<key, { count, resetAt }>
const store = new Map();

// Purge stale entries every 5 minutes to avoid unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 5 * 60_000).unref();

// ─── Middleware factory ───────────────────────────────────────────────────────
function giveawayRateLimit(action) {
  const cfg = LIMITS[action];
  if (!cfg) throw new Error(`[giveawayRateLimit] Unknown action: "${action}"`);

  return function rateLimitMiddleware(req, res, next) {
    const userId  = req.user?.id;
    const guildId = req.params.id;

    // Should never happen after isAuth, but be safe.
    if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

    const key = `${userId}:${guildId}:${action}`;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      // Fresh window
      store.set(key, { count: 1, resetAt: now + cfg.windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > cfg.max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: `Too many ${cfg.label} requests. Please wait ${retryAfterSec}s before trying again.`,
        retryAfter: retryAfterSec,
      });
    }

    return next();
  };
}

module.exports = giveawayRateLimit;