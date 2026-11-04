"use strict";

// bot.js — presence, eval, broadcast, cache/clear, commands/sync, restart, reload

const router = require("express").Router();
const vm     = require("vm");
const { devLog, secureDevApi } = require("./shared");

/* ─────────────────────────────────────────────
   BOT PRESENCE
───────────────────────────────────────────── */

router.post("/api-dev/presence", ...secureDevApi, (req, res) => {
  const { status, type, text } = req.body;
  const validStatuses = ["online", "idle", "dnd", "invisible"];
  const validTypes    = ["PLAYING", "STREAMING", "LISTENING", "WATCHING", "CUSTOM", "COMPETING"];

  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
  if (!validTypes.includes(type))      return res.status(400).json({ error: "Invalid activity type" });
  if (!text?.trim())                   return res.status(400).json({ error: "Activity text required" });

  try {
    req.client.emit("devPresence", { status, type, text: text.trim() });
    console.log(`[DEV] Presence override set → ${status} / ${type} "${text}" — by ${req.user?.username}`);
    devLog("PRESENCE_SET", { status, type, text: text.trim() }, req.user);
    res.json({ success: true, message: "Presence updated permanently", status, type, text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/presence/clear", ...secureDevApi, (req, res) => {
  try {
    req.client.emit("devPresenceClear");
    console.log(`[DEV] Presence override cleared — rotation resumed — by ${req.user?.username}`);
    devLog("PRESENCE_CLEAR", {}, req.user);
    res.json({ success: true, message: "Override cleared — rotating status resumed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   BOT EVAL
───────────────────────────────────────────── */

router.post("/api-dev/eval", ...secureDevApi, async (req, res) => {
  const { code } = req.body;
  if (typeof code !== "string" || !code.trim())
    return res.status(400).json({ error: "No code provided" });
  if (code.length > 4000)
    return res.status(400).json({ error: "Code too long (max 4000 chars)" });

  const client = req.client;
  let result;

  try {
    const sandbox = vm.createContext({
      client,
      console: {
        log:   (...a) => a.map(x => String(x)).join(" "),
        error: (...a) => a.map(x => String(x)).join(" "),
      },
      JSON,
      Math,
      Date,
      setTimeout:  undefined,
      setInterval: undefined,
    });

    const evalPromise = new Promise(resolve => {
      try {
        const script = new vm.Script(code, { filename: "eval", timeout: 5000 });
        const output = script.runInContext(sandbox, { timeout: 5000 });
        if (output && typeof output.then === "function") {
          Promise.resolve(output)
            .then(v  => resolve(v !== undefined ? String(v) : "undefined"))
            .catch(e => resolve(`Error: ${e.message}`));
        } else {
          resolve(output !== undefined ? String(output) : "undefined");
        }
      } catch (e) {
        resolve(`Error: ${e.message}`);
      }
    });

    const timeoutPromise = new Promise(resolve =>
      setTimeout(() => resolve("Error: Execution timed out (5s)"), 5500)
    );

    result = await Promise.race([evalPromise, timeoutPromise]);
    if (result.length > 2000) result = result.slice(0, 2000) + "\n...(truncated)";
  } catch (err) {
    result = `Error: ${err.message}`;
  }

  console.log(`[DEV] Eval by ${req.user?.username}: ${code.slice(0, 100)}`);
  devLog("EVAL", { code: code.slice(0, 500), result: result.slice(0, 500) }, req.user);
  res.json({ result });
});

/* ─────────────────────────────────────────────
   BROADCAST
───────────────────────────────────────────── */

router.post("/api-dev/broadcast", ...secureDevApi, async (req, res) => {
  const { channel, title, content, color } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Message content required" });

  try {
    // Always proxy to the bot process — the dashboard shim's guilds.cache is empty
    // in standalone mode so we can't iterate it here directly.
    const internalRes = await fetch("http://127.0.0.1:5182/internal/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET || (() => { throw new Error('INTERNAL_API_SECRET not set'); })(),
      },
      body: JSON.stringify({ channel, title, content, color }),
    });
    const data = await internalRes.json();
    if (!internalRes.ok) return res.status(500).json({ error: data.error || "Broadcast failed" });
    console.log(`[DEV] Broadcast queued to ${data.queued} guilds — by ${req.user?.username}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   QUICK ACTIONS
───────────────────────────────────────────── */

router.post("/api-dev/cache/clear", ...secureDevApi, async (req, res) => {
  try {
    let GuildCache;
    try { GuildCache = require("../../../../Schemas/guildCacheSchema"); } catch { GuildCache = null; }

    if (GuildCache) {
      const { deletedCount } = await GuildCache.deleteMany({});
      console.log(`[DEV] Cleared ${deletedCount} guild cache entries — by ${req.user?.username}`);
      res.json({ success: true, message: `Cleared ${deletedCount} cache entries` });
    } else {
      res.json({ success: true, message: "Cache schema unavailable" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/commands/sync", ...secureDevApi, async (req, res) => {
  try {
    const internalRes = await fetch("http://127.0.0.1:5182/internal/application/commands/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET || (() => { throw new Error('INTERNAL_API_SECRET not set'); })(),
      },
      body: JSON.stringify({}),
    });
    const data = await internalRes.json();
    if (!internalRes.ok) return res.status(500).json({ error: data.error || "Sync failed" });
    console.log(`[DEV] Synced ${data.count ?? "?"} commands — by ${req.user?.username}`);
    res.json({ success: true, message: `Synced ${data.count ?? 0} global commands` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/restart", ...secureDevApi, (req, res) => {
  console.log(`[DEV] ⚠️  RESTART triggered by ${req.user?.username} (${req.user?.id})`);
  res.json({ success: true, message: "Restarting process… PM2 will bring it back up." });
  setTimeout(() => process.exit(0), 500);
});

router.post("/api-dev/reload", ...secureDevApi, (req, res) => {
  try {
    req.client.emit("devReload", req.user?.id);
    console.log(`[DEV] devReload emitted — by ${req.user?.username}`);
    res.json({ success: true, message: "Reload signal emitted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;