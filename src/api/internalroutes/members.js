'use strict';

// Routes:
//   GET  /internal/guild/:id/member/:userId
//   GET  /internal/guild/:id/members
//   GET  /internal/guild/:id/member/:userId/roles
//   POST /internal/guild/:id/member/:userId/roles/add
//   POST /internal/guild/:id/member/:userId/roles/remove
//   POST /internal/guild/:id/member/:userId/kick
//   POST /internal/guild/:id/member/:userId/ban

const { Router } = require('express');
const { serializeMember } = require('../helpers');

module.exports = (client) => {
  const router   = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  // ── Fetch individual member ───────────────────────────────────────────────

  router.get('/internal/guild/:id/member/:userId', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const m = await guild.members.fetch(req.params.userId);
      res.json(serializeMember(m));
    } catch { res.status(404).json({ error: 'Member not found' }); }
  });

  // Fetch all members (used by uwulock)
  router.get('/internal/guild/:id/members', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const members = await guild.members.fetch();
      res.json(members.map(serializeMember));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Role management ───────────────────────────────────────────────────────

  router.get('/internal/guild/:id/member/:userId/roles', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const m = await guild.members.fetch(req.params.userId);
      res.json({ roleIds: [...m.roles.cache.keys()] });
    } catch { res.status(404).json({ error: 'Member not found' }); }
  });

  // Used by IP verification and other dashboard routes
  router.post('/internal/guild/:id/member/:userId/roles/add', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId is required' });
    try {
      const member = await guild.members.fetch(req.params.userId);
      await member.roles.add(roleId);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/internal/guild/:id/member/:userId/roles/remove', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const { roleId } = req.body;
    if (!roleId) return res.status(400).json({ error: 'roleId is required' });
    try {
      const member = await guild.members.fetch(req.params.userId);
      await member.roles.remove(roleId);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── Moderation actions ────────────────────────────────────────────────────

  // Used by IP verification failAction
  router.post('/internal/guild/:id/member/:userId/kick', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const member = await guild.members.fetch(req.params.userId).catch(() => null);
      if (!member) return res.status(404).json({ error: 'Member not found' });
      await member.kick(req.body.reason || 'Kicked by verification system');
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Used by IP verification failAction
  router.post('/internal/guild/:id/member/:userId/ban', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      await guild.bans.create(req.params.userId, {
        reason:            req.body.reason || 'Banned by verification system',
        deleteMessageDays: req.body.deleteMessageDays ?? 0,
      });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};