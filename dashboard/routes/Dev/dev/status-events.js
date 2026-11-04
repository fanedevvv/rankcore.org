"use strict";

const router = require("express").Router();

const { devLog, secureDevApi } = require("./shared");

const StatusOverride = require("../../../../Schemas/StatusOverride");
const Incident       = require("../../../../Schemas/Incident");

let _bustCache = null;
function bustStatusCache() {
  if (!_bustCache) {
    try { _bustCache = require("../../Other/status-api").bustCache; } catch {}
  }
  if (typeof _bustCache === "function") _bustCache();
}

const PAGE_REGISTRY = [
  { key: "automod",         label: "AutoMod",             path: "/automod/:id",      group: "Moderation" },
  { key: "advancedautomod", label: "Advanced AutoMod",    path: "/advancedautomod/:id", group: "Moderation" },
  { key: "antinuke",        label: "Anti-Nuke",           path: "/antinuke/:id",     group: "Security" },
  { key: "antiscam",        label: "Anti-Scam",           path: "/antiscam/:id",     group: "Security" },
  { key: "massjoin",        label: "Anti Mass Join",      path: "/massjoin/:id",     group: "Security" },
  { key: "logs",            label: "Audit Logs",          path: "/logs/:id",         group: "Utility" },
  { key: "welcome",         label: "Welcome",             path: "/welcome/:id",      group: "Utility" },
  { key: "goodbye",         label: "Goodbye",             path: "/goodbye/:id",      group: "Utility" },
  { key: "booster",         label: "Booster Rewards",     path: "/booster/:id",      group: "Utility" },
  { key: "reactionrole",    label: "Reaction Roles",      path: "/reactionrole/:id", group: "Utility" },
  { key: "sticky",          label: "Sticky Messages",     path: "/sticky/:id",       group: "Utility" },
  { key: "customcommands",  label: "Custom Commands",     path: "/customcommands/:id", group: "Utility" },
  { key: "embed",           label: "Embed Builder",       path: "/embed/:id",        group: "Utility" },
  { key: "verify",          label: "Verification",        path: "/verify/:id",       group: "Utility" },
  { key: "leveling",        label: "Leveling",            path: "/leveling/:id",     group: "Community" },
  { key: "modmail",         label: "ModMail",             path: "/modmail/:id",      group: "Community" },
  { key: "ticket",          label: "Tickets",             path: "/ticket/:id",       group: "Community" },
  { key: "confession",      label: "Confessions",         path: "/confession/:id",   group: "Community" },
  { key: "twitch",          label: "Twitch Alerts",       path: "/twitch/:id",       group: "Integrations" },
  { key: "youtube",         label: "YouTube Alerts",      path: "/youtube/:id",      group: "Integrations" },
  { key: "ai",              label: "AI Features",         path: "/ai/:id",           group: "Premium" },
  { key: "music",           label: "Music",               path: "/music/:id",        group: "Premium" },
  { key: "joinping",        label: "Join Ping",           path: "/joinping/:id",     group: "Utility" },
  { key: "jtc",             label: "Join-to-Create",      path: "/jtc/:id",          group: "Utility" },
  { key: "autoresponder",   label: "Auto Responder",      path: "/autoresponder/:id",group: "Utility" },
  { key: "autorole",        label: "Auto Role",           path: "/autorole/:id",     group: "Utility" },
  { key: "counting",        label: "Counting",            path: "/counting/:id",     group: "Community" },
  { key: "uwulock",         label: "UwU Lock",            path: "/uwulock/:id",      group: "Fun" },
  { key: "uptime",          label: "Uptime Monitor",      path: "/uptime/:id",       group: "Utility" },
  { key: "transcript",      label: "Transcripts",         path: "/transcript/:id",   group: "Utility" },
  { key: "tools",           label: "Tools",               path: "/tools",            group: "General" },
  { key: "changelogs",      label: "Changelogs",          path: "/changelogs",       group: "General" },
  { key: "donate",          label: "Donate",              path: "/donate",           group: "General" },
  { key: "docs",            label: "Docs",                path: "/docs",             group: "General" },
  { key: "invite",          label: "Invite",              path: "/invite",           group: "General" },
];

// ── Lazy-load DisabledPage schema ──────────────────────────────────────────────
let _DisabledPage = null;
function getDisabledPage() {
  if (!_DisabledPage) _DisabledPage = require("../../../../Schemas/DisabledPage");
  return _DisabledPage;
}

// ────────────────────────────────────────────────────────────────────────────
// STATUS OVERRIDE — set / clear manual status banner override
// ────────────────────────────────────────────────────────────────────────────

router.get("/api-dev/status-override", ...secureDevApi, async (req, res) => {
  try {
    const override = await StatusOverride.getOverride();
    res.json({ override });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/status-override", ...secureDevApi, async (req, res) => {
  const { status, reason, expiresInMinutes } = req.body;
  const allowed = ["operational", "degraded", "recovering", "down"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(", ")}` });
  }

  const obj = {
    status,
    reason:    reason?.trim() || null,
    setBy:     req.user?.username ?? "unknown",
    setById:   req.user?.id ?? "unknown",
    setAt:     Date.now(),
    expiresAt: expiresInMinutes ? Date.now() + expiresInMinutes * 60_000 : null,
  };

  try {
    await StatusOverride.setOverride(obj);
    bustStatusCache();
    devLog("STATUS_OVERRIDE_SET", { status, reason: obj.reason, expiresInMinutes: expiresInMinutes || "never" }, req.user);
    console.log(`[DEV] Status override set → ${status} by ${req.user?.username}`);
    res.json({ success: true, override: obj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api-dev/status-override", ...secureDevApi, async (req, res) => {
  try {
    const prev = await StatusOverride.getOverride();
    await StatusOverride.setOverride(null);
    bustStatusCache();
    devLog("STATUS_OVERRIDE_CLEAR", { previousStatus: prev?.status ?? "none" }, req.user);
    console.log(`[DEV] Status override cleared by ${req.user?.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// STATUS EVENTS — trigger synthetic incident events
// ────────────────────────────────────────────────────────────────────────────

router.post("/api-dev/status-event", ...secureDevApi, async (req, res) => {
  const { type, severity, title, reason } = req.body;
  const allowed = ["open", "resolve", "update"];

  if (!allowed.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be: ${allowed.join(", ")}` });
  }

  try {
    const now = Date.now();

    if (type === "open") {
      const existing = await Incident.findOne({ status: "ongoing" });
      if (existing) {
        return res.status(409).json({ error: "An ongoing incident already exists. Resolve it first." });
      }
      const id = `dev-${now}`;
      await Incident.create({
        incidentId: id,
        openedAt: now,
        resolvedAt: null,
        status: "ongoing",
        severity: severity || "degraded",
        title: title || "Manual incident opened by dev team",
        body: reason || "A manual incident was triggered via the developer panel.",
        manuallyTriggered: true,
        triggeredBy: req.user?.username ?? "unknown",
        updates: [],
      });
      bustStatusCache();
      devLog("STATUS_EVENT_OPEN", { id, severity: severity || "degraded", title: title || "Manual incident" }, req.user);
      return res.json({ success: true, action: "opened", id });
    }

    if (type === "resolve") {
      const ongoing = await Incident.findOne({ status: "ongoing" });
      if (!ongoing) {
        return res.status(404).json({ error: "No ongoing incident to resolve." });
      }
      ongoing.status = "resolved";
      ongoing.resolvedAt = now;
      const resolveMsg = reason || "Incident manually resolved by dev team.";
      ongoing.body += " " + resolveMsg;
      ongoing.updates.push({ ts: now, body: resolveMsg + ` Resolved by ${req.user?.username ?? "dev"}.` });
      await ongoing.save();
      bustStatusCache();
      devLog("STATUS_EVENT_RESOLVE", { id: ongoing.incidentId, reason: resolveMsg }, req.user);
      return res.json({ success: true, action: "resolved", id: ongoing.incidentId });
    }

    if (type === "update") {
      const ongoing = await Incident.findOne({ status: "ongoing" });
      if (!ongoing) {
        return res.status(404).json({ error: "No ongoing incident to update." });
      }
      const updateMsg = reason || "Dev panel update: investigation continues.";
      ongoing.updates.push({ ts: now, body: updateMsg });
      await ongoing.save();
      bustStatusCache();
      devLog("STATUS_EVENT_UPDATE", { id: ongoing.incidentId, update: updateMsg }, req.user);
      return res.json({ success: true, action: "updated", id: ongoing.incidentId });
    }
  } catch (err) {
    console.error("[DEV] status-event error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/api-dev/status-event", ...secureDevApi, async (req, res) => {
  try {
    const ongoing = await Incident.findOne({ status: "ongoing" }).lean();
    const recent = await Incident.getRecent(5);
    res.json({ ongoing, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PAGE MANAGER — disable / enable specific dashboard pages
// ────────────────────────────────────────────────────────────────────────────

router.get("/api-dev/pages", ...secureDevApi, async (req, res) => {
  try {
    const DisabledPage = getDisabledPage();
    const disabled = await DisabledPage.getAllDisabled();
    const pages = PAGE_REGISTRY.map(p => ({
      ...p,
      disabled:        !!disabled[p.key],
      disabledReason:  disabled[p.key]?.reason   || null,
      disabledBy:      disabled[p.key]?.by        || null,
      disabledAt:      disabled[p.key]?.at        || null,
    }));
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/pages/:key/disable", ...secureDevApi, async (req, res) => {
  const { key } = req.params;
  const { reason } = req.body;

  const page = PAGE_REGISTRY.find(p => p.key === key);
  if (!page) return res.status(404).json({ error: "Unknown page key: " + key });

  try {
    const DisabledPage = getDisabledPage();
    await DisabledPage.togglePage(key, {
      reason: reason?.trim() || null,
      disabledBy: req.user?.username ?? "unknown",
      disabledById: req.user?.id ?? "unknown",
    }, false);
    devLog("PAGE_DISABLE", { page: key, label: page.label, reason: reason?.trim() || null }, req.user);
    console.log(`[DEV] Page disabled: ${key} (${page.label}) by ${req.user?.username}`);
    res.json({ success: true, key, label: page.label });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api-dev/pages/:key/disable", ...secureDevApi, async (req, res) => {
  const { key } = req.params;

  const page = PAGE_REGISTRY.find(p => p.key === key);
  if (!page) return res.status(404).json({ error: "Unknown page key: " + key });

  try {
    const DisabledPage = getDisabledPage();
    await DisabledPage.togglePage(key, {}, true);
    devLog("PAGE_ENABLE", { page: key, label: page.label }, req.user);
    console.log(`[DEV] Page re-enabled: ${key} (${page.label}) by ${req.user?.username}`);
    res.json({ success: true, key, label: page.label });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.PAGE_REGISTRY   = PAGE_REGISTRY;

module.exports = router;
