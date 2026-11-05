const router = require("express").Router();
const path = require("path");
const { isAuth, tierRequired, sendHTMLWithNonce, isPremiumGuild, PREMIUM_CAP, getGuildTier, checkDashboardAccess } = require('../../middleware');
const { getLimit } = require('../../../Utils/premiumTiers');
const YouTubeNotification = require("../../../Schemas/youtubeSchema");
const TwitchNotification  = require("../../../Schemas/twitchSchema");
const db247               = require("../../../Schemas/247");

// ─── Music ────────────────────────────────────────────────────────────────────

// Pre-populate player cache in standalone mode before any music route runs
async function hydratePlayer(req, res, next) {
  if (req.client && req.client.isStandaloneMode) {
    const guildId = req.params.id;
    if (guildId) await req.client.manager.fetchPlayer(guildId).catch(() => {});
  }
  next();
}

router.get("/guild/:id/music", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/music.html")));

// ── GET status ──────────────────────────────────────────────────
router.get("/api/guild/:id/music", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  try {
    const player  = req.client.manager.players.get(req.params.id);
    const data247 = await db247.findOne({ _id: req.params.id });

    if (!player) {
      return res.json({
        playing: false, paused: false, volume: 100, loop: "none",
        track: null, position: 0, queue: [], is247: data247?.mode ?? false,
        filters: [], autoplay: false,
      });
    }

    // In standalone mode `player` is a FakePlayer (plain data from the bot's
    // internal API): current track is top-level and queue is a plain array.
    const current = player.queue?.current ?? player.current ?? null;
    const queueArr = Array.isArray(player.queue) ? player.queue : (player.queue ? [...player.queue] : []);
    const autoplay = (typeof player.data?.get === "function" ? player.data.get("autoplay") : player.autoplay) ?? false;

    // Collect active filters
    const activeFilters = [];
    if (player.filters) {
      if (player.filters.timescale?.rate  > 1) activeFilters.push("nightcore");
      if (player.filters.timescale?.speed > 1) activeFilters.push("doubletime");
      if (player.filters.timescale?.pitch < 1) activeFilters.push("slow");
      if (player.filters.rotation)  activeFilters.push("eightD");
      if (player.filters.tremolo)   activeFilters.push("tremolo");
      if (player.filters.vibrato)   activeFilters.push("vibrato");
      if (player.filters.lowPass)   activeFilters.push("soft");
    }

    const queueMap = t => ({
      title: t.title, author: t.author,
      thumbnail: t.thumbnail, duration: t.length, uri: t.uri,
    });

    if (!current) {
      return res.json({
        playing: false, paused: player.paused, volume: player.volume,
        loop: player.loop, track: null, position: player.position,
        queue: queueArr.map(queueMap), is247: data247?.mode ?? false,
        filters: activeFilters, autoplay,
      });
    }

    return res.json({
      playing: true, paused: player.paused, volume: player.volume,
      loop: player.loop,
      track: {
        title: current.title, author: current.author,
        thumbnail: current.thumbnail, duration: current.length, uri: current.uri,
      },
      position: player.position,
      queue: queueArr.map(queueMap),
      is247: data247?.mode ?? false,
      filters: activeFilters,
      autoplay,
    });
  } catch (err) {
    console.error("MUSIC STATUS ERROR:", err);
    return res.status(500).json({ error: "Failed to fetch music status" });
  }
});

// ── GET history (last 25 played tracks, stored on player) ──────
router.get("/api/guild/:id/music/history", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  try {
    const player = req.client.manager.players.get(req.params.id);
    if (!player) return res.json([]);
    const history = player.data.get("history") || [];
    res.json(history.slice(0, 25));
  } catch (err) {
    console.error("MUSIC HISTORY ERROR:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ── POST seek ──────────────────────────────────────────────────
router.post("/api/guild/:id/music/seek", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  const { position } = req.body;
  const player = req.client.manager.players.get(req.params.id);
  if (!player || !player.playing) return res.status(400).json({ error: "No active track" });
  const duration = player.queue.current?.length;
  if (!duration) return res.status(400).json({ error: "No duration" });
  player.seek(Math.max(0, Math.min(Number(position) || 0, duration)));
  res.json({ success: true });
});

// ── POST control (action allow-list) ──────────────────────────
const ALLOWED_ACTIONS = new Set([
  "pause", "skip", "previous", "shuffle", "loop",
  "clearFilters", "clearQueue", "enable247", "disable247",
]);

router.post("/api/guild/:id/music/control", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  const { action } = req.body;
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: "Unknown action" });
  }

  if (action === "enable247" || action === "disable247") {
    // 24/7 mode requires Basic tier or higher
    const _247tier = await getGuildTier(req.user?.id, req.params.id);
    if (!getLimit(_247tier, 'music247')) {
      return res.status(403).json({ error: '24/7 mode requires RankCore Basic or higher. Upgrade at /premium.' });
    }
    try {
      let data = await db247.findOne({ _id: req.params.id });
      if (!data) {
        data = new db247({
          _id: req.params.id, mode: action === "enable247",
          moderator: req.user.id, lastUpdated: Math.round(Date.now() / 1000),
        });
      } else {
        data.mode        = action === "enable247";
        data.moderator   = req.user.id;
        data.lastUpdated = Math.round(Date.now() / 1000);
      }
      await data.save();
      return res.json({ success: true, message: `24/7 Mode ${data.mode ? "Enabled" : "Disabled"}` });
    } catch (err) {
      console.error("24/7 Toggle Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
  }

  const player = req.client.manager.players.get(req.params.id);
  if (!player) return res.status(400).json({ error: "No player active" });

  try {
    switch (action) {
      case "pause":    await player.pause(!player.paused);                       break;
      case "skip":     await player.skip();                                      break;
      case "previous":
        if (player.queue?.previous) player.queue.unshift(player.queue.previous);
        else await player.seek(0);
        break;
      case "shuffle":
        if (typeof player.shuffle === "function") await player.shuffle(); else player.queue.shuffle();
        break;
      case "clearQueue":
        if (typeof player.clearQueue === "function") await player.clearQueue(); else player.queue.clear();
        break;
      case "loop":
        if      (player.loop === "none")  await player.setLoop("track");
        else if (player.loop === "track") await player.setLoop("queue");
        else                              await player.setLoop("none");
        break;
      case "clearFilters":
        if (typeof player.filter !== "function") return res.status(400).json({ error: "Filters are not available right now" });
        player.filter("clear");
        break;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("MUSIC CONTROL ERROR:", err);
    res.status(500).json({ error: "Action failed" });
  }
});

// ── POST volume ────────────────────────────────────────────────
router.post("/api/guild/:id/music/volume", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  const player = req.client.manager.players.get(req.params.id);
  if (!player) return res.status(400).json({ error: "No player" });
  const vol = Math.max(0, Math.min(parseInt(req.body.volume) || 100, 200));
  try {
    await player.setVolume(vol);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to set volume" });
  }
});

// ── POST filter ────────────────────────────────────────────────
const ALLOWED_FILTERS = new Set([
  "nightcore", "doubletime", "slow", "eightD", "tremolo", "vibrato", "soft",
  "pop", "party", "vaporwave", "bass", "karaoke", "electronic", "radio",
  "china", "darthvader", "daycore", "treblebass", "chimpunk", "clear",
]);

router.post("/api/guild/:id/music/filter", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), hydratePlayer, async (req, res) => {
  const { filter } = req.body;
  if (!ALLOWED_FILTERS.has(filter)) return res.status(400).json({ error: "Unknown filter" });
  const player = req.client.manager.players.get(req.params.id);
  if (!player) return res.status(400).json({ error: "No player" });
  player.filter(filter);
  res.json({ success: true });
});

// ── POST play ──────────────────────────────────────────────────
router.post("/api/guild/:id/music/play", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "No query provided" });

    // Standalone dashboard: the bot process owns voice state and the player
    if (req.client.isStandaloneMode) {
      const { apiPost } = require("../../lib/botClient");
      try {
        const out = await apiPost(`/internal/guild/${req.params.id}/player/play`, { userId: req.user.id, query: String(query).slice(0, 500) });
        return res.json(out);
      } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || "Play failed" });
      }
    }

    const guild = req.client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const member = guild.members.cache.get(req.user.id);
    if (!member?.voice?.channel) return res.status(400).json({ error: "You must be in a voice channel" });

    let player = req.client.manager.players.get(req.params.id);
    if (!player) {
      player = await req.client.manager.createPlayer({
        guildId: req.params.id, textId: guild.systemChannelId,
        voiceId: member.voice.channel.id, volume: 100, deaf: true,
      });
    }

    const result = await player.search(query, { requester: req.user });
    if (!result.tracks?.length) return res.status(404).json({ error: "No results found" });

    if (result.type === "PLAYLIST") {
      for (const track of result.tracks) player.queue.add(track);
    } else {
      player.queue.add(result.tracks[0]);
    }

    if (!player.playing && !player.paused) player.play();

    return res.json({ success: true, queued: result.type === "PLAYLIST" ? result.tracks.length : 1 });
  } catch (err) {
    console.error("DASHBOARD PLAY ERROR:", err);
    return res.status(500).json({ error: "Play failed" });
  }
});

// ── POST queue/reorder ─────────────────────────────────────────
// Body: { queue: [0, 2, 1, 3, ...] } — array of original indices in new order
router.post("/api/guild/:id/music/queue/reorder", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  try {
    const player = req.client.manager.players.get(req.params.id);
    if (!player) return res.status(400).json({ error: "No player active" });

    const indices = req.body.queue;
    if (!Array.isArray(indices)) return res.status(400).json({ error: "Invalid queue order" });

    const currentTracks = [...player.queue];
    const maxIdx = currentTracks.length - 1;

    // Validate indices
    const valid = indices.every(i => Number.isInteger(i) && i >= 0 && i <= maxIdx);
    if (!valid || indices.length !== currentTracks.length) {
      return res.status(400).json({ error: "Invalid queue indices" });
    }

    const reordered = indices.map(i => currentTracks[i]);
    player.queue.clear();
    for (const track of reordered) player.queue.add(track);

    res.json({ success: true });
  } catch (err) {
    console.error("QUEUE REORDER ERROR:", err);
    res.status(500).json({ error: "Reorder failed" });
  }
});

// ── POST queue/remove ──────────────────────────────────────────
router.post("/api/guild/:id/music/queue/remove", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  try {
    const player = req.client.manager.players.get(req.params.id);
    if (!player) return res.status(400).json({ error: "No player active" });

    const index = parseInt(req.body.index);
    if (isNaN(index) || index < 0 || index >= player.queue.size) {
      return res.status(400).json({ error: "Invalid queue index" });
    }

    const tracks = [...player.queue];
    tracks.splice(index, 1);
    player.queue.clear();
    for (const track of tracks) player.queue.add(track);

    res.json({ success: true });
  } catch (err) {
    console.error("QUEUE REMOVE ERROR:", err);
    res.status(500).json({ error: "Remove failed" });
  }
});

// ── POST autoplay toggle ───────────────────────────────────────
router.post("/api/guild/:id/music/autoplay", isAuth, checkDashboardAccess('overview'), hydratePlayer, async (req, res) => {
  try {
    const player = req.client.manager.players.get(req.params.id);
    if (!player) return res.status(400).json({ error: "No player active" });

    const enabled = Boolean(req.body.enabled);
    player.data.set("autoplay", enabled);

    // If toggling on, also store current track identifier for seed
    if (enabled && player.queue?.current) {
      const uri = player.queue.current.uri || "";
      const match = uri.match(/[?&]v=([^&]+)/);
      if (match) player.data.set("identifier", match[1]);
    }

    res.json({ success: true, autoplay: enabled });
  } catch (err) {
    console.error("AUTOPLAY TOGGLE ERROR:", err);
    res.status(500).json({ error: "Autoplay toggle failed" });
  }
});

module.exports = router;