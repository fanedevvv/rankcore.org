'use strict';

// Routes:
//   GET /internal/guild/:id/roles

const { Router } = require('express');
const { serializeRole } = require('../helpers');

module.exports = (client) => {
  const router   = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  router.get('/internal/guild/:id/roles', (req, res) => {
    try {
      const guild = getGuild(req.params.id);
      if (!guild) return res.json([]);
      res.json(
        guild.roles.cache
          .sort((a, b) => b.rawPosition - a.rawPosition)
          .map(serializeRole)
      );
    } catch (err) {
      console.error('[internal /roles]', err);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  });

  return router;
};