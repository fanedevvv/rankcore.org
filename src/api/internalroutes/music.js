'use strict';

// Routes:
//   GET    /internal/guild/:id/player
//   POST   /internal/guild/:id/player/pause
//   POST   /internal/guild/:id/player/resume
//   POST   /internal/guild/:id/player/skip
//   POST   /internal/guild/:id/player/stop
//   POST   /internal/guild/:id/player/volume
//   POST   /internal/guild/:id/player/seek
//   POST   /internal/guild/:id/player/shuffle
//   POST   /internal/guild/:id/player/loop
//   POST   /internal/guild/:id/player/queue/clear
//   DELETE /internal/guild/:id/player/queue/:index
//   POST   /internal/guild/:id/player/play
//   POST   /internal/guild/:id/player/create

const { Router } = require('express');

module.exports = (client) => {
  const router   = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;
  const getPlayer = (id) => client.manager?.players?.get(id);

  // ── Player state ──────────────────────────────────────────────────────────

  router.get('/internal/guild/:id/player', (req, res) => {
    const player = getPlayer(req.params.id);
    if (!player) return res.status(404).json({ error: 'No active player' });
    res.json({
      guildId:        player.guildId,
      playing:        player.playing,
      paused:         player.paused,
      volume:         player.volume,
      loop:           player.loop,
      current: player.queue?.current ? {
        title:     player.queue.current.title,
        author:    player.queue.current.author,
        uri:       player.queue.current.uri,
        length:    player.queue.current.length,
        thumbnail: player.queue.current.thumbnail,
      } : null,
      queue: player.queue?.map(t => ({
        title: t.title, author: t.author, uri: t.uri, length: t.length,
      })) ?? [],
      position:       player.position,
      voiceChannelId: player.voiceChannelId,
      textChannelId:  player.textChannelId,
    });
  });

  // ── Player controls ───────────────────────────────────────────────────────

  router.post('/internal/guild/:id/player/pause',   (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.pause(true);
    res.json({ success: true });
  });

  router.post('/internal/guild/:id/player/resume',  (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.pause(false);
    res.json({ success: true });
  });

  router.post('/internal/guild/:id/player/skip',    async (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    try { await p.skip(); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/internal/guild/:id/player/stop',    async (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    try { await p.destroy(); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/internal/guild/:id/player/volume',  (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.setVolume(req.body.volume ?? 100);
    res.json({ success: true });
  });

  router.post('/internal/guild/:id/player/seek',    (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.seek(req.body.position ?? 0);
    res.json({ success: true });
  });

  router.post('/internal/guild/:id/player/shuffle', (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.queue.shuffle();
    res.json({ success: true });
  });

  router.post('/internal/guild/:id/player/loop',    (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.setLoop(req.body.mode ?? 'none');
    res.json({ success: true });
  });

  // ── Queue management ──────────────────────────────────────────────────────

  router.post('/internal/guild/:id/player/queue/clear', (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    p.queue.clear();
    res.json({ success: true });
  });

  router.delete('/internal/guild/:id/player/queue/:index', (req, res) => {
    const p = getPlayer(req.params.id);
    if (!p) return res.status(404).json({ error: 'No player' });
    const idx = parseInt(req.params.index);
    if (isNaN(idx) || idx < 0 || idx >= p.queue.length)
      return res.status(400).json({ error: 'Invalid index' });
    p.queue.splice(idx, 1);
    res.json({ success: true });
  });

  // ── Create player (join voice + play) ────────────────────────────────────

  // Search + queue a track for a dashboard user (joins their voice channel if needed)
  router.post('/internal/guild/:id/player/play', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const { userId, query } = req.body || {};
    if (!query) return res.status(400).json({ error: 'No query provided' });
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      const voiceId = member?.voice?.channelId;
      if (!voiceId) return res.status(400).json({ error: 'Join a voice channel in this server first' });

      let player = getPlayer(req.params.id);
      if (player && player.voiceId && player.voiceId !== voiceId)
        return res.status(400).json({ error: 'RankCore is already playing in another voice channel' });
      if (!player) {
        player = await client.manager.createPlayer({
          guildId: req.params.id, voiceId,
          textId:  guild.systemChannelId || undefined,
          deaf:    true, volume: 100, shardId: guild.shardId,
        });
      }

      const user = await client.users.fetch(userId).catch(() => null);
      const result = await player.search(query, { requester: user });
      if (!result.tracks?.length) return res.status(404).json({ error: 'No results found' });

      const tracks = result.type === 'PLAYLIST' ? result.tracks : [result.tracks[0]];
      for (const t of tracks) player.queue.add(t);
      if (!player.playing && !player.paused) player.play();

      res.json({ success: true, queued: tracks.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/internal/guild/:id/player/create', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      const member = guild.members.cache.get(req.body.userId);
      if (!member?.voice?.channelId) return res.status(400).json({ error: 'User not in voice channel' });
      let player = getPlayer(req.params.id);
      if (!player) {
        player = await client.manager.createPlayer({
          guildId: req.params.id,
          voiceId: member.voice.channelId,
          textId:  req.body.textChannelId,
          deaf:    true,
          shardId: guild.shardId,
        });
      }
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};