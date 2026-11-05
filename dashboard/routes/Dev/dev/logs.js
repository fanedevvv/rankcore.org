"use strict";

// logs.js — log export, avatar proxy, logs/recent (REST), logs/stream (SSE)
// Also owns the in-memory console patch and circular log buffer.

const router   = require("express").Router();
const path     = require("path");
const fs       = require("fs");
const { execFile, spawn } = require("child_process");
const readline = require("readline");

const { sseDevApi }    = require("./shared");
const { isAuth, devOnly } = require("../../../middleware");
const { getRequestLogs } = require("../../Utils/dashboardLoggers");

// ── In-memory log buffer + console patch ─────────────────────────────────────
// Captures console.log / console.error into a circular buffer so there is
// always *something* to show even without a log file.

const LOG_BUFFER_SIZE = 500;
const _logBuffer      = [];
const _sseClients     = new Set();

function pushToBuffer(line) {
  const ts   = new Date().toISOString();
  const full = `${ts}: ${line}`;
  if (_logBuffer.length >= LOG_BUFFER_SIZE) _logBuffer.shift();
  _logBuffer.push(full);
  for (const client of _sseClients) {
    try { client.write(`event: log\ndata: ${full}\n\n`); } catch {}
  }
}

(function patchConsole() {
  const orig = {
    log:   console.log.bind(console),
    error: console.error.bind(console),
    warn:  console.warn.bind(console),
    info:  console.info.bind(console),
  };
  for (const [method, fn] of Object.entries(orig)) {
    console[method] = (...args) => {
      fn(...args);
      if (process.env.NODE_ENV === 'production' && (method === 'error' || method === 'warn')) {
        try {
          const safe = args.map(a => {
            if (typeof a === 'string' && a.includes('\n    at ')) return a.split('\n')[0];
            return typeof a === 'string' ? a : JSON.stringify(a);
          }).join(' ');
          pushToBuffer(`[${method.toUpperCase()}] ${safe}`);
        } catch {}
      } else {
        try { pushToBuffer(`[${method.toUpperCase()}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`); } catch {}
      }
    };
  }
})();

// ── Log file resolution ───────────────────────────────────────────────────────

function resolvePM2LogPath() {
  return new Promise((resolve) => {
    execFile("pm2", ["jlist"], { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve(null);
      try {
        const list = JSON.parse(stdout);
        const own  = list.find(p =>
          p.pid === process.pid ||
          p.pm2_env?.pm_pid === process.pid ||
          (process.env.name && p.name === process.env.name)
        ) || list[0];

        const logPath = own?.pm2_env?.pm_out_log_path;
        if (logPath && fs.existsSync(logPath)) return resolve(logPath);
        resolve(null);
      } catch { resolve(null); }
    });
  });
}

function resolveLogPath() {
  const candidates = [
    path.join(process.cwd(), "logs", "output.log"),
    path.join(process.cwd(), "logs", "combined.log"),
    path.join(process.cwd(), "logs", "app.log"),
    path.join(process.cwd(), "out.log"),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function tailFile(filePath, lines = 200) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      execFile("tail", ["-n", String(lines), filePath], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
        if (err) return resolve([]);
        resolve(stdout.split("\n").filter(Boolean));
      });
    } else {
      try {
        const data = fs.readFileSync(filePath, "utf8");
        resolve(data.split("\n").filter(Boolean).slice(-lines));
      } catch { resolve([]); }
    }
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/api-dev/logs/export", ...sseDevApi, (req, res) => {
  const logPath = path.join(process.cwd(), "logs", "output.log");

  res.setHeader("Content-Disposition", `attachment; filename="noxx-${Date.now()}.log"`);

  if (fs.existsSync(logPath)) {
    res.setHeader("Content-Type", "text/plain");
    return res.sendFile(logPath);
  }

  const logs = getRequestLogs();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="noxx-logs-${Date.now()}.json"`);
  res.send(JSON.stringify(logs, null, 2));
});

router.get("/api-dev/avatar-proxy", isAuth, devOnly, async (req, res) => {
  const raw = (req.query.url || "").trim();
  if (!raw) return res.status(400).end();

  let parsed;
  try { parsed = new URL(raw); } catch { return res.status(400).end(); }
  const ALLOWED = ["cdn.discordapp.com", "media.discordapp.net"];
  if (!ALLOWED.includes(parsed.hostname)) return res.status(403).end();

  const fetchAndSend = async (url) => {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "DiscordBot (https://rankcore.org, 1.0)" },
    });
    if (!upstream.ok) return null;
    const ct  = upstream.headers.get("content-type") || "image/png";
    const buf = await upstream.arrayBuffer();
    return { ct, buf: Buffer.from(buf) };
  };

  try {
    let result = await fetchAndSend(raw);
    if (!result) result = await fetchAndSend("https://cdn.discordapp.com/embed/avatars/0.png");
    if (!result) return res.status(502).end();

    res.setHeader("Content-Type", result.ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(result.buf);
  } catch {
    res.status(502).end();
  }
});

router.get("/api-dev/logs/recent", ...sseDevApi, async (req, res) => {
  const lines = Math.min(parseInt(req.query.lines) || 200, 1000);

  const pm2Path = await resolvePM2LogPath();
  if (pm2Path) {
    const logs = await tailFile(pm2Path, lines);
    return res.json({ logs, source: `PM2 (${path.basename(pm2Path)})` });
  }

  const filePath = resolveLogPath();
  if (filePath) {
    const logs = await tailFile(filePath, lines);
    return res.json({ logs, source: path.basename(filePath) });
  }

  res.json({ logs: _logBuffer.slice(-lines), source: "in-memory (no log file found)" });
});

router.get("/api-dev/logs/stream", ...sseDevApi, async (req, res) => {
  res.setHeader("Content-Type",       "text/event-stream");
  res.setHeader("Cache-Control",      "no-cache");
  res.setHeader("Connection",         "keep-alive");
  res.setHeader("X-Accel-Buffering",  "no");
  res.flushHeaders();

  const pm2Path  = await resolvePM2LogPath();
  const filePath = pm2Path || resolveLogPath();

  if (filePath) {
    const snapshot = await tailFile(filePath, 100);
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    res.write(`event: source\ndata: ${path.basename(filePath)} (via tail)\n\n`);

    const tail = spawn("tail", ["-n", "0", "-f", filePath]);
    const rl   = readline.createInterface({ input: tail.stdout });

    rl.on("line", (line) => {
      if (!res.writableEnded) {
        const full = `${new Date().toISOString()}: ${line}`;
        try { res.write(`event: log\ndata: ${full}\n\n`); } catch {}
      }
    });

    const cleanup = () => {
      try { tail.kill(); } catch {}
      rl.close();
      _sseClients.delete(res);
    };
    req.on("close", cleanup);
    req.on("end",   cleanup);

    const ping = setInterval(() => {
      if (res.writableEnded) return clearInterval(ping);
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 20_000);

  } else {
    res.write(`event: snapshot\ndata: ${JSON.stringify(_logBuffer.slice(-100))}\n\n`);
    res.write(`event: source\ndata: in-memory console intercept\n\n`);

    _sseClients.add(res);
    const cleanup = () => { _sseClients.delete(res); };
    req.on("close", cleanup);
    req.on("end",   cleanup);

    const ping = setInterval(() => {
      if (res.writableEnded) return clearInterval(ping);
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 20_000);
  }
});

module.exports = router;