'use strict';

// Routes:
//   POST /internal/guild/:id/jtc/panel   — post (or refresh) the permanent Join-to-Create panel

const { Router } = require('express');
const { postPersistentPanel } = require('../../../Systems/jointocreate');

module.exports = (client) => {
  const router = Router();

  router.post('/internal/guild/:id/jtc/panel', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      res.json({ success: true, ...(await postPersistentPanel(client, guild)) });
    } catch (err) {
      if (!err.status) console.error('[internal jtc/panel]', err);
      res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not post the panel.' });
    }
  });

  return router;
};
