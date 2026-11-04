"use strict";

/**
 * canvasUtils.js
 *
 * Two exports:
 *   drawBackground(ctx, W, H, theme?)  — paint a procedural background onto an
 *                                        existing canvas context. No network calls.
 *   loadAvatar(url)                    — fetch a remote image via Node https and
 *                                        return a Buffer. Pass the Buffer straight
 *                                        to loadImage() so the raw HTTP fetch is
 *                                        under our control (timeouts, retries,
 *                                        fallback). Never throws — returns null on
 *                                        any failure so callers can skip drawing.
 *
 * 429 HANDLING
 *   Discord CDN enforces per-IP rate limits on avatar/CDN URLs. We handle this with:
 *     • An in-memory LRU-style cache (up to 256 entries, 10-minute TTL)
 *     • Exponential backoff with jitter on 429 / 5xx (up to MAX_RETRIES attempts)
 *     • Respects Retry-After header when present
 *     • Falls back to the default Discord avatar before giving up entirely
 */

const https = require("https");
const http  = require("http");

/* ─────────────────────────────────────────────────────────────────────────────
   IN-MEMORY AVATAR CACHE
   Keyed by URL. Entries expire after CACHE_TTL_MS and the cache is capped at
   CACHE_MAX entries (LRU eviction via insertion-order Map).
───────────────────────────────────────────────────────────────────────────── */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX    = 256;

/** @type {Map<string, { buf: Buffer, expiresAt: number }>} */
const _cache = new Map();

function _cacheGet(url) {
  const entry = _cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(url); return null; }
  return entry.buf;
}

function _cacheSet(url, buf) {
  // LRU eviction — delete oldest entry when at capacity
  if (_cache.size >= CACHE_MAX) {
    _cache.delete(_cache.keys().next().value);
  }
  _cache.set(url, { buf, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* ─────────────────────────────────────────────────────────────────────────────
   RETRY CONFIG
───────────────────────────────────────────────────────────────────────────── */

const MAX_RETRIES   = 3;    // total attempts (1 initial + 2 retries)
const BASE_DELAY_MS = 800;  // base backoff delay
const MAX_DELAY_MS  = 8000; // cap per retry

const DEFAULT_AVATAR_URL =
  "https://cdn.discordapp.com/embed/avatars/0.png";

/* ─────────────────────────────────────────────────────────────────────────────
   INTERNAL FETCH — returns a Buffer or throws
───────────────────────────────────────────────────────────────────────────── */

function _fetchBuffer(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); }
    catch { return reject(new Error("Invalid URL: " + url)); }

    const lib     = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers: {
        "User-Agent": "DiscordBot (Roco, 1.0)",
        "Accept":     "image/png,image/jpeg,image/webp,image/*",
      },
    };

    const req = lib.request(options, (res) => {
      // Follow a single redirect
      if (
        (res.statusCode === 301 || res.statusCode === 302 ||
         res.statusCode === 307 || res.statusCode === 308) &&
        res.headers.location
      ) {
        res.resume();
        return _fetchBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }

      // Surface rate-limit / server errors so retry logic can act on them
      if (res.statusCode === 429 || (res.statusCode >= 500 && res.statusCode < 600)) {
        const retryAfterHeader = res.headers["retry-after"];
        const retryAfterMs     = retryAfterHeader
          ? Math.min(parseFloat(retryAfterHeader) * 1000, MAX_DELAY_MS)
          : null;
        res.resume();
        const err      = new Error("HTTP " + res.statusCode + " for " + url);
        err.statusCode = res.statusCode;
        err.retryAfter = retryAfterMs;
        return reject(err);
      }

      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        const err      = new Error("HTTP " + res.statusCode + " for " + url);
        err.statusCode = res.statusCode;
        return reject(err);
      }

      const chunks = [];
      res.on("data",  (c) => chunks.push(c));
      res.on("end",   ()  => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Timeout fetching " + url));
    });

    req.on("error", reject);
    req.end();
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   EXPONENTIAL BACKOFF HELPER
───────────────────────────────────────────────────────────────────────────── */

function _backoffMs(attempt, err) {
  if (err && err.retryAfter) return Math.min(err.retryAfter, MAX_DELAY_MS);
  // Exponential: 800ms, 1600ms, 3200ms… with ±20% jitter
  const base   = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PUBLIC SAFE LOADER
───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch an image URL as a Buffer, with caching, backoff, and fallback.
 * Safe to pass directly to @napi-rs/canvas loadImage().
 * Never throws — returns null if everything fails.
 *
 * @param {string|null|undefined} url
 * @returns {Promise<Buffer|null>}
 */
async function loadAvatar(url) {
  if (!url || typeof url !== "string") return null;

  // Cache hit — no network needed
  const cached = _cacheGet(url);
  if (cached) return cached;

  let lastErr = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Backoff before every retry (not before the first attempt)
    if (attempt > 0) {
      const wait = _backoffMs(attempt - 1, lastErr);
      await new Promise((r) => setTimeout(r, wait));
    }

    try {
      const buf = await _fetchBuffer(url);
      _cacheSet(url, buf);
      return buf;
    } catch (err) {
      lastErr = err;
      // Don't retry permanent client errors (4xx that aren't 429)
      const code = err.statusCode;
      if (code && code !== 429 && code >= 400 && code < 500) break;
    }
  }

  // All attempts for original URL failed — try the Discord default avatar
  if (url !== DEFAULT_AVATAR_URL) {
    const fallbackCached = _cacheGet(DEFAULT_AVATAR_URL);
    if (fallbackCached) return fallbackCached;

    try {
      const buf = await _fetchBuffer(DEFAULT_AVATAR_URL);
      _cacheSet(DEFAULT_AVATAR_URL, buf);
      return buf;
    } catch { /* give up entirely */ }
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROCEDURAL BACKGROUNDS
   All drawn purely with canvas 2D APIs — zero network, zero external files.
───────────────────────────────────────────────────────────────────────────── */

function drawBackground(ctx, W, H, theme = "dark") {
  const themes = {
    dark: {
      stops:   [["#0f172a", 0], ["#1e293b", 0.5], ["#0f172a", 1]],
      accent1: "#334155",
      accent2: "#1e40af",
      glow:    "rgba(99,102,241,0.12)",
      dots:    "rgba(255,255,255,0.035)",
      border:  "rgba(255,255,255,0.10)",
    },
    purple: {
      stops:   [["#1a0533", 0], ["#2d1060", 0.45], ["#0d0221", 1]],
      accent1: "#6d28d9",
      accent2: "#7c3aed",
      glow:    "rgba(139,92,246,0.18)",
      dots:    "rgba(255,255,255,0.04)",
      border:  "rgba(139,92,246,0.25)",
    },
    green: {
      stops:   [["#064e3b", 0], ["#065f46", 0.5], ["#022c22", 1]],
      accent1: "#10b981",
      accent2: "#059669",
      glow:    "rgba(16,185,129,0.15)",
      dots:    "rgba(255,255,255,0.04)",
      border:  "rgba(16,185,129,0.4)",
    },
    invite: {
      stops:   [["#1e1b4b", 0], ["#312e81", 0.5], ["#1e1b4b", 1]],
      accent1: "#8b5cf6",
      accent2: "#6d28d9",
      glow:    "rgba(139,92,246,0.14)",
      dots:    "rgba(255,255,255,0.035)",
      border:  "rgba(139,92,246,0.5)",
    },
  };

  const t = themes[theme] || themes.dark;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  for (const [color, stop] of t.stops) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const spots = [
    { x: W * 0.15, y: H * 0.25, r: W * 0.45 },
    { x: W * 0.85, y: H * 0.75, r: W * 0.35 },
  ];
  for (const s of spots) {
    const rg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    rg.addColorStop(0, t.glow);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = t.dots;
  for (let x = 32; x < W; x += 48) {
    for (let y = 32; y < H; y += 48) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = t.accent1;
  ctx.lineWidth   = 1;
  for (let i = -H; i < W + H; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.018;
  ctx.fillStyle   = "#ffffff";
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < 800; i++) {
    ctx.fillRect(rand() * W, rand() * H, rand() * 3 + 1, rand() * 3 + 1);
  }
  ctx.restore();
}

module.exports = { drawBackground, loadAvatar };