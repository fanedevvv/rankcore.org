const Uptime = require("../../../Schemas/uptimeSchema");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const router = require("express").Router();
const path   = require("path");
const dns    = require("dns").promises;

const BLOCKED_HOSTS = /^(localhost|127\.|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|169\.254\.)/i;
const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|169\.254\.|0\.0\.0\.0|fd|fc)/i;

function validateMonitorURL(raw) {
  if (!raw || typeof raw !== "string") return null;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (BLOCKED_HOSTS.test(parsed.hostname)) return null;
  // Strip credentials that could auth against internal APIs
  parsed.username = "";
  parsed.password = "";
  return parsed;
}

// Resolve the hostname and confirm none of its IPs are private.
// This prevents DNS-rebinding SSRF where attacker.com resolves to 192.168.x.x
async function resolvedIpIsSafe(hostname) {
  try {
    const { address } = await dns.lookup(hostname, { verbatim: false });
    if (PRIVATE_IP_RE.test(address)) return false;
    return true;
  } catch {
    return false; // DNS failure → reject
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/guild/:id/uptime", isAuth, checkDashboardAccess('uptime'), (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/uptime.html"));
});

router.get("/api/guild/:id/uptime", isAuth, checkDashboardAccess('uptime'), async (req, res) => {
  try {
    const entries = await Uptime.find({ Guild: req.params.id });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

router.post("/api/guild/:id/uptime", isAuth, checkDashboardAccess('uptime'), async (req, res) => {
  try {
    const { URL: rawURL, Name, Interval, AlertDM, AlertChannel } = req.body;

    // FIX — validate URL before storing / monitoring
    const parsedURL = validateMonitorURL(rawURL);
    if (!parsedURL) {
      return res.status(400).json({ error: "Invalid or disallowed URL" });
    }

    // FIX — resolve the hostname to catch DNS-rebinding SSRF
    const safe = await resolvedIpIsSafe(parsedURL.hostname);
    if (!safe) {
      return res.status(400).json({ error: "URL resolves to a private or disallowed address" });
    }

    const safeURL = parsedURL.toString();

    // FIX — clamp interval so users can't set 0-second polling loops
    const interval = Math.max(1, Math.min(Number(Interval) || 5, 1440)); // 1 min – 24 h

    let entry = await Uptime.findOne({ Guild: req.params.id, User: req.user.id, URL: safeURL });
    if (!entry) {
      entry = new Uptime({
        Guild: req.params.id,
        User: req.user.id,
        URL: safeURL,
        Name: String(Name || "").slice(0, 100),
        Interval: interval,
        AlertDM: AlertDM ?? true,
        AlertChannel: AlertChannel || null,
      });
    } else {
      entry.Name         = String(Name || entry.Name).slice(0, 100);
      entry.Interval     = interval;
      entry.AlertDM      = AlertDM ?? entry.AlertDM;
      entry.AlertChannel = AlertChannel ?? entry.AlertChannel;
    }

    await entry.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

// FIX — delete by DB _id, not by raw URL param (avoids partial-match injection)
router.delete("/api/guild/:id/uptime/:entryId", isAuth, checkDashboardAccess('uptime'), async (req, res) => {
  try {
    await Uptime.findOneAndDelete({
      Guild: req.params.id,
      User:  req.user.id,
      _id:   req.params.entryId,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Error" });
  }
});

module.exports = router;