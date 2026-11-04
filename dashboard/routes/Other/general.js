const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess, refreshUserGuilds } = require('../../middleware');
const { ChannelType } = require("discord.js");
const getOwners = require("../../../Utils/getOwners");
const PremiumGuild = require("../../../Schemas/premiumGuildSchema");
const { tierFromDoc, getTier, getLimit } = require("../../../Utils/premiumTiers");

// ─── DEBUG (remove after diagnosis) ──────────────────────────────────────────
router.get("/api/debug-bot-state", isAuth, async (req, res) => {
  const c = req.client;
  res.json({
    _online:       c._online,
    _refreshing:   c._refreshing,
    _refreshFails: c._refreshFails,
    guildCacheSize: c.guilds.cache.size,
    isReady:       c.isReady(),
    uptime:        c.uptime,
    ping:          c.ws.ping,
    user:          c.user,
  });
});

// ─── APIs ─────────────────────────────────────────────────────────────────────

router.get("/api/user/me", isAuth, async (req, res) => {
  const devIDs = await getOwners();
  res.json({
    id:            req.user.id,
    username:      req.user.username,
    discriminator: req.user.discriminator,
    avatar:        req.user.avatar
      ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png",
    isDev: devIDs.includes(req.user.id),
  });
});

router.get("/api/servers", isAuth, async (req, res) => {
  const devIDs = await getOwners();

  // ── Refresh user's guilds from Discord ───────────────────────────────────
  // The servers page is the one place where the user explicitly wants an
  // up-to-date list, so we bypass the normal TTL by clearing the timestamp.
  // This means at most one Discord API call per page load of /servers —
  // subsequent navigation to guild pages uses the TTL-gated path in middleware
  // and will NOT hit Discord again until 90 s have elapsed.
  if (req.user.accessToken) {
    delete req.session.guildsRefreshedAt; // force a fresh fetch this one time
    try {
      await refreshUserGuilds(req);
    } catch (err) {
      if (err.tokenExpired) {
        req.logout?.(() => {});
        return res.status(401).json({ error: "session_expired", redirectTo: "/login" });
      }
      // Non-fatal — fall through with whatever is cached in req.user.guilds
    }
  }

  // The cached guild list (possibly just refreshed above) lives in req.user.guilds

  // ── Ensure _online is current before we read it ───────────────────────────
  // BotClientShim._online starts as false and is only updated by the periodic
  // refresh() (every 5 s). If this request arrives before the first refresh
  // completes (cold start, bot restart, etc.) _online is still false even
  // though the bot is actually online — causing every server card to show
  // "Offline" until the next refresh cycle fires.
  //
  // refreshStatus() is the same lightweight fix already applied in status-api.js:
  // it hits /internal/bot-info once, updates _online synchronously, and returns.
  // It's a no-op when a full refresh() is already in-flight (_refreshing guard),
  // so there's no race condition to worry about.
  // Poll for up to 3 s after a restart so the Discord gateway reconnect window
  // doesn't cause a false "offline" response. refreshStatus() now debounces
  // ready:false the same way it debounces network failures, so repeated calls
  // here won't prematurely flip _online to false.
  if (req.client.isStandaloneMode && typeof req.client.refresh === 'function') {
    const WAIT_MS = 3_000;
    const POLL_MS = 400;
    let waited = 0;
    while ((!req.client._online || req.client.guilds.cache.size === 0) && waited < WAIT_MS) {
      try { await req.client.refresh(); } catch (_) {}
      if (req.client._online && req.client.guilds.cache.size > 0) break;
      await new Promise(r => setTimeout(r, POLL_MS));
      waited += POLL_MS;
    }
  }

  // ── Determine bot reachability ────────────────────────────────────────────
  // In standalone mode _online is the authoritative flag set by the periodic
  // refresh().  We additionally require the guild cache to be non-empty:
  // if the bot just restarted, _online can be true for a brief window while
  // the internal /guilds endpoint still returns [] (gateway not fully ready).
  // In that window every server would show "Invite Bot" because botGuilds.get()
  // returns null for everything.  Treating an empty cache as "not yet reachable"
  // keeps the servers page accurate — the fast-retry in botClient will populate
  // the cache within a second or two and the user can reload.
  const cachePopulated = req.client.guilds.cache.size > 0;
  const botReachable = req.client.isStandaloneMode
    ? (req.client._online === true && cachePopulated)
    : !!(req.client.user && req.client.guilds.cache.size > 0);

  // ── Get the guild map the bot is actually in ──────────────────────────────
  // botReachable is now only true when the cache is already populated (see above),
  // so botGuilds.get() is guaranteed to return real data when botReachable=true.
  // The old emergency live-fetch fallback (triggered when cache was empty but
  // _online was true) has been removed — that race is now prevented upstream in
  // botClient.refresh() which keeps the last-known-good cache alive and delays
  // setting _online=true until the guild list is non-empty.
  const botGuilds = req.client.guilds.cache;

  const servers = (req.user.guilds || [])
    .filter(g => {
      if (!g.id || !/^\d{17,20}$/.test(g.id)) return false;
      const permValue = BigInt(g.permissions || 0);
      const MANAGE_GUILD = 0x20n;
      return (permValue & MANAGE_GUILD) === MANAGE_GUILD;
    })
    .map(g => {
      const botGuild = botGuilds.get(g.id);
      return {
        id:    g.id,
        name:  g.name,
        icon:  g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256` : null,
        banner: botGuild?.banner
          ? `https://cdn.discordapp.com/banners/${g.id}/${botGuild.banner}.png?size=512`
          : "https://i.pinimg.com/originals/34/1e/80/341e800b1f29d3e34ea2eba5a6af205c.gif",
        hasBot: !!botGuild,
      };
    })
    .sort((a, b) => b.hasBot - a.hasBot);

  res.json({
    clientId:     req.client.user?.id ?? null,
    botReachable,
    user: {
      id:            req.user.id,
      username:      req.user.username,
      discriminator: req.user.discriminator,
      avatar:        req.user.avatar
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
        : "https://cdn.discordapp.com/embed/avatars/0.png",
      isDev: devIDs.includes(req.user.id),
    },
    servers,
  });
});

router.get("/api/guild/:id", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    if (req.client.isStandaloneMode) {
      // In standalone mode the internal API (/internal/guild/:id) already
      // fetches the live Discord.js guild, computes owner/presence/counts, and
      // serialises everything — including iconURL as a pre-built string.
      // We just proxy that response directly so we never call iconURL() on a
      // plain-object (which would throw "is not a function").
      const { apiGet } = require("../../lib/botClient");
      const data = await apiGet(`/internal/guild/${req.params.id}`);
      if (!data || data.error) return res.status(404).json({ error: "Not found" });

      return res.json({
        id:         data.id,
        name:       data.name,
        icon:       data.iconURL || null,
        owner:      data.owner   || "Unknown",
        members:    data.memberCount  || 0,
        humans:     data.humans       || 0,
        bots:       data.bots         || 0,
        created:    data.createdAt ? new Date(data.createdAt).toDateString() : "Unknown",
        roles:      data.roles    || 0,
        channels:   data.channels || 0,
        emojis:     data.emojis   || 0,
        boosts:     data.premiumSubscriptionCount || 0,
        boostLevel: data.premiumTier              || 0,
        presence:   data.presence || { online: 0, idle: 0, dnd: 0, offline: 0 },
      });
    }

    // Bot-embedded mode — req.client is a live Discord.js Client.
    const guild = req.client.guilds.cache.get(req.params.id);
    if (!guild) return res.status(404).json({ error: "Not found" });

    const owner          = await guild.fetchOwner();
    const presenceCounts = { online: 0, idle: 0, dnd: 0, offline: 0 };
    guild.members.cache.forEach(member => {
      const status = member.presence?.status || "offline";
      if (presenceCounts[status] !== undefined) presenceCounts[status]++;
    });

    res.json({
      id:         guild.id,
      name:       guild.name,
      icon:       guild.iconURL({ size: 256 }),
      owner:      `${owner.user.username}#${owner.user.discriminator}`,
      members:    guild.memberCount,
      humans:     guild.members.cache.filter(m => !m.user?.bot).size,
      bots:       guild.members.cache.filter(m =>  m.user?.bot).size,
      created:    new Date(guild.createdAt).toDateString(),
      roles:      guild.roles.cache.size,
      channels:   guild.channels.cache.size,
      emojis:     guild.emojis.cache.size,
      boosts:     guild.premiumSubscriptionCount || 0,
      boostLevel: guild.premiumTier || 0,
      presence:   presenceCounts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch guild data" });
  }
});

router.get("/api/guild/:id/verification-level", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const guild = await req.client.guilds.fetch(req.params.id);
    if (!guild) return res.status(404).json({ error: "Guild not found" });
    const levels    = ["None", "Low", "Medium", "High", "Very High"];
    const levelName = levels[guild.verificationLevel] || "Unknown";
    res.json({ level: levelName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ level: "Unknown" });
  }
});

router.get("/api/guild/:id/channels", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  if (req.client.isStandaloneMode) {
    try {
      const { apiGet } = require("../../lib/botClient");
      const [channels, _categories] = await Promise.all([
        apiGet(`/internal/guild/${req.params.id}/channels/text-with-parent`).catch(() => []),
        apiGet(`/internal/guild/${req.params.id}/channels/categories`).catch(() => []),
      ]);
      return res.json({ channels, _categories });
    } catch {
      return res.json({ channels: [], _categories: [] });
    }
  }
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.json({ channels: [], _categories: [] });

  const _categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map(c => ({ id: c.id, name: c.name, rawPosition: c.rawPosition }));

  const channels = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map(c => ({ id: c.id, name: c.name, parentId: c.parentId || null }));

  res.json({ channels: Array.from(channels.values()), _categories: Array.from(_categories.values()) });
});

router.get("/api/guild/:id/voice-channels", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  if (req.client.isStandaloneMode) {
    const { apiGet } = require("../../lib/botClient");
    return res.json(await apiGet(`/internal/guild/${req.params.id}/channels/voice`).catch(() => []));
  }
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.json([]);
  res.json(
    guild.channels.cache
      .filter(c => c.type === ChannelType.GuildVoice)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map(c => ({ id: c.id, name: c.name }))
  );
});

router.get("/api/guild/:id/categories", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  if (req.client.isStandaloneMode) {
    const { apiGet } = require("../../lib/botClient");
    return res.json(await apiGet(`/internal/guild/${req.params.id}/channels/category`).catch(() => []));
  }
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.json([]);
  res.json(
    guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map(c => ({ id: c.id, name: c.name }))
  );
});

router.get("/api/guild/:id/roles", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  const guildId = req.params.id;
  const start = Date.now();

  try {
    const client = req.client || req.app.get("client");

    if (!client) {
      console.warn(`[EMBED ROLES] No client available | guild ${guildId}`);
      return res.json([]);
    }

    let guild = null;

    try {
      guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    } catch (err) {
      console.warn(`[EMBED ROLES] Guild fetch failed ${guildId}:`, err.message);
      return res.json([]);
    }

    if (!guild) {
      console.warn(`[EMBED ROLES] Guild not found ${guildId}`);
      return res.json([]);
    }

    let rolesCollection = null;

    // Use cache if available
    if (guild.roles && guild.roles.cache && guild.roles.cache.size > 0) {
      rolesCollection = guild.roles.cache;
    }

    // Fetch if possible
    else if (guild.roles && typeof guild.roles.fetch === "function") {
      rolesCollection = await guild.roles.fetch().catch(err => {
        console.warn(`[EMBED ROLES] roles.fetch failed:`, err.message);
        return null;
      });
    }

    // Fallback
    else {
      console.warn(`[EMBED ROLES] roles manager missing`);
      return res.json([]);
    }

    if (!rolesCollection) {
      console.warn(`[EMBED ROLES] No roles returned`);
      return res.json([]);
    }

    const list = [...rolesCollection.values()]
      .filter(r => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor || "#000000"
      }));

    res.json(list);

  } catch (err) {
    console.error(
      `[EMBED ROLES] Fatal error guild ${guildId} | ${Date.now() - start}ms`,
      err.message
    );

    res.status(500).json({ error: "Failed to fetch roles." });
  }
});

router.get("/api/guild/:guildId/channel/:channelId/webhooks", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const guild = await req.client.guilds.fetch(req.params.guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const channel = await guild.channels.fetch(req.params.channelId);
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    if (channel.type !== ChannelType.GuildText) {
      return res.status(400).json({ error: "Webhooks only supported for text channels" });
    }

    const webhooks = await channel.fetchWebhooks();
    const list = Array.from(webhooks.values()).map(wh => ({
      id:     wh.id,
      name:   wh.name,
            avatar: wh.avatar
        ? `https://cdn.discordapp.com/avatars/${wh.id}/${wh.avatar}.png`
        : null,
    }));

    res.json(list);
  } catch (err) {
    console.error("Failed to fetch webhooks:", err);
    res.status(500).json({ error: "Failed to fetch webhooks" });
  }
});

router.get("/api/guild/:id/premium-status", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const guildId = req.params.id;

  // Premium is guild-scoped only — look at guild doc only.
  const guildDoc = await PremiumGuild.findOne({ id: guildId });

  const effectiveTier = tierFromDoc(guildDoc);
  const tierCfg       = getTier(effectiveTier);
  const hasPremium    = effectiveTier !== 'free';

  res.json({
    hasPremium,
    plan:      effectiveTier,
    tier:      effectiveTier,
    tierName:  tierCfg.name,
    tierEmoji: tierCfg.emoji,
    source:    hasPremium ? 'guild' : null,
    expiresAt: guildDoc?.premium?.expiresAt ?? null,
    // Infinity doesn't survive JSON (it becomes null), so unlimited is sent as "unlimited"
    limits: Object.fromEntries([
      'autoresponders', 'customCommands', 'ticketCategories', 'reactionRoles', 'stickyMessages',
      'embedTemplates', 'logChannels', 'connectionRoles', 'playlists', 'backups',
      'youtubeNotifs', 'twitchNotifs', 'musicFilters', 'aiChatbot', 'customBranding',
    ].map(k => {
      const v = getLimit(effectiveTier, k);
      return [k, v === Infinity ? 'unlimited' : v];
    })),
  });
});

module.exports = router;