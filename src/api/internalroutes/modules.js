'use strict';

// Routes (owner panel → Modules):
//   GET  /internal/modules                 — status of every module
//   GET  /internal/modules/:name           — status of one module
//   GET  /internal/modules/:name/logs      — recent log lines
//   POST /internal/modules/:name/(start|stop|restart|enable|disable)

const { Router } = require('express');
const { instance: moduleManager } = require('../../core/moduleManager');

module.exports = (client) => {
  const router = Router();

  router.get('/internal/modules', (req, res) => {
    try { res.json(moduleManager.getAllStatus()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/internal/modules/:name', (req, res) => {
    try { res.json(moduleManager.getStatus(req.params.name)); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  router.get('/internal/modules/:name/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    try { res.json(moduleManager.getLogs(req.params.name, limit)); }
    catch (err) { res.status(404).json({ error: err.message }); }
  });

  for (const action of ['start', 'stop', 'restart', 'enable', 'disable']) {
    router.post(`/internal/modules/:name/${action}`, async (req, res) => {
      try {
        await moduleManager[action](req.params.name, client);
        res.json({ success: true, module: moduleManager.getStatus(req.params.name) });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
  }

  return router;
};
