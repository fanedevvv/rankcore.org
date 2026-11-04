'use strict';

// Routes:
//   GET  /internal/granular
//   GET  /internal/granular/events
//   GET  /internal/granular/commands
//   GET  /internal/granular/systems
//   POST /internal/granular/events/:key/enable
//   POST /internal/granular/events/:key/disable
//   POST /internal/granular/commands/:name/enable
//   POST /internal/granular/commands/:name/disable
//   POST /internal/granular/systems/:key/enable
//   POST /internal/granular/systems/:key/disable

const { Router } = require('express');

module.exports = (client) => {
  const router = Router();

  // Helper — fail fast with 503 if manager isn't loaded
  const getManager = (res) => {
    const g = client.granularManager;
    if (!g) { res.status(503).json({ error: 'Granular manager not available.' }); return null; }
    return g;
  };

  // ── Read ──────────────────────────────────────────────────────────────────

  router.get('/internal/granular', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { res.json(g.getAll()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/internal/granular/events', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { res.json(g.getAllEvents()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/internal/granular/commands', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { res.json(g.getAllCommands()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/internal/granular/systems', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { res.json(g.getAllSystems()); } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Events ────────────────────────────────────────────────────────────────

  router.post('/internal/granular/events/:key/enable', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { g.enableEvent(decodeURIComponent(req.params.key)); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/internal/granular/events/:key/disable', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { g.disableEvent(decodeURIComponent(req.params.key)); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Commands ──────────────────────────────────────────────────────────────

  router.post('/internal/granular/commands/:name/enable', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { g.enableCommand(decodeURIComponent(req.params.name)); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/internal/granular/commands/:name/disable', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { g.disableCommand(decodeURIComponent(req.params.name)); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Systems ───────────────────────────────────────────────────────────────

  router.post('/internal/granular/systems/:key/enable', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { g.enableSystem(decodeURIComponent(req.params.key)); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/internal/granular/systems/:key/disable', (req, res) => {
    const g = getManager(res); if (!g) return;
    try { g.disableSystem(decodeURIComponent(req.params.key)); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
};