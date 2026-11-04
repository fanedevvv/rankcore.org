"use strict";

const path  = require("path");
const fs    = require("fs");
const https = require("https");

const { isAuth, devOnly } = require("../../../middleware");

// ── Dev Action Logger ─────────────────────────────────────────────────────────

const DEV_LOG_FILE = path.join(__dirname, "../../../../logs/dev-actions.json");

async function devLog(action, data, actor) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    actor: { id: actor?.id ?? "unknown", username: actor?.username ?? "unknown" },
    data,
  };

  try {
    const dir = path.dirname(DEV_LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let existing = [];
    if (fs.existsSync(DEV_LOG_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(DEV_LOG_FILE, "utf8")); } catch {}
    }
    existing.push(entry);
    fs.writeFileSync(DEV_LOG_FILE, JSON.stringify(existing, null, 2));
  } catch (err) {
    console.error("[devLog] Failed to write JSON log:", err.message);
  }

  const webhookUrl = process.env.DEV_LOG_WEBHOOK;
  if (!webhookUrl) return;

  const colorMap = {
    USER_BLACKLIST_ADD:      0xf87171,
    USER_BLACKLIST_REMOVE:   0x4ade80,
    SERVER_BLACKLIST_ADD:    0xf87171,
    SERVER_BLACKLIST_REMOVE: 0x4ade80,
    GUILD_LEAVE:             0xfb923c,
    PREMIUM_GRANT:           0x4ade80,
    PREMIUM_REVOKE:          0xf87171,
    MAINTENANCE_ENABLE:      0xfacc15,
    MAINTENANCE_DISABLE:     0x4ade80,
    PRESENCE_SET:            0x6366f1,
    PRESENCE_CLEAR:          0x94a3b8,
    EVAL:                    0xa78bfa,
  };

  const fields = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => ({ name: k, value: String(v).slice(0, 1024), inline: true }));

  const body = JSON.stringify({
    embeds: [{
      title: `🔧 Dev Action: ${action}`,
      color: colorMap[action] ?? 0x4ade80,
      fields,
      footer: { text: `By ${entry.actor.username} (${entry.actor.id})` },
      timestamp: entry.timestamp,
    }],
  });

  try {
    const url     = new URL(webhookUrl);
    const postReq = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    });
    postReq.on("error", () => {});
    postReq.write(body);
    postReq.end();
  } catch (err) {
    console.error("[devLog] Webhook send failed:", err.message);
  }
}

// ── Security middleware ───────────────────────────────────────────────────────

function ajaxOnly(req, res, next) {
  const mode = req.headers["sec-fetch-mode"];
  if (!req.xhr && mode !== "cors" && mode !== "same-origin") {
    return res.status(404).end();
  }
  next();
}

function requireDashboardHeader(req, res, next) {
  if (req.headers["x-dashboard-request"] !== "true") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

function csrfFromQuery(req, res, next) {
  if (!req.headers["x-csrf-token"] && req.query.token) {
    req.headers["x-csrf-token"] = req.query.token;
  }
  next();
}

const secureDevApi = [isAuth, devOnly, ajaxOnly, requireDashboardHeader];
const sseDevApi    = [isAuth, devOnly, csrfFromQuery];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcExpiry(plan) {
  const ms = {
    daily:    86_400_000,
    weekly:   86_400_000 * 7,
    monthly:  86_400_000 * 30,
    yearly:   86_400_000 * 365,
    lifetime: 86_400_000 * 36_525,
  };
  return Date.now() + (ms[plan] ?? ms.monthly);
}

module.exports = { devLog, ajaxOnly, requireDashboardHeader, csrfFromQuery, secureDevApi, sseDevApi, calcExpiry };