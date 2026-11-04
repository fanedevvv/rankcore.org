"use strict";

// granular.js — granular manager routes (per-command/event/system enable/disable)

const router = require("express").Router();
const { secureDevApi } = require("./shared");

router.get("/api-dev/granular", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    res.json(await g.getAll());
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.get("/api-dev/granular/events", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    res.json(await g.getAllEvents());
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.get("/api-dev/granular/commands", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    res.json(await g.getAllCommands());
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.get("/api-dev/granular/systems", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    res.json(await g.getAllSystems());
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/granular/events/:key/enable", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    const key = req.params.key;
    if (typeof key !== "string" || key.length > 200) return res.status(400).json({ error: "Invalid key." });
    const registered = (await g.getAllEvents()).map(e => e.key);
    if (!registered.includes(key)) return res.status(400).json({ error: "Unknown event key." });
    await g.enableEvent(key);
    res.json({ success: true, key, enabled: true });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/granular/events/:key/disable", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    const key = req.params.key;
    if (typeof key !== "string" || key.length > 200) return res.status(400).json({ error: "Invalid key." });
    const registered = (await g.getAllEvents()).map(e => e.key);
    if (!registered.includes(key)) return res.status(400).json({ error: "Unknown event key." });
    await g.disableEvent(key);
    res.json({ success: true, key, enabled: false });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/granular/commands/:name/enable", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    const name = req.params.name;
    if (typeof name !== "string" || name.length > 100) return res.status(400).json({ error: "Invalid name." });
    const registered = (await g.getAllCommands()).map(c => c.name);
    if (!registered.includes(name)) return res.status(400).json({ error: "Unknown command name." });
    await g.enableCommand(name);
    res.json({ success: true, name, enabled: true });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/granular/commands/:name/disable", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    const name = req.params.name;
    if (typeof name !== "string" || name.length > 100) return res.status(400).json({ error: "Invalid name." });
    const registered = (await g.getAllCommands()).map(c => c.name);
    if (!registered.includes(name)) return res.status(400).json({ error: "Unknown command name." });
    await g.disableCommand(name);
    res.json({ success: true, name, enabled: false });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/granular/systems/:key/enable", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    const key = req.params.key;
    if (typeof key !== "string" || key.length > 100) return res.status(400).json({ error: "Invalid key." });
    const registered = (await g.getAllSystems()).map(s => s.key);
    if (!registered.includes(key)) return res.status(400).json({ error: "Unknown system key." });
    await g.enableSystem(key);
    res.json({ success: true, key, enabled: true });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

router.post("/api-dev/granular/systems/:key/disable", ...secureDevApi, async (req, res) => {
  try {
    const g = req.client?.granularManager;
    if (!g) return res.status(503).json({ error: "Granular manager not available." });
    const key = req.params.key;
    if (typeof key !== "string" || key.length > 100) return res.status(400).json({ error: "Invalid key." });
    const registered = (await g.getAllSystems()).map(s => s.key);
    if (!registered.includes(key)) return res.status(400).json({ error: "Unknown system key." });
    await g.disableSystem(key);
    res.json({ success: true, key, enabled: false });
  } catch {
    res.status(500).json({ error: "Internal error." });
  }
});

module.exports = router;