"use strict";

// modules.js — module manager routes (start, stop, restart, enable, disable, status, logs)

const router = require("express").Router();
const { secureDevApi } = require("./shared");

const VALID_MODULE_NAMES = new Set([
  "events", "slash-commands",  "functions", "triggers",
  "systems", "music", "cron", "error-handlers", "api-server", "internal-api", "log-handlers",
]);

function validModuleName(name) {
  return typeof name === "string" && name.length <= 64 && VALID_MODULE_NAMES.has(name);
}

router.get("/api-dev/modules", ...secureDevApi, async (req, res) => {
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    res.json(await mgr.getAllStatus());
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.get("/api-dev/modules/:name", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    res.json(await mgr.getStatus(req.params.name));
  } catch {
    res.status(404).json({ error: "Module not found." });
  }
});

router.get("/api-dev/modules/:name/logs", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr   = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    res.json(await mgr.getLogs(req.params.name, limit));
  } catch {
    res.status(404).json({ error: "Module not found." });
  }
});

router.post("/api-dev/modules/:name/start", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    await mgr.start(req.params.name, req.client);
    res.json({ success: true, status: await mgr.getStatus(req.params.name) });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/modules/:name/stop", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    await mgr.stop(req.params.name);
    res.json({ success: true, status: await mgr.getStatus(req.params.name) });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/modules/:name/restart", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    await mgr.restart(req.params.name, req.client);
    res.json({ success: true, status: await mgr.getStatus(req.params.name) });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/modules/:name/disable", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    await mgr.disable(req.params.name);
    res.json({ success: true, status: await mgr.getStatus(req.params.name) });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/modules/:name/enable", ...secureDevApi, async (req, res) => {
  if (!validModuleName(req.params.name)) return res.status(400).json({ error: "Invalid module name." });
  try {
    const mgr = req.client?.moduleManager;
    if (!mgr) return res.status(503).json({ error: "Module manager not available." });
    await mgr.enable(req.params.name);
    res.json({ success: true, status: await mgr.getStatus(req.params.name) });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

module.exports = router;