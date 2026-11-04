"use strict";

/**
 * dashboard/routes/Other/custombrand.js
 *
 * REST API + HTML page for Custom Branding.
 * Token is NEVER returned in any API response.
 *
 * In standalone-dashboard mode all mutating operations are proxied
 * to the bot process via the internal API (127.0.0.1:5182).
 * Read-only operations can still hit the DB directly.
 */

const router = require("express").Router();
const path   = require("path");

const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const getOwners        = require("../../../Utils/getOwners");
const CustomBranding   = require("../../../Schemas/customBrandingSchema");
const { hasBrandingAccess, getBrandingSubscription } = require("../../../Utils/brandingAccess");
const CbBlacklist        = require("../../../Schemas/cbBlacklistSchema");

// ── Resolve CBM — works in both combined and standalone modes ─────────────────
// In combined mode:  cbm is the live singleton, getStatus() returns real data.
// In standalone mode: cbm module is imported but never init()-ed, so we route
//   all mutating calls through the internal API proxy instead.
const cbm = require("../../../src/core/CustomBrandingManager");

function isStandalone(req) {
  return !!req.client?.isStandaloneMode;
}

async function cbProxy(req, method, internalPath, body) {
  const { apiGet, apiPost, apiDel } = require("../../lib/botClient");
  if (method === "GET")    return apiGet(internalPath);
  if (method === "DELETE") return apiDel(internalPath, body);
  return apiPost(internalPath, body);
}

// ── Access guard ──────────────────────────────────────────────────────────────

async function cbAccess(req, res, next) {
  try {
    const userId  = req.user?.id;
    const guildId = req.params.id;

    // Block blacklisted guilds from accessing CB (devs bypass this check)
    const blacklisted = await CbBlacklist.findOne({ serverId: guildId }).lean();
    if (blacklisted) {
      if (req.path.startsWith("/api")) {
        return res.status(403).json({ error: "This server has been blacklisted from using Custom Branding." });
      }
      return res.redirect(`/premium/branding?guild=${guildId}&error=blacklisted`);
    }

    const { allowed, reason, source } = await hasBrandingAccess({ userId, guildId });

    if (!allowed) {
      if (req.path.startsWith("/api")) {
        return res.status(403).json({
          error:        "Custom Branding subscription required.",
          reason,
          upgradeUrl:   `${process.env.DASHBOARD_URL}/premium/branding?guild=${guildId}`,
        });
      }
      // Redirect to branding purchase page instead of generic 403
      return res.redirect(`/premium/branding?guild=${guildId}`);
    }

    // Attach access info for downstream handlers
    req.brandingSource = source;
    next();
  } catch (err) {
    next(err);
  }
}

// ── Dashboard page ─────────────────────────────────────────────────────────────

router.get("/guild/:id/custombranding", isAuth, checkDashboardAccess('overview'), cbAccess, (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/premium/custombrand.html"));
});

// ── GET /api/:id/custombrand/access ───────────────────────────────────────────

router.get("/api/:id/custombrand/access", isAuth, async (req, res) => {
  try {
    const { allowed, reason, source } = await hasBrandingAccess({
      userId:  req.user?.id,
      guildId: req.params.id,
    });
    const sub = allowed ? await getBrandingSubscription(req.params.id) : null;
    return res.json({
      allowed,
      reason,
      source,
      subscription: sub ? {
        isActive:   sub.isActive,
        billing:    sub.billing,
        expiresAt:  sub.expiresAt,
        activatedAt:sub.activatedAt,
      } : null,
      upgradeUrl: !allowed
        ? `${process.env.DASHBOARD_URL}/premium/branding?guild=${req.params.id}`
        : null,
    });
  } catch {
    return res.json({ allowed: false });
  }
});

// ── GET config + live status ──────────────────────────────────────────────────

router.get("/api/:id/custombrand", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;

    if (isStandalone(req)) {
      // Proxy to bot process which has the live CBM instance
      try {
        const data = await cbProxy(req, "GET", `/internal/cb/config/${guildId}`);
        return res.json(data);
      } catch (err) {
        console.error("[custombrand] standalone config proxy error:", err.message);
        // Fall through to DB-only read
      }
    }

    const config = await CustomBranding.findOne({ guildId }).select("+encryptedToken").lean();
    if (!config) return res.json({});

    const { encryptedToken: _t, ...safe } = config;
    const live = cbm.getStatus(guildId);
    safe.liveState  = live.state;
    safe.botTag     = live.botTag;
    safe.botId      = live.botId;
    safe.botAvatar  = live.botAvatar;
    safe.livePing   = live.ping;
    safe.liveUptime = live.uptime;
    safe.hasToken   = !!_t;

    return res.json(safe);
  } catch (err) {
    console.error("[custombrand] GET error:", err);
    return res.status(500).json({ error: "Failed to load config" });
  }
});

// ── POST setup (submit token) ─────────────────────────────────────────────────

router.post("/api/:id/custombrand/setup", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;
    const { token, alertChannelId } = req.body;

    if (!token || !token.includes(".")) {
      return res.status(400).json({ error: "Invalid token format — copy it from the Developer Portal." });
    }

    if (isStandalone(req)) {
      try {
        const data = await cbProxy(req, "POST", `/internal/cb/setup/${guildId}`, {
          token, alertChannelId, ownerId: req.user.id,
        });
        return res.json(data);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    // Combined mode — handle locally
    const update = {
      ownerId: req.user.id, grantedBy: req.user.id,
      enabled: true,
      setupState: "pending", setupError: null,
    };
    if (alertChannelId) update.alertChannelId = alertChannelId;

    await CustomBranding.findOneAndUpdate({ guildId }, { $set: update }, { upsert: true });

    // Pass raw token — CB manager encrypts with its own key
    try { await cbm.launchGuild(guildId, token); }
    catch (err) {
      return res.status(400).json({
        error: err.message,
        hint: "Check that the token is correct, all Privileged Intents are enabled, and the bot has been invited to this server.",
      });
    }

    const live = cbm.getStatus(guildId);
    return res.json({ success: true, state: live.state, botTag: live.botTag, ping: live.ping });
  } catch (err) {
    console.error("[custombrand] setup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST save branding fields ─────────────────────────────────────────────────

router.post("/api/:id/custombrand", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;
    const { botName, avatarUrl, embedColor, footerText, statusText, statusType, onlineStatus, alertChannelId } = req.body;

    if (embedColor && !/^#[0-9A-Fa-f]{6}$/.test(embedColor))
      return res.status(400).json({ error: "Invalid embed colour. Use #RRGGBB format." });
    if (avatarUrl && !/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(avatarUrl))
      return res.status(400).json({ error: "Avatar URL must be a direct image link." });

    if (isStandalone(req)) {
      try {
        await cbProxy(req, "POST", `/internal/cb/save/${guildId}`, req.body);
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    const update = {};
    if (botName      !== undefined) update.botName      = botName?.trim()?.slice(0, 32)    || null;
    if (avatarUrl    !== undefined) update.avatarUrl     = avatarUrl                        || null;
    if (embedColor   !== undefined) update.embedColor    = embedColor                       || null;
    if (footerText   !== undefined) update.footerText    = footerText?.trim()?.slice(0,128) || null;
    if (statusText   !== undefined) update.statusText    = statusText?.trim()?.slice(0,128) || null;
    if (statusType   !== undefined) update.statusType    = statusType                       || null;
    if (onlineStatus  !== undefined) update.onlineStatus   = onlineStatus                     || null;
    if (alertChannelId !== undefined) update.alertChannelId = alertChannelId               || null;

    const updated = await CustomBranding.findOneAndUpdate(
      { guildId }, { $set: update }, { upsert: true, new: true }
    );

    const live = cbm.getStatus(guildId);
    if (live.state === "running") await cbm.updatePresence(guildId, updated);

    const { encryptedToken: _t, ...safe } = updated.toObject();
    return res.json({ success: true, config: safe });
  } catch (err) {
    console.error("[custombrand] POST error:", err);
    return res.status(500).json({ error: "Failed to save config" });
  }
});

// ── POST toggle (start/stop) ──────────────────────────────────────────────────

router.post("/api/:id/custombrand/toggle", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;
    const { enabled } = req.body;

    if (isStandalone(req)) {
      try {
        const data = await cbProxy(req, "POST", `/internal/cb/toggle/${guildId}`, { enabled });
        return res.json(data);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    if (enabled) {
      // Block start if the config is in an error state — require a fresh setup first
      const existing = await CustomBranding.findOne({ guildId }).lean();
      if (existing?.setupState === "error") {
        return res.status(400).json({
          error: existing.setupError || "Bot is in an error state — please reset and re-submit your token before starting.",
          code: "SETUP_ERROR",
        });
      }

      await CustomBranding.updateOne({ guildId }, { $set: { enabled: true } });
      try { await cbm.launchGuild(guildId); }
      catch (err) { return res.status(400).json({ error: err.message }); }
      const live = cbm.getStatus(guildId);
      return res.json({ success: true, state: live.state, botTag: live.botTag });
    } else {
      await cbm.stopGuild(guildId);
      await CustomBranding.updateOne({ guildId }, { $set: { enabled: false, setupState: "disabled" } });
      return res.json({ success: true, state: "stopped" });
    }
  } catch (err) {
    console.error("[custombrand] toggle error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE reset ──────────────────────────────────────────────────────────────

router.delete("/api/:id/custombrand", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;

    if (isStandalone(req)) {
      try {
        await cbProxy(req, "DELETE", `/internal/cb/${guildId}`);
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    await cbm.stopGuild(guildId);
    await CustomBranding.deleteOne({ guildId });
    return res.json({ success: true });
  } catch (err) {
    console.error("[custombrand] DELETE error:", err);
    return res.status(500).json({ error: "Failed to reset" });
  }
});

// ── GET commands list (Roco commands + disabled state for this guild) ────────

router.get("/api/:id/custombrand/commands", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;
    const fs   = require("fs");
    const path = require("path");

    // Load Roco command list from disk
    let allCommands = [];
    try {
      const raw = fs.readFileSync(path.join(__dirname, "../../../src/data/registeredCommands.json"), "utf8");
      allCommands = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({ error: "Could not load command list: " + e.message });
    }

    // Fetch disabled list — use plain findOne without .select() to avoid
    // issues if the bot process hasn't restarted with the new schema yet.
    let disabled = new Set();
    try {
      const config = await CustomBranding.findOne({ guildId }).lean();
      (config?.disabledCommands || []).forEach(n => disabled.add(n));
    } catch {}

    const commands = allCommands.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      enabled: !disabled.has(cmd.name),
    }));

    return res.json({ commands });
  } catch (err) {
    console.error("[custombrand] GET commands error:", err);
    return res.status(500).json({ error: err.message || "Failed to load commands" });
  }
});

// ── POST toggle a single command on/off ────────────────────────────────────

router.post("/api/:id/custombrand/commands/:cmdName/toggle", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const { id: guildId, cmdName } = req.params;
    const { enabled } = req.body;

    // Update DB directly — dashboard process has its own MongoDB connection.
    // Use $pull/$addToSet which work even if disabledCommands isn't on the
    // cached schema yet (Mongoose passes it through as a raw update).
    if (enabled) {
      await CustomBranding.collection.updateOne({ guildId }, { $pull: { disabledCommands: cmdName } });
    } else {
      await CustomBranding.collection.updateOne({ guildId }, { $addToSet: { disabledCommands: cmdName } });
    }

    // Tell the live bot worker to re-register commands via IPC proxy
    if (isStandalone(req)) {
      try { await cbProxy(req, "POST", `/internal/cb/commands/${guildId}/sync`, {}); } catch {}
    } else {
      const live = cbm.getStatus(guildId);
      if (live.state === "running") cbm.sendToWorker(guildId, { type: "RELOAD_COMMANDS" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[custombrand] command toggle error:", err);
    return res.status(500).json({ error: err.message || "Failed to toggle command" });
  }
});

// ── POST sync commands now (re-register on live bot) ──────────────────────

router.post("/api/:id/custombrand/commands/sync", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  try {
    const guildId = req.params.id;

    if (isStandalone(req)) {
      try {
        await cbProxy(req, "POST", `/internal/cb/commands/${guildId}/sync`, {});
        return res.json({ success: true });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const live = cbm.getStatus(guildId);
    if (live.state !== "running") {
      return res.status(400).json({ error: "Bot is not running — start it first" });
    }
    cbm.sendToWorker(guildId, { type: "RELOAD_COMMANDS" });
    return res.json({ success: true });
  } catch (err) {
    console.error("[custombrand] sync commands error:", err);
    return res.status(500).json({ error: err.message || "Failed to sync commands" });
  }
});

// ── GET live status ───────────────────────────────────────────────────────────

router.get("/api/:id/custombrand/status", isAuth, checkDashboardAccess('overview'), cbAccess, async (req, res) => {
  if (isStandalone(req)) {
    try {
      const data = await cbProxy(req, "GET", `/internal/cb/status/${req.params.id}`);
      return res.json(data);
    } catch {
      return res.json({ state: "stopped", botTag: null, ping: null, uptime: null, botId: null, botAvatar: null });
    }
  }
  return res.json(cbm.getStatus(req.params.id));
});

module.exports = router;