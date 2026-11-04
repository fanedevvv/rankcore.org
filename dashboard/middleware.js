const path = require("path");
const Blacklist = require("../Schemas/blacklistSchema");
const getOwners       = require("../Utils/getOwners");
const DashboardRoles  = require("../Schemas/dashboardroles");
const { tierFromDoc, getTier, TIER_ORDER, getLimit } = require("../Utils/premiumTiers");
const PremiumGuild = require("../Schemas/premiumGuildSchema");
const fs = require("fs");

// ─────────────────────────────────────────────
// isAuth
// ─────────────────────────────────────────────
module.exports.isAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect("/login");
};

// ─────────────────────────────────────────────
// checkGuildAccess
// ─────────────────────────────────────────────
const MANAGE_GUILD = 1n << 5n; // 0x20

// How long to reuse a cached guild list before hitting Discord again.
// Discord rate-limits /users/@me/guilds aggressively — calling it on every
// page navigation causes HTTP 429s within seconds.  90 seconds is enough to
// catch server join/leave events without triggering rate limits.
const GUILD_REFRESH_TTL_MS = 90_000;

/**
 * Fetch the user's guild list from Discord — but at most once per
 * GUILD_REFRESH_TTL_MS per user.  The last-fetched timestamp is stored in
 * the session so the TTL survives across requests without any external state.
 *
 * Callers that need to force a refresh (e.g. after the user joins a server)
 * can delete req.session.guildsRefreshedAt before calling this function.
 */
async function refreshUserGuilds(req) {
  const token = req.user?.accessToken;
  if (!token) return;

  // ── TTL gate — skip the Discord call if the cache is still fresh ──────────
  const now       = Date.now();
  const lastFetch = req.session.guildsRefreshedAt || 0;
  if (now - lastFetch < GUILD_REFRESH_TTL_MS) return; // cache still valid

  // ── Rate-limit backoff — honour Discord's retry_after when we do get 429d ─
  const retryAfter = req.session.guildsRetryAfter || 0;
  if (now < retryAfter) return; // still in back-off window

  try {
    const https = require("https");

    const timeoutMs = 5000;

    const { statusCode, headers, data } = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), timeoutMs);

      const options = {
        hostname: "discord.com",
        path: "/api/v10/users/@me/guilds",
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "NoxxDashboard/1.0",
        },
      };
      const request = https.request(options, (r) => {
        let body = "";
        r.on("data", (chunk) => (body += chunk));
        r.on("end", () => {
          clearTimeout(timeout);
          try { resolve({ statusCode: r.statusCode, headers: r.headers, data: JSON.parse(body) }); }
          catch { reject(new Error("Invalid JSON from Discord")); }
        });
      });
      request.on("error", (err) => { clearTimeout(timeout); reject(err); });
      request.end();
    });

    if (Array.isArray(data)) {
      // Success — update the guild list and stamp the refresh time
      req.user.guilds                = data;
      req.session.guildsRefreshedAt  = now;
      delete req.session.guildsRetryAfter;
      req.session.passport           = req.session.passport || {};
      req.session.passport.user      = req.user;
      await new Promise((resolve) => req.session.save(resolve));

    } else if (statusCode === 429) {
      // Rate limited — read retry_after and back off; don't warn on every hit
      const retryAfterSec = data?.retry_after ?? 1;
      req.session.guildsRetryAfter = now + Math.ceil(retryAfterSec * 1000) + 500; // +500 ms safety margin
      await new Promise((resolve) => req.session.save(resolve));
      // Silently return — the cached guild list (from a previous successful
      // fetch) is still in req.user.guilds and is perfectly usable.

    } else if (statusCode === 401 || statusCode === 403) {
      // Token expired — force re-login
      console.warn(`[refreshUserGuilds] Token expired/invalid (HTTP ${statusCode}) — clearing accessToken`);
      req.user.accessToken           = null;
      req.session.passport           = req.session.passport || {};
      req.session.passport.user      = req.user;
      await new Promise((resolve) => req.session.save(resolve));
      const err = new Error("Discord token expired");
      err.tokenExpired = true;
      throw err;

    } else {
      console.warn(`[refreshUserGuilds] Unexpected Discord response (HTTP ${statusCode}):`, JSON.stringify(data).slice(0, 200));
    }
  } catch (err) {
    if (!err.tokenExpired) {
      console.warn("[refreshUserGuilds] Guild refresh failed:", err.message);
    }
    throw err; // re-throw so callers can handle tokenExpired
  }
}

// Export for use in routes
module.exports.refreshUserGuilds = refreshUserGuilds;

module.exports.tierRequired = function(minTier) {
  return async (req, res, next) => {
    const guildId = req.params.id ?? req.params.guildId;
    const userId  = req.user?.id;
    const tier    = await module.exports.getGuildTier(userId, guildId);
    const sufficient = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minTier);
    if (!sufficient) {
      if (req.path.startsWith('/api')) {
        return res.status(403).json({ error: `This feature requires ${minTier} or higher.` });
      }
      return res.redirect(`/premium?required=${minTier}`);
    }
    next();
  };
};

module.exports.checkGuildAccess = async (req, res, next) => {
  // isAuth should always precede this, but guard anyway
  if (!req.isAuthenticated()) return res.redirect("/");

  // FIX 2 — Support both :id and :guildId param names so the webhook route
  // (which uses :guildId) doesn't silently receive undefined and bypass the check.
  const guildId = req.params.id ?? req.params.guildId;

  if (!guildId) {
    return deny(req, res);
  }

  // Always refresh guild list from Discord to ensure current membership
  if (req.user.accessToken) {
    await refreshUserGuilds(req);
  }

  let userGuild = req.user.guilds?.find(g => g.id === guildId);

  if (!userGuild) {
    return deny(req, res);
  }

  const perms = BigInt(userGuild.permissions);
  if ((perms & MANAGE_GUILD) !== MANAGE_GUILD) {
    return deny(req, res);
  }

  if (!/^\d{17,20}$/.test(guildId)) {
    return deny(req, res);
  }

  // Bot presence check — block access if the bot is not in this guild
  if (!isBotInGuild(req, guildId)) {
    return denyBotNotInGuild(req, res);
  }

  next();
};

function deny(req, res) {
  // FIX 4 (partial) — Consistent response type: JSON for API routes, HTML page otherwise.
  if (req.path.startsWith("/api")) {
    return res.status(403).json({ error: "Missing MANAGE_GUILD permission" });
  }
  return res.status(403).sendFile(path.join(__dirname, "views", "errors", "403.html"));
}

// ─────────────────────────────────────────────
// isBotInGuild / denyBotNotInGuild
// Checks whether the bot is actually present in the guild.
// Works in both standalone mode (_online + guilds.cache) and inline mode.
// ─────────────────────────────────────────────
function isBotInGuild(req, guildId) {
  const client = req.client;
  if (!client) return false;
  // In standalone mode respect _online flag — if the bot is unreachable the
  // cache may be stale / empty, so treat it as "not in guild".
  if (client.isStandaloneMode && !client._online) return false;
  return client.guilds.cache.has(guildId);
}

function denyBotNotInGuild(req, res) {
  if (req.path.startsWith("/api")) {
    return res.status(403).json({ error: "bot_not_in_guild", message: "The bot is not in this server." });
  }
  // Redirect back to /servers with a flag so the UI can surface a toast/banner
  return res.redirect("/servers?bot_not_in_guild=1");
}

// ─────────────────────────────────────────────
// checkBlacklist
// ─────────────────────────────────────────────
const BLACKLIST_BYPASS = new Set(["/", "/login", "/logout", "/callback", "/blacklisted", "/403"]);

module.exports.checkBlacklist = async (req, res, next) => {
  try {
    if (BLACKLIST_BYPASS.has(req.path)) return next();
    if (req.path === "/gdpr" || req.path.startsWith("/api/gdpr/")) return next();

    if (!req.isAuthenticated?.() || !req.user) {
      return next(); // unauthenticated requests are handled by isAuth
    }

    const blacklisted = await Blacklist.findOne({ userId: req.user.id });
    if (blacklisted) {
      return res.redirect("/blacklisted");
    }

    next();
  } catch (err) {
    console.error("Blacklist check failed:", err);
    res.status(500).send("Internal Server Error");
  }
};

// ─────────────────────────────────────────────
// devOnly
// ─────────────────────────────────────────────
// The owner panel (/dev, /api-dev/*) is strictly for the bot owner (OWNER_ID in .env).
// Co-developers in the BotOwners collection keep their other owner perks, but not this panel.
module.exports.devOnly = async (req, res, next) => {
  const ownerId = process.env.OWNER_ID;

  if (!ownerId || !req.user || req.user.id !== ownerId) {
    if (req.path.startsWith("/api")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.status(403).sendFile(path.join(__dirname, "views", "errors", "dev403.html"));
  }

  next();
};

// ─────────────────────────────────────────────
// checkPremium(minTier?)
// ─────────────────────────────────────────────
// Factory middleware — call as checkPremium('basic') or checkPremium('pro').
// Defaults to 'basic' when no tier is supplied.
//
// Previously a plain async middleware (req, res, next) which caused two bugs
// when called as checkPremium('basic') in route definitions:
//   1. req was bound to the string 'basic' -> req.path was undefined -> crash
//   2. The async call returned a Promise, not a function -> Express threw
//      "Route.get() requires a callback function but got a [object Promise]"
module.exports.checkPremium = function checkPremium(minTier = 'basic') {
  return async (req, res, next) => {
    try {
      if (!req.isAuthenticated?.() || !req.user) {
        if (req.path.startsWith("/api")) {
          return res.status(401).json({ error: "Authentication required" });
        }
        req.session.returnTo = req.originalUrl;
        return res.redirect("/login");
      }

      const guildId = req.params.id ?? req.params.guildId;
      if (!guildId) {
        if (req.path.startsWith("/api")) return res.status(400).json({ error: "Guild ID missing" });
        return res.redirect("/");
      }

      const tier = await module.exports.getGuildTier(req.user.id, guildId);
      if (TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(minTier)) {
        if (req.path.startsWith("/api")) {
          return res.status(403).json({ error: `This feature requires Roco ${minTier} or higher. Upgrade at /premium.` });
        }
        return res.redirect(`/premium?required=${minTier}`);
      }

      next();
    } catch (err) {
      console.error("checkPremium error:", err);
      // Fail-closed: a DB error must never silently grant access to premium features.
      if (req.path.startsWith("/api")) {
        return res.status(503).json({ error: "Could not verify premium status. Please try again." });
      }
      return res.redirect(`/premium?required=${minTier}`);
    }
  };
};

// isPremiumGuild — shared helper used by routes to pick a limit tier.
// FREE tier:    sensible defaults  (no cap hit under normal use)
// PREMIUM tier: 1,500 (the hard cap across all features)
const PREMIUM_CAP = 1500;
module.exports.PREMIUM_CAP = PREMIUM_CAP;

module.exports.isPremiumGuild = async (_userId, guildId) => {
  try {
    const { getGuildTier } = require('../Utils/premiumTiers');
    return await getGuildTier(guildId) !== 'free';
  } catch {}
  return false;
};

/**
 * getGuildTier — returns the effective tier string for a user+guild pair.
 * 'free' | 'basic' | 'pro' | 'elite'
 */
module.exports.getGuildTier = async (_userId, guildId) => {
  try {
    const { getGuildTier } = require('../Utils/premiumTiers');
    return await getGuildTier(guildId);
  } catch { return 'free'; }
};

// featureLimit(isPremium, freeCap) — returns the applicable limit for a feature.
module.exports.featureLimit = (isPremium, freeCap) => isPremium ? PREMIUM_CAP : freeCap;

// ─────────────────────────────────────────────
// sendHTMLWithNonce
// ─────────────────────────────────────────────

/**
 * Send an HTML file with inline script/style/link nonces injected.
 *
 * FIX 6 — Also injects nonce onto <link rel="stylesheet"> tags so that
 * if you tighten your CSP's styleSrc to require nonces, linked stylesheets
 * won't silently break.
 *
 * @param {Response} res      Express response
 * @param {string}   filePath Absolute path to the HTML file
 */
module.exports.sendHTMLWithNonce = (res, filePath) => {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Server error");

    const nonce = res.locals.nonce;
    const safeNonce = nonce
      ? String(nonce).replace(/[&"<>]/g, c => ({ '&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;' }[c]))
      : '';

    // Apply nonce to inline script/style tags in the file itself.
    // The res.send override in index.js handles CSRF injection and
    // the Tailwind script tag — do NOT double-apply those here.
    const html = data
      .replace(/<script\b(?![^>]*\bnonce\b)/g, safeNonce ? `<script nonce="${safeNonce}"` : '<script')
      .replace(/<style\b(?![^>]*\bnonce\b)/g,  safeNonce ? `<style nonce="${safeNonce}"` : '<style')
      .replace(/<link\b([^>]*rel=["']stylesheet["'][^>]*)>/gi,
        safeNonce ? (_, attrs) => `<link${attrs} nonce="${safeNonce}">` : '$&');

    // Re-check the page on every visit, or phones keep showing an old version after updates
    res.set('Cache-Control', 'private, no-cache');
    res.send(html);
  });
};

// ─────────────────────────────────────────────
// apiOnly
// Blocks direct browser navigation to API endpoints.
// Browsers set Sec-Fetch-Dest: "document" when the user types a URL or
// follows a link. Fetch/XHR requests use "empty". We also accept requests
// that carry the X-Dashboard-Request header as an explicit allowlist.
// ─────────────────────────────────────────────
module.exports.apiOnly = (req, res, next) => {
  // Explicit header set by our own fetch calls — always allow
  if (req.headers["x-dashboard-request"] === "true") return next();

  const dest = req.headers["sec-fetch-dest"];
  const mode = req.headers["sec-fetch-mode"];

  // Older browsers / non-browser clients (curl, Postman, etc.) don't send
  // Sec-Fetch-* headers at all — let those through so the API stays usable.
  if (!dest && !mode) return next();

  // "document" means a top-level browser navigation (address bar, link click).
  // Return a plain 404 so it looks like the route doesn't exist at all.
  if (dest === "document") {
    return res.status(404).end();
  }

  next();
};
// checkDashboardAccess
// Like checkGuildAccess but also allows users who have a dashboard role for this guild.
// Pass the sectionId (sidebar page id) to check section-specific access.
module.exports.checkDashboardAccess = function(sectionId) {
  return async (req, res, next) => {
    if (!req.isAuthenticated()) return res.redirect("/");
    const guildId = req.params.id ?? req.params.guildId;
    if (!guildId || !/^\d{17,20}$/.test(guildId)) return deny(req, res);

    // Always refresh guild list from Discord to ensure we have current membership data.
    // The cached guilds may be stale - user might have left the server but still has
    // access to the dashboard because their session wasn't updated.
    if (req.user.accessToken) {
      await refreshUserGuilds(req).catch(() => {});
    }

    // Full access: user has MANAGE_GUILD
    let userGuild = req.user.guilds?.find(g => g.id === guildId);
    const MANAGE_GUILD = 1n << 5n;
    if (userGuild) {
      const perms = BigInt(userGuild.permissions);
      if ((perms & MANAGE_GUILD) === MANAGE_GUILD) {
        // Bot presence check — must be in the guild to use any feature page
        if (!isBotInGuild(req, guildId)) return denyBotNotInGuild(req, res);
        return next();
      }
    }

    // Role-based access: check DashboardRoles for this guild
    try {
      const config = await DashboardRoles.findOne({ guildId }).lean();
      if (config?.roles?.length) {
        // Fetch member role IDs via the internal bot API — works in both inline
        // and standalone mode. serializeMember now includes a roleIds array.
        let memberRoleIds = [];
        try {
          const BOT_API     = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';
          const API_SECRET  = process.env.INTERNAL_API_SECRET || '';
          const r = await fetch(`${BOT_API}/internal/guild/${guildId}/member/${req.user.id}`, {
            headers: { 'x-internal-secret': API_SECRET },
          });
          if (r.ok) {
            const m = await r.json();
            memberRoleIds = Array.isArray(m.roleIds) ? m.roleIds : [];
          }
        } catch { /* bot offline — no role-based access */ }

        for (const entry of config.roles) {
          if (!memberRoleIds.includes(entry.roleId)) continue;
          // No sectionId = any role grants access; otherwise check sections list
          if (!sectionId || entry.sections.includes(sectionId) || entry.sections.includes('*')) {
            if (!isBotInGuild(req, guildId)) return denyBotNotInGuild(req, res);
            return next();
          }
        }
      }
    } catch {}

    return deny(req, res);
  };
};

// checkActionAccess
// Like checkDashboardAccess(sectionId) but additionally restricts based on
// action-level permissions. If the user's DashboardRole has a `permissions`
// entry for this section with a non-empty `actions` array, the requested
// `action` must be included. If no permissions entry exists (or actions is
// empty), all actions are allowed (backwards compatible).
// MANAGE_GUILD users bypass all action restrictions.
//
// Example: checkActionAccess('errors', 'clear') gates the DELETE endpoint.
module.exports.checkActionAccess = function(sectionId, action) {
  return async (req, res, next) => {
    if (!req.isAuthenticated()) return res.redirect("/");
    const guildId = req.params.id ?? req.params.guildId;
    if (!guildId || !/^\d{17,20}$/.test(guildId)) return deny(req, res);

    if (req.user.accessToken) {
      await refreshUserGuilds(req).catch(() => {});
    }

    let userGuild = req.user.guilds?.find(g => g.id === guildId);
    const MANAGE_GUILD = 1n << 5n;
    if (userGuild) {
      const perms = BigInt(userGuild.permissions);
      if ((perms & MANAGE_GUILD) === MANAGE_GUILD) {
        if (!isBotInGuild(req, guildId)) return denyBotNotInGuild(req, res);
        return next(); // MANAGER = all actions allowed
      }
    }

    try {
      const config = await DashboardRoles.findOne({ guildId }).lean();
      if (config?.roles?.length) {
        let memberRoleIds = [];
        try {
          const BOT_API     = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:5182';
          const API_SECRET  = process.env.INTERNAL_API_SECRET || '';
          const r = await fetch(`${BOT_API}/internal/guild/${guildId}/member/${req.user.id}`, {
            headers: { 'x-internal-secret': API_SECRET },
          });
          if (r.ok) {
            const m = await r.json();
            memberRoleIds = Array.isArray(m.roleIds) ? m.roleIds : [];
          }
        } catch {}

        for (const entry of config.roles) {
          if (!memberRoleIds.includes(entry.roleId)) continue;
          if (!entry.sections.includes(sectionId) && !entry.sections.includes('*')) continue;

          // Check action-level permissions
          const perm = (entry.permissions || []).find(p => p.section === sectionId);
          if (perm && perm.actions?.length) {
            if (!perm.actions.includes(action)) continue;
          }

          if (!isBotInGuild(req, guildId)) return denyBotNotInGuild(req, res);
          return next();
        }
      }
    } catch {}

    return deny(req, res);
  };
};