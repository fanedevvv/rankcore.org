'use strict';
/**
 * dashboard/routes/Utils/apiRateLimiter.js
 *
 * Tiered in-memory rate limiters for the dashboard API.
 * These sit ON TOP of the global MongoDB-backed limiter in globalRateLimiter.js
 * which handles IP banning and persistent strike tracking.
 *
 * These limiters are fast, in-memory, and scoped to specific route groups
 * so that botnet bursts are stopped before they ever hit the DB or bot API.
 *
 * Tiers (applied in index.js before route handlers):
 *
 *   AUTH     — /login, /auth/discord/callback
 *              5 req / 5 min per IP.  Protects OAuth flow from abuse.
 *
 *   API_WRITE — POST/PUT/DELETE to /api/*
 *              15 req / min per IP.  Stops bulk mutation floods.
 *
 *   API_READ  — GET to /api/*  (excluding public endpoints below)
 *              30 req / min per IP.  Still strict but allows normal browsing.
 *
 *   DEV_API   — /api-dev/*
 *              10 req / min per IP.  Low volume expected; tight cap.
 *
 *   PUBLIC    — /api/csrf-token, /api/status/*, /api/me
 *              60 req / min per IP.  Must stay accessible for page loads.
 */

// ─── In-memory store ──────────────────────────────────────────────────────────
// Map<limiterName+ip, { count, resetAt }>
const stores = new Map();

// Purge stale entries every 2 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of stores) {
    if (now >= entry.resetAt) stores.delete(key);
  }
}, 2 * 60_000).unref();

// ─── Core factory ─────────────────────────────────────────────────────────────
/**
 * Creates a rate-limit middleware.
 *
 * @param {string}   name      - Unique limiter name (used as key prefix)
 * @param {number}   max       - Max requests per window
 * @param {number}   windowMs  - Window size in ms
 * @param {string}   [message] - Error message on 429
 */
function createLimiter(name, max, windowMs, message) {
  message = message || `Too many requests. Please slow down and try again shortly.`;

  return function rateLimitMiddleware(req, res, next) {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${name}:${ip}`;
    const now = Date.now();

    let entry = stores.get(key);

    if (!entry || now >= entry.resetAt) {
      stores.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

    if (entry.count > max) {
      res.set('Retry-After', String(retryAfterSec));
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
      return res.status(429).json({ error: message, retryAfter: retryAfterSec });
    }

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    return next();
  };
}

// ─── Tier definitions ─────────────────────────────────────────────────────────

/**
 * AUTH — 5 requests per 5 minutes.
 * Applied to: GET /login, GET /auth/discord/callback
 */
// /login and /callback both count, so 5 allowed only ~2 login attempts
const authLimiter = createLimiter(
  'auth',
  12,
  5 * 60_000,
  'Too many login attempts. Please wait a few minutes before trying again.'
);

/**
 * API_WRITE — 15 requests per minute.
 * Applied to: POST, PUT, PATCH, DELETE on /api/*
 */
const apiWriteLimiter = createLimiter(
  'api_write',
  40,
  60_000,
  'Too many write requests. Please wait before making more changes.'
);

/**
 * API_READ — 30 requests per minute.
 * Applied to: GET on /api/* (excluding public endpoints)
 */
// A single settings page loads 5-8 endpoints (channels, roles, config, premium
// status…), so 30/min blocked normal browsing after a few pages.
const apiReadLimiter = createLimiter(
  'api_read',
  150,
  60_000,
  'Too many requests. Please slow down.'
);

/**
 * DEV_API — 10 requests per minute.
 * Applied to: all methods on /api-dev/*
 */
const devApiLimiter = createLimiter(
  'dev_api',
  120,
  60_000,
  'Dev API rate limit exceeded.'
);
/**
 * PUBLIC — 60 requests per minute.
 * Applied to: /api/csrf-token, /api/status/*, /api/me
 * Must stay loose — these are hit on every page load.
 */
const publicApiLimiter = createLimiter(
  'public_api',
  60,
  60_000,
  'Too many requests.'
);

// ─── Composite middleware ─────────────────────────────────────────────────────

/**
 * smartApiLimiter — single middleware that routes to the correct tier
 * based on the request path and method.
 *
 * Mount this on router.use('/api') and router.use('/api-dev') BEFORE route handlers.
 */
function smartApiLimiter(req, res, next) {
  const path   = req.path;
  const method = req.method;

  // Dev API — tightest cap, always
  if (req.originalUrl?.startsWith('/api-dev') || path.startsWith('/api-dev')) {
    return devApiLimiter(req, res, next);
  }

  // Public endpoints — must stay accessible for page loads
  const isPublic =
    path === '/csrf-token'         ||
    path === '/me'                 ||
    path.startsWith('/status')     ||
    path.startsWith('/ipverify');

  if (isPublic) {
    return publicApiLimiter(req, res, next);
  }

  // Write methods — tighter cap
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return apiWriteLimiter(req, res, next);
  }

  // Everything else under /api — read limiter
  return apiReadLimiter(req, res, next);
}

/**
 * authRouteLimiter — apply to login + OAuth callback routes only.
 */
const authRouteLimiter = authLimiter;

module.exports = { smartApiLimiter, authRouteLimiter };