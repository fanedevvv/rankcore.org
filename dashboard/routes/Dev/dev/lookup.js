"use strict";

// lookup.js — user lookup, guild lookup, guild invite, botstats, search, changelog, health

const router          = require("express").Router();
const os              = require("os");
const PremiumUser     = require("../../../../Schemas/premiumUserSchema");
const PremiumGuild    = require("../../../../Schemas/premiumGuildSchema");
const Blacklist       = require("../../../../Schemas/blacklistSchema");
const ServerBlacklist = require("../../../../Schemas/serverBlacklistSchema");
const Changelogs      = require("../../../../Schemas/changelogs.js");
const getOwners       = require("../../../../Utils/getOwners");
const { getRequestLogs, formatBytes, formatUptime } = require("../../Utils/dashboardLoggers");

let disk;
try { disk = require("diskusage"); } catch { disk = null; }

const { secureDevApi } = require("./shared");

/* ─────────────────────────────────────────────
   SERVER STATS
───────────────────────────────────────────── */

router.get("/api-dev/server-stats", ...secureDevApi, async (req, res) => {
  const total = os.totalmem();
  const free  = os.freemem();
  const used  = total - free;

  let diskStats = { used: "N/A", total: "N/A", percent: 0 };
  if (disk) {
    try {
      const info = await disk.check(os.platform() === "win32" ? "C:" : "/");
      diskStats = {
        total:   (info.total / 1e9).toFixed(1) + " GB",
        used:    ((info.total - info.available) / 1e9).toFixed(1) + " GB",
        percent: Math.round(((info.total - info.available) / info.total) * 100),
      };
    } catch {}
  }

  res.json({
    cpu: {
      model: os.cpus()[0]?.model?.replace(/\(R\)|\(TM\)|Core|CPU/g, "").trim() ?? "Unknown",
      cores: os.cpus().length,
      load:  (os.loadavg()[0] * 10).toFixed(1),
    },
    memory: {
      total:        formatBytes(total),
      used:         formatBytes(used),
      usagePercent: Math.round((used / total) * 100),
    },
    system: {
      platform:    `${os.type()} ${os.arch()}`,
      uptime:      formatUptime(os.uptime()),
      nodeVersion: process.version,
    },
    process: {
      pid:    process.pid,
      memory: formatBytes(process.memoryUsage().rss),
      uptime: formatUptime(process.uptime()),
    },
    disk: diskStats,
    bot: {
      guilds: req.client?.guilds?.cache?.size ?? 0,
      ping:   req.client?.ws?.ping ?? -1,
    },
  });
});

/* ─────────────────────────────────────────────
   TRAFFIC LOGS
───────────────────────────────────────────── */

router.get("/api-dev/requests", ...secureDevApi, (req, res) => {
  res.json(getRequestLogs());
});

/* ─────────────────────────────────────────────
   HOLISTIC BOT STATS
───────────────────────────────────────────── */

router.get("/api-dev/botstats", ...secureDevApi, async (req, res) => {
  try {
    const [userPrem, guildPrem, blUsers, blGuilds, owners] = await Promise.all([
      PremiumUser.countDocuments({ isPremium: true }),
      PremiumGuild.countDocuments({ isPremiumGuild: true }),
      Blacklist.countDocuments(),
      ServerBlacklist.countDocuments(),
      getOwners(),
    ]);

    res.json({
      guilds:      req.client.guilds.cache.size,
      users:       req.client.users.cache.size,
      channels:    req.client.channels.cache.size,
      ping:        req.client.ws.ping,
      premium:     { users: userPrem,  guilds: guildPrem },
      blacklisted: { users: blUsers,   guilds: blGuilds  },
      owners:      owners.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   BOT HEALTH
───────────────────────────────────────────── */

const _healthHistory = [];
const HEALTH_KEEP    = 60;

function recordHealth() {
  const mem  = process.memoryUsage();
  const load = os.loadavg();
  const snap = {
    ts:       Date.now(),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    rss:      Math.round(mem.rss      / 1024 / 1024),
    load1:    Math.round(load[0] * 100) / 100,
    ping:     0,
  };
  if (_healthHistory.length >= HEALTH_KEEP) _healthHistory.shift();
  _healthHistory.push(snap);
}
setInterval(recordHealth, 15_000);
recordHealth();

router.get("/api-dev/health", ...secureDevApi, (req, res) => {
  const history = _healthHistory.map(h => ({ ...h, ping: req.client?.ws?.ping ?? h.ping }));
  res.json({
    history,
    current: {
      ping:     req.client?.ws?.ping ?? 0,
      guilds:   req.client?.guilds?.cache?.size ?? 0,
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rss:      Math.round(process.memoryUsage().rss      / 1024 / 1024),
      uptime:   Math.floor(process.uptime()),
    },
  });
});

/* ─────────────────────────────────────────────
   USER LOOKUP
───────────────────────────────────────────── */

router.get("/api-dev/user/:userId", ...secureDevApi, async (req, res) => {
  const { userId } = req.params;
  if (!/^\d{17,19}$/.test(userId)) return res.status(400).json({ error: "Invalid user ID format" });

  try {
    const [user, premium, bl] = await Promise.all([
      req.client.users.fetch(userId, { force: true }),
      PremiumUser.findOne({ id: userId }).lean(),
      Blacklist.findOne({ userId }).lean(),
    ]);

    res.json({
      id:              user.id,
      username:        user.username,
      discriminator:   user.discriminator,
      avatar:          user.displayAvatarURL({ size: 256 }),
      bot:             user.bot,
      createdAt:       user.createdAt,
      isPremium:       premium?.isPremium ?? false,
      premiumPlan:     premium?.premium?.plan ?? null,
      premiumExpiry:   premium?.premium?.expiresAt ?? null,
      isBlacklisted:   !!bl,
      blacklistReason: bl?.reason ?? null,
    });
  } catch (err) {
    res.status(404).json({ error: "User not found: " + err.message });
  }
});

/* ─────────────────────────────────────────────
   GUILD LOOKUP
───────────────────────────────────────────── */

router.get("/api-dev/guild/:guildId", ...secureDevApi, async (req, res) => {
  const { guildId } = req.params;
  if (!/^\d{17,19}$/.test(guildId)) return res.status(400).json({ error: "Invalid guild ID format" });

  const guild = req.client.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: "Bot is not in that guild" });

  const [premiumDoc, blDoc] = await Promise.all([
    PremiumGuild.findOne({ id: guildId }).lean(),
    ServerBlacklist.findOne({ serverId: guildId }).lean(),
  ]);

  res.json({
    id:              guild.id,
    name:            guild.name,
    memberCount:     guild.memberCount,
    ownerId:         guild.ownerId,
    createdAt:       guild.createdAt,
    icon:            guild.iconURL({ size: 256 }),
    isPremium:       premiumDoc?.isPremiumGuild ?? false,
    premiumPlan:     premiumDoc?.premium?.plan ?? null,
    premiumExpiry:   premiumDoc?.premium?.expiresAt ?? null,
    isBlacklisted:   !!blDoc,
    blacklistReason: blDoc?.reason ?? null,
  });
});

/* ─────────────────────────────────────────────
   GUILD INVITE GENERATION
───────────────────────────────────────────── */

router.post("/api-dev/guild/:guildId/invite", ...secureDevApi, async (req, res) => {
  const { guildId } = req.params;
  if (!/^\d{17,19}$/.test(guildId)) return res.status(400).json({ error: "Invalid guild ID format" });

  const guild = req.client.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: "Bot is not in that guild" });

  try {
    // guild.createInvite() proxies to /internal/guild/:id/invite on the bot process
    // where real Discord.js channel objects are available. Works in both standalone
    // and direct mode.
    const invite = await guild.createInvite();
    console.log(`[DEV] Invite generated for ${guild.name} (${guildId}) — by ${req.user?.username}: ${invite.url}`);
    res.json({ success: true, url: invite.url, code: invite.code, expiresAt: invite.expiresAt });
  } catch (err) {
    res.status(500).json({ error: "Failed to create invite: " + err.message });
  }
});

/* ─────────────────────────────────────────────
   SEARCH
───────────────────────────────────────────── */

router.get("/api-dev/search", ...secureDevApi, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!/^\d{17,19}$/.test(q)) {
    return res.status(400).json({ error: "Enter a valid 17-19 digit Discord ID" });
  }

  const results = {};

  try {
    let user = null;
    try {
      user = await req.client.users.fetch(q, { force: true });
    } catch {
      try {
        const raw = await req.client.rest.get(`/users/${q}`);
        if (raw && raw.id) {
          const avatarHash = raw.avatar;
          const avatarUrl  = avatarHash
            ? `https://cdn.discordapp.com/avatars/${raw.id}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}?size=256`
            : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(raw.id) % 6n)}.png`;
          user = {
            id:            raw.id,
            username:      raw.username ?? "Unknown",
            discriminator: raw.discriminator ?? "0",
            avatar:        avatarUrl,
            bot:           raw.bot ?? false,
            createdAt:     new Date(Number((BigInt(raw.id) >> 22n) + 1420070400000n)),
          };
        }
      } catch {}
    }

    if (user) {
      const safeAvatar = (() => {
        try {
          if (typeof user.displayAvatarURL === "function") {
            const url = user.displayAvatarURL({ size: 256, extension: "png" });
            if (url && url.startsWith("http")) return url;
          }
          const hash = user.avatar;
          if (hash && !hash.startsWith("http")) {
            const ext = hash.startsWith("a_") ? "gif" : "png";
            return `https://cdn.discordapp.com/avatars/${user.id}/${hash}.${ext}?size=256`;
          }
          if (hash && hash.startsWith("http")) return hash;
          const defaultIndex = Number(BigInt(user.id) >> 22n) % 6;
          return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
        } catch {
          return "https://cdn.discordapp.com/embed/avatars/0.png";
        }
      })();

      const [premium, bl] = await Promise.all([
        PremiumUser.findOne({ id: q }).lean(),
        Blacklist.findOne({ userId: q }).lean(),
      ]);

      results.user = {
        id:              user.id,
        username:        user.username ?? "Unknown",
        discriminator:   user.discriminator ?? "0",
        avatar:          safeAvatar,
        bot:             user.bot ?? false,
        createdAt:       user.createdAt,
        isPremium:       premium?.isPremium ?? false,
        premiumPlan:     premium?.premium?.plan ?? null,
        premiumExpiry:   premium?.premium?.expiresAt ?? null,
        isBlacklisted:   !!bl,
        blacklistReason: bl?.reason ?? null,
      };
    }
  } catch {}

  const guild = req.client.guilds.cache.get(q);
  if (guild) {
    const [gPrem, gBl] = await Promise.all([
      PremiumGuild.findOne({ id: q }).lean(),
      ServerBlacklist.findOne({ serverId: q }).lean(),
    ]);
    results.guild = {
      id:              guild.id,
      name:            guild.name,
      memberCount:     guild.memberCount,
      ownerId:         guild.ownerId,
      createdAt:       guild.createdAt,
      icon:            guild.iconURL({ size: 256 }),
      isPremium:       gPrem?.isPremiumGuild ?? false,
      premiumPlan:     gPrem?.premium?.plan  ?? null,
      premiumExpiry:   gPrem?.premium?.expiresAt ?? null,
      isBlacklisted:   !!gBl,
      blacklistReason: gBl?.reason ?? null,
    };
  }

  if (!results.user && !results.guild) {
    return res.status(404).json({ error: "No user or guild found with that ID" });
  }

  res.json(results);
});

/* ─────────────────────────────────────────────
   CHANGELOG PUBLISHER
───────────────────────────────────────────── */

router.get("/api-dev/changelogs", ...secureDevApi, async (req, res) => {
  try {
    const entries = await Changelogs.find().sort({ date: -1 }).limit(20).lean();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/changelog", ...secureDevApi, async (req, res) => {
  const { title, description, footer, color, type } = req.body;
  if (!description || description.trim().length === 0) {
    return res.status(400).json({ error: "Description is required" });
  }
  function isValidHex(s) { return /^#[0-9A-Fa-f]{6}$/.test(s); }
  try {
    const entry = await Changelogs.create({
      date: new Date(),
      config: {
        title:       title?.trim()     || null,
        description: description.trim(),
        footer:      footer?.trim()    || null,
        color:       isValidHex(color) ? color : null,
        type:        type?.trim()      || null,
      },
    });
    console.log(`[DEV] Changelog published by ${req.user?.username}: "${title || "Untitled"}"`);
    res.json({ success: true, id: entry._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/api-dev/changelog/:id", ...secureDevApi, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: "Invalid ID" });
  try {
    await Changelogs.findByIdAndDelete(id);
    console.log(`[DEV] Changelog ${id} deleted by ${req.user?.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/api-dev/changelog/:id", ...secureDevApi, async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: "Invalid ID" });
  const { title, description, footer, color, type } = req.body;
  if (!description || description.trim().length === 0) {
    return res.status(400).json({ error: "Description is required" });
  }
  function isValidHex(s) { return /^#[0-9A-Fa-f]{6}$/.test(s); }
  try {
    const entry = await Changelogs.findByIdAndUpdate(
      id,
      { $set: {
        "config.title":       title?.trim()     || null,
        "config.description": description.trim(),
        "config.footer":      footer?.trim()    || null,
        "config.color":       isValidHex(color) ? color : null,
        "config.type":        type?.trim()      || null,
      }},
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: "Changelog not found" });
    console.log(`[DEV] Changelog ${id} edited by ${req.user?.username}`);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;