const router = require("express").Router();
const { isAuth, refreshUserGuilds } = require("../../middleware");
const { RequestLog, ExcludedUser } = require("../../../Schemas/requestlogs");

// ── Per-user rate limiter for server exports ────────────────────────────────
const EXPORT_COOLDOWN_MS = 60_000;
const exportCooldowns = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of exportCooldowns) {
    if (now - ts > EXPORT_COOLDOWN_MS * 2) exportCooldowns.delete(uid);
  }
}, 300_000); // sweep stale entries every 5 minutes

// ── IP Verification data rate limiter ───────────────────────────────────────
const IPV_COOLDOWN_MS = 60_000;
const ipvCooldowns = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of ipvCooldowns) {
    if (now - ts > IPV_COOLDOWN_MS * 2) ipvCooldowns.delete(uid);
  }
}, 300_000);

const VerificationRecord  = require("../../../Schemas/VerificationRecord");
const VerifyConfig        = require("../../../Schemas/verificationSchema");
const { decrypt, hmac }   = require("../../lib/verifyEncryption");
const { apiPost }         = require("../../lib/botClient");

const WelcomeMessage    = require("../../../Schemas/welcomeMessageSchema");
const GoodbyeMessage    = require("../../../Schemas/goodbyeMessageSchema");
const Antinuke          = require("../../../Schemas/antinukeSchema");
const AntiScam          = require("../../../Schemas/antiscam");
const AutoRole          = require("../../../Schemas/autorole");
const Autoresponder     = require("../../../Schemas/Autoresponder");
const AIConfig          = require("../../../Schemas/aiSchema");
const ConfessionConfig  = require("../../../Schemas/confession");
const Count             = require("../../../Schemas/counting");
const GuildInviteConfig = require("../../../Schemas/guildInviteConfig");
const JTCConfig         = require("../../../Schemas/jointocreate");
const LevelSetup        = require("../../../Schemas/levelsetup");
const LevelRole         = require("../../../Schemas/levelRoleSchema");
const LogSchema         = require("../../../Schemas/logschema");
const MassJoin          = require("../../../Schemas/AntiRaidSchema");
const ReactionRole      = require("../../../Schemas/reactionrole");
const StickySchema      = require("../../../Schemas/stickySchema");
const TicketSetup       = require("../../../Schemas/TicketSetup");
const Transcript        = require("../../../Schemas/transcript");
const Uptime            = require("../../../Schemas/uptimeSchema");
const Verify            = require("../../../Schemas/verificationSchema");
const YouTubeNotif      = require("../../../Schemas/youtubeSchema");
const TwitchNotif       = require("../../../Schemas/twitchSchema");
const db247             = require("../../../Schemas/247");
const MemberStats       = require("../../../Schemas/memberStats");
const SuggestionConfig  = require("../../../Schemas/suggestionSchema");

const GUILD_FETCHERS = {
  welcome:       (id) => WelcomeMessage.findOne({ guildId: id }),
  goodbye:       (id) => GoodbyeMessage.findOne({ guildId: id }),
  antinuke:      (id) => Antinuke.findOne({ guildId: id }),
  antiscam:      (id) => AntiScam.findOne({ guildId: id }),
  autorole:      (id) => AutoRole.findOne({ GuildID: id }),
  autoresponder: (id) => Autoresponder.find({ guildId: id }),
  ai:            (id) => AIConfig.findOne({ guildId: id }),
  confession:    (id) => ConfessionConfig.findOne({ Guild: id }),
  counting:      (id) => Count.findOne({ Guild: id }),
  invite:        (id) => GuildInviteConfig.findOne({ guildId: id }),
  jtc:           (id) => JTCConfig.findOne({ Guild: id }),
  leveling:      (id) => Promise.all([
                    LevelSetup.findOne({ Guild: id }),
                    LevelRole.findOne({ GuildID: id }),
                  ]).then(([config, rewards]) => ({ config, rewards })),
  logs:          (id) => LogSchema.findOne({ Guild: id }),
  massjoin:      (id) => MassJoin.findOne({ guildId: id }),
  reactionroles: (id) => ReactionRole.find({ Guild: id }),
  sticky:        (id) => StickySchema.find({ Guild: id }),
  ticket:        (id) => Promise.all([
                    TicketSetup.findOne({ GuildID: id }),
                    Transcript.find({ GuildID: id })
                      .select("TicketID ChannelName OpenedBy ClosedBy ClosedAt")
                      .sort({ ClosedAt: -1 }),
                  ]).then(([setup, transcripts]) => ({ setup, transcripts })),
  uptime:        (id) => Uptime.find({ Guild: id }),
  verify:        (id) => Verify.findOne({ Guild: id }),
  youtube:       (id) => YouTubeNotif.find({ Guild: id }),
  twitch:        (id) => TwitchNotif.find({ Guild: id }),
  "247":         (id) => db247.findOne({ _id: id }),
  stats:         (id) => MemberStats.find({ GuildID: id }).sort({ Date: 1 }).limit(30),
  suggestions:   (id) => SuggestionConfig.findOne({ guildId: id }),
};

function hasManageGuild(guilds, guildId) {
  return (guilds || []).some(g => {
    if (g.id !== guildId) return false;
    const permValue = BigInt(g.permissions || 0);
    return (permValue & 0x20n) === 0x20n;
  });
}

function cleanSensitiveData(settings) {
  if (!settings || typeof settings !== 'object') return;

  if (settings.counting && typeof settings.counting.WebhookURL === 'string') {
    settings.counting.WebhookURL = '[REDACTED]';
  }

  if (settings.invite?.webhookWelcome) {
    if (settings.invite.webhookWelcome.webhookToken) settings.invite.webhookWelcome.webhookToken = '[REDACTED]';
    if (settings.invite.webhookWelcome.webhookId) settings.invite.webhookWelcome.webhookId = '[REDACTED]';
  }

  if (settings.verify && typeof settings.verify.webhookUrl === 'string') {
    settings.verify.webhookUrl = '[REDACTED]';
  }

  if (Array.isArray(settings.uptime)) {
    for (const entry of settings.uptime) {
      if (typeof entry.URL === 'string' && /\/\/[^:]*:[^@]*@/.test(entry.URL)) {
        entry.URL = entry.URL.replace(/\/\/[^:]*:[^@]*@/, '//[REDACTED]:[REDACTED]@');
      }
    }
  }

  if (settings.ticket?.transcripts) {
    for (const t of settings.ticket.transcripts) {
      if (t.OpenedBy) t.OpenedBy = '[REDACTED]';
      if (t.ClosedBy) t.ClosedBy = '[REDACTED]';
    }
  }
}

router.get("/api/gdpr/status", isAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const excluded = await ExcludedUser.findOne({ userId });
    const logCount = await RequestLog.countDocuments({ userId });
    res.json({
      optedOut: !!excluded,
      logCount,
      timestamp: excluded?.timestamp || null,
    });
  } catch (err) {
    console.error("[GDPR] status error:", err);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

router.post("/api/gdpr/delete-logs", isAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await RequestLog.deleteMany({ userId });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error("[GDPR] delete-logs error:", err);
    res.status(500).json({ error: "Failed to delete logs" });
  }
});

router.post("/api/gdpr/opt-out", isAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await ExcludedUser.findOneAndUpdate({ userId }, { userId, timestamp: new Date() }, { upsert: true });
    if (req.client && !req.client.blockedLogs) req.client.blockedLogs = new Set();
    req.client?.blockedLogs?.add(userId);
    res.json({ optedOut: true });
  } catch (err) {
    console.error("[GDPR] opt-out error:", err);
    res.status(500).json({ error: "Failed to opt out" });
  }
});

router.get("/api/gdpr/export", isAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const logs = await RequestLog.find({ userId }).sort({ timestamp: -1 }).select('+ip').lean();
    for (const log of logs) {
      if (log.ip && log.ip.includes(':')) {
        try {
          const key = process.env.IP_ENCRYPT_KEY;
          if (key && key.length === 64) {
            const crypto = require('crypto');
            const [ivHex, authTagHex, ...rest] = log.ip.split(':');
            const ctHex = rest.join(':');
            const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
            log.ip = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
          }
        } catch {}
      }
    }
    res.json({
      exportedAt: new Date().toISOString(),
      userId,
      logCount: logs.length,
      logs,
    });
  } catch (err) {
    console.error("[GDPR] export error:", err);
    res.status(500).json({ error: "Failed to export data" });
  }
});

router.post("/api/gdpr/opt-in", isAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await ExcludedUser.deleteOne({ userId });
    req.client?.blockedLogs?.delete(userId);
    res.json({ optedOut: false });
  } catch (err) {
    console.error("[GDPR] opt-in error:", err);
    res.status(500).json({ error: "Failed to opt in" });
  }
});

router.get("/api/gdpr/servers", isAuth, async (req, res) => {
  try {
    if (req.user.accessToken) {
      try { await refreshUserGuilds(req); } catch (_) {}
    }
    const servers = (req.user.guilds || [])
      .filter(g => {
        if (!g.id || !/^\d{17,20}$/.test(g.id)) return false;
        const permValue = BigInt(g.permissions || 0);
        return (permValue & 0x20n) === 0x20n;
      })
      .map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(servers);
  } catch (err) {
    console.error("[GDPR] servers error:", err);
    res.status(500).json({ error: "Failed to fetch servers" });
  }
});

router.get("/api/gdpr/export-server/:guildId", isAuth, async (req, res) => {
  try {
    const guildId = req.params.guildId;
    if (!guildId || !/^\d{17,20}$/.test(guildId)) {
      return res.status(400).json({ error: "Invalid guild ID" });
    }

    const lastExport = exportCooldowns.get(req.user.id);
    if (lastExport && Date.now() - lastExport < EXPORT_COOLDOWN_MS) {
      const retryAfter = Math.ceil((EXPORT_COOLDOWN_MS - (Date.now() - lastExport)) / 1000);
      return res.status(429).json({ error: `Too many requests. Try again in ${retryAfter} seconds.` });
    }

    if (req.user.accessToken) {
      try { await refreshUserGuilds(req); } catch (_) {}
    }
    if (!hasManageGuild(req.user.guilds, guildId)) {
      return res.status(403).json({ error: "You do not have access to this server" });
    }

    const results = {};
    const entries = Object.entries(GUILD_FETCHERS);
    for (const [key, fetcher] of entries) {
      try {
        const data = await fetcher(guildId);
        if (data !== null && !(Array.isArray(data) && data.length === 0)) {
          results[key] = JSON.parse(JSON.stringify(data));
        }
      } catch (_) {}
    }

    cleanSensitiveData(results);
    exportCooldowns.set(req.user.id, Date.now());

    res.json({
      guildId,
      exportedAt: new Date().toISOString(),
      settings: results,
    });
  } catch (err) {
    console.error("[GDPR] export-server error:", err);
    res.status(500).json({ error: "Failed to export server data" });
  }
});

// ── IP Verification Data ─────────────────────────────────────────────────────

router.get("/api/gdpr/ipverify/status", isAuth, async (req, res) => {
  try {
    const userIdHmac = hmac(req.user.id);
    const records = await VerificationRecord.find({ userIdHmac });
    const guildCount = records.reduce((sum, r) => sum + r.guilds.length, 0);
    res.json({ recordCount: records.length, guildCount });
  } catch (err) {
    console.error("[GDPR] ipverify status error:", err);
    res.status(500).json({ error: "Failed to fetch IP verification status" });
  }
});

router.post("/api/gdpr/ipverify/delete", isAuth, async (req, res) => {
  try {
    const lastOp = ipvCooldowns.get(req.user.id);
    if (lastOp && Date.now() - lastOp < IPV_COOLDOWN_MS) {
      const retryAfter = Math.ceil((IPV_COOLDOWN_MS - (Date.now() - lastOp)) / 1000);
      return res.status(429).json({ error: `Too many requests. Try again in ${retryAfter} seconds.` });
    }

    const userId      = req.user.id;
    const userIdHmac  = hmac(userId);

    const records = await VerificationRecord.find({ userIdHmac });

    // Build HMAC→guildId map from all verify configs (fallback when both
    // guildIdEnc decryption AND plaintext guildId are unavailable)
    const allConfigs = await VerifyConfig.find({}, { Guild: 1 }).lean();
    const hmacToGuildId = {};
    for (const cfg of allConfigs) {
      if (cfg.Guild) hmacToGuildId[hmac(cfg.Guild)] = cfg.Guild;
    }

    // Collect unique guild IDs where user was verified (PASSED or MANUAL_APPROVE)
    const verifiedGuilds = new Set();
    for (const record of records) {
      for (const guildEntry of record.guilds || []) {
        if (!['PASSED', 'MANUAL_APPROVE'].includes(guildEntry.action)) continue;

        // 1st fallback: decrypt guildIdEnc
        let guildId = null;
        if (guildEntry.guildIdEnc) {
          try { guildId = decrypt(guildEntry.guildIdEnc); } catch {}
        }

        // 2nd fallback: plaintext guildId
        if (!guildId) guildId = guildEntry.guildId;

        // 3rd fallback: reverse-lookup via guildIdHmac from verify configs
        if (!guildId && guildEntry.guildIdHmac) {
          guildId = hmacToGuildId[guildEntry.guildIdHmac] || null;
        }

        if (guildId) verifiedGuilds.add(guildId);
      }
    }

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // ── Phase 1: Delete records (GDPR right — always honored) ───────────────
    const deleteResult = records.length > 0
      ? await VerificationRecord.deleteMany({ userIdHmac })
      : { deletedCount: 0 };

    // ── Phase 2: Best-effort unverify (Discord errors don't block deletion) ─
    // Discord API errors (Missing Permissions, role hierarchy, etc.) are
    // expected operational issues — they shouldn't block the user's right to
    // have their data deleted. Connection errors (bot offline) are also
    // non-blocking; the user can retry later.
    const guildList = [...verifiedGuilds];
    const unverifyResults = [];

    for (let gi = 0; gi < guildList.length; gi++) {
      const guildId = guildList[gi];
      if (gi > 0) await delay(750);

      const gResult = { guildId, errors: [] };

      try {
        const config = await VerifyConfig.findOne({ Guild: guildId });
        if (config) {
          if (config.Role) {
            try {
              await apiPost(`/internal/guild/${guildId}/member/${userId}/roles/remove`, { roleId: config.Role });
              await delay(350);
            } catch (e) {
              gResult.errors.push(`remove-verified: ${e.message}`);
              console.warn(`[GDPR] User ${userId} — role removal failed in ${guildId}: ${e.message}`);
            }
          }
          if (config.additionalRoles) {
            const extras = config.additionalRoles.split(',').map(s => s.trim()).filter(Boolean);
            for (const roleId of extras) {
              try {
                await apiPost(`/internal/guild/${guildId}/member/${userId}/roles/remove`, { roleId });
                await delay(350);
              } catch (e) {
                gResult.errors.push(`remove-extra-${roleId}: ${e.message}`);
              }
            }
          }
          if (config.unverifiedRole) {
            try {
              await apiPost(`/internal/guild/${guildId}/member/${userId}/roles/add`, { roleId: config.unverifiedRole });
              await delay(350);
            } catch (e) {
              gResult.errors.push(`restore-unverified: ${e.message}`);
            }
          }
        } else {
          gResult.errors.push('verify-config-not-found');
        }
      } catch (err) {
        gResult.errors.push(`config-lookup: ${err.message}`);
      }

      unverifyResults.push(gResult);
    }

    ipvCooldowns.set(req.user.id, Date.now());

    const successCount = unverifyResults.filter(r => r.errors.length === 0).length;
    const failedResults = unverifyResults.filter(r => r.errors.length > 0);

    const errorsList = failedResults.map(r => ({ guildId: r.guildId, errors: r.errors }));
    if (errorsList.length) {
      console.warn(`[GDPR] User ${userId} — unverify errors: ${JSON.stringify(errorsList)}`);
    }
    console.log(`[GDPR] User ${userId} — deleted ${deleteResult.deletedCount} records, unverified from ${successCount}/${guildList.length} guild(s)`);

    res.json({
      deletedCount: deleteResult.deletedCount,
      unverifiedGuilds: successCount,
      totalGuilds: guildList.length,
      errors: errorsList,
    });
  } catch (err) {
    console.error("[GDPR] ipverify delete error:", err);
    res.status(500).json({ error: "Failed to delete IP verification data" });
  }
});

router.get("/api/gdpr/ipverify/export", isAuth, async (req, res) => {
  try {
    const cooldownKey = `export:${req.user.id}`;
    const lastOp = ipvCooldowns.get(cooldownKey);
    if (lastOp && Date.now() - lastOp < IPV_COOLDOWN_MS) {
      const retryAfter = Math.ceil((IPV_COOLDOWN_MS - (Date.now() - lastOp)) / 1000);
      return res.status(429).json({ error: `Too many requests. Try again in ${retryAfter} seconds.` });
    }

    const userId     = req.user.id;
    const userIdHmac = hmac(userId);

    const records = await VerificationRecord.find({ userIdHmac });

    const exportData = records.map(record => {
      let ip          = null;
      let decodedUser = null;
      let threatData  = null;
      try { ip          = decrypt(record.ipEnc);      } catch {}
      try { decodedUser = decrypt(record.userIdEnc);   } catch {}
      try { threatData  = record.threatEnc ? decrypt(record.threatEnc) : null; } catch {}

      return {
        ip,
        userId: decodedUser,
        threatData,
        firstSeen: record.firstSeen,
        lastSeen:  record.lastSeen,
        guilds: record.guilds.map(g => {
          let guildId = null;
          try { guildId = g.guildIdEnc ? decrypt(g.guildIdEnc) : null; } catch {}
          return {
            guildId,
            verifiedAt:  g.verifiedAt,
            action:      g.action,
            flagReasons: g.flagReasons,
          };
        }),
      };
    });

    ipvCooldowns.set(cooldownKey, Date.now());

    res.json({
      exportedAt:  new Date().toISOString(),
      userId,
      recordCount: records.length,
      records:     exportData,
    });
  } catch (err) {
    console.error("[GDPR] ipverify export error:", err);
    res.status(500).json({ error: "Failed to export IP verification data" });
  }
});

module.exports = router;
