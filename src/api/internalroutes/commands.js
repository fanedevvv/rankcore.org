'use strict';

// Routes:
//   GET  /internal/application/commands       — global application command list
//   GET  /internal/commands                   — in-memory command collection
//   POST /internal/application/commands/sync  — sync all commands globally
//   POST /internal/guild/:id/commands/sync    — toggle single command for guild
//   POST /internal/guild/:id/commands/bulk-sync
//   POST /internal/guild/commands/restore-all — startup re-sync after restart

const { Router } = require('express');
const { REST, Routes } = require('discord.js');

module.exports = (client) => {
  const router   = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  // ── Application command list (dev panel) ──────────────────────────────────

  router.get('/internal/application/commands', (req, res) => {
    const commands = client.application?.commands?.cache?.map(c => c.toJSON()) ?? [];
    res.json(commands);
  });

  // ── In-memory command collection (Command Manager dashboard page) ─────────
  // Returns name/description/category/premium for every loaded command handler.

  router.get('/internal/commands', (req, res) => {
    if (!client.commands) return res.json([]);
    const list = client.commands
      .filter(c => c?.data && typeof c.data.toJSON === 'function')
      .map(c => ({
        name:        c.data.name,
        description: c.data.description || '',
        category:    c.category || 'Uncategorized',
        premium:     !!c.premium,
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    res.json(list);
  });

  // ── Global sync (dev panel) ───────────────────────────────────────────────

  router.post('/internal/application/commands/sync', async (req, res) => {
    try {
      const commands = client.commands
        .filter(c => c?.data && typeof c.data.toJSON === 'function')
        .map(c => c.data.toJSON());
      if (!commands.length) return res.json({ success: true, message: 'No commands to sync' });
      const rest = new REST({ version: '10' }).setToken(process.env.token);
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      res.json({ success: true, count: commands.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Per-guild command routes (kept for the dashboard; nothing to register) ──
  // All built-in commands are registered globally now, so enabling/disabling a command
  // in a server is just the disabledCommands list in the DB (checked in slash.js).
  // Guild-scoped registrations hold only that server's custom commands, which
  // Events/ready.js restores on startup — so restore-all must not touch them.

  router.post('/internal/guild/:id/commands/sync', (req, res) => res.json({ success: true, global: true }));
  router.post('/internal/guild/:id/commands/bulk-sync', (req, res) => res.json({ success: true, global: true }));
  router.post('/internal/guild/commands/restore-all', (req, res) => res.json({ success: true, global: true }));

  return router;
};