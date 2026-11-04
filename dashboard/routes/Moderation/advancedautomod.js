const router = require("express").Router();
const path   = require("path");
const { isAuth, sendHTMLWithNonce, tierRequired, checkDashboardAccess } = require('../../middleware');
const AutoMod = require("../../../Schemas/AutoModSchema");

// ─── Valid sets ───────────────────────────────────────────────────────────────

const VALID_ACTIONS    = new Set(['warn', 'delete', 'mute', 'kick', 'ban']);
const VALID_RATE_TYPES = new Set([
  'messages', 'mentions', 'links', 'caps',
  'duplicates', 'attachments', 'emojis', 'newlines',
]);

// ─── Sanitisers ───────────────────────────────────────────────────────────────

function sanitiseRateRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(r => VALID_RATE_TYPES.has(r?.type) && VALID_ACTIONS.has(r?.action))
    .map(r => ({
      type:              String(r.type),
      limit:             Math.max(1, Number(r.limit)        || 1),
      window:            Math.max(0, Number(r.window)       || 0),
      action:            String(r.action),
      muteDuration:      Math.max(1, Number(r.muteDuration) || 10),
      exemptRoleIds:     Array.isArray(r.exemptRoleIds)    ? r.exemptRoleIds.filter(x => typeof x === 'string' && x.trim()).slice(0, 50)    : [],
      exemptRoleMode:    ['excluded','included'].includes(r.exemptRoleMode)    ? r.exemptRoleMode    : 'excluded',
      exemptChannelIds:  Array.isArray(r.exemptChannelIds) ? r.exemptChannelIds.filter(x => typeof x === 'string' && x.trim()).slice(0, 50) : [],
      exemptChannelMode: ['excluded','included'].includes(r.exemptChannelMode) ? r.exemptChannelMode : 'excluded',
    }));
}

function sanitiseWarnSteps(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(s => VALID_ACTIONS.has(s?.action) && Number(s?.count) > 0)
    .map(s => ({
      count:        Number(s.count),
      action:       String(s.action),
      note:         String(s.note || '').slice(0, 100),
      muteDuration: Math.max(1, Number(s.muteDuration) || 10),
    }))
    .sort((a, b) => a.count - b.count);
}

function sanitiseBannedWords(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(w => typeof w === 'string' && w.trim())
    .map(w => w.trim().toLowerCase().slice(0, 200))
    .slice(0, 500);
}

function sanitiseWordGroups(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(g => typeof g?.name === 'string' && g.name.trim())
    .map(g => ({
      name:         String(g.name).trim().slice(0, 50),
      words:        Array.isArray(g.words)
        ? g.words.filter(w => typeof w === 'string' && w.trim())
            .map(w => w.trim().toLowerCase().slice(0, 200))
            .slice(0, 500)
        : [],
      matchMode:    ['wildcard', 'exact'].includes(g.matchMode) ? g.matchMode : 'wildcard',
      action:       VALID_ACTIONS.has(g.action) ? String(g.action) : 'delete',
      muteDuration: Math.max(1, Number(g.muteDuration) || 10),
    }))
    .slice(0, 50);
}

function sanitiseLinkGroups(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(g => typeof g?.name === 'string' && g.name.trim())
    .map(g => ({
      name:         String(g.name).trim().slice(0, 50),
      mode:         ['blacklist', 'whitelist'].includes(g.mode) ? g.mode : 'blacklist',
      domains:      Array.isArray(g.domains)
        ? g.domains.filter(d => typeof d === 'string' && d.trim())
            .map(d => d.trim().toLowerCase().slice(0, 200))
            .slice(0, 200)
        : [],
      action:       VALID_ACTIONS.has(g.action) ? String(g.action) : 'delete',
      muteDuration: Math.max(1, Number(g.muteDuration) || 10),
    }))
    .slice(0, 25);
}

function sanitiseRegexRules(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = [];
  for (const r of raw) {
    if (typeof r?.pattern !== 'string' || !r.pattern.trim()) continue;
    if (!VALID_ACTIONS.has(r?.action)) continue;
    try { new RegExp(r.pattern, r.flags || 'i'); } catch { continue; }
    valid.push({
      pattern:      r.pattern.trim().slice(0, 500),
      flags:        String(r.flags || 'i').replace(/[^gimsuy]/g, '').slice(0, 6),
      description:  String(r.description || '').slice(0, 200),
      action:       String(r.action),
      muteDuration: Math.max(1, Number(r.muteDuration) || 10),
    });
    if (valid.length >= 50) break;
  }
  return valid;
}

function clampAction(val, fallback = 'delete') {
  return VALID_ACTIONS.has(val) ? String(val) : fallback;
}

function clampNum(val, min = 1, max = Infinity, def = 10) {
  const n = Number(val);
  if (!isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Page
router.get(
  "/guild/:id/advanced-automod",
  isAuth, checkDashboardAccess('antispam'), tierRequired('basic'),
  (req, res) =>
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/advancedautomod.html"))
);

// Legacy redirect
router.get(
  "/guild/:id/antispam",
  isAuth, checkDashboardAccess('antispam'), tierRequired('basic'),
  (req, res) => res.redirect(301, `/guild/${req.params.id}/advanced-automod`)
);

// GET config
router.get(
  "/api/guild/:id/advanced-automod",
  isAuth, checkDashboardAccess('antispam'), tierRequired('basic'),
  async (req, res) => {
    try {
      const config = await AutoMod.findOne({ guildId: req.params.id })
        || await AutoMod.create({ guildId: req.params.id });
      res.json(config);
    } catch (err) {
      console.error("GET advanced-automod error:", err);
      res.status(500).json({ error: "Failed to load AutoMod config" });
    }
  }
);

// Legacy API compat
router.get(
  "/api/guild/:id/antispam",
  isAuth, checkDashboardAccess('antispam'), tierRequired('basic'),
  async (req, res) => {
    try {
      const config = await AutoMod.findOne({ guildId: req.params.id })
        || await AutoMod.create({ guildId: req.params.id });
      res.json(config);
    } catch (err) {
      res.status(500).json({ error: "Failed to load config" });
    }
  }
);

// POST save
router.post(
  "/api/guild/:id/advanced-automod",
  isAuth, checkDashboardAccess('antispam'), tierRequired('basic'),
  async (req, res) => {
    try {
      const b = req.body;

      const update = {
        // ── Global ──────────────────────────────────────────────────────────
        status:        Boolean(b.status),
        detectBotSpam: Boolean(b.detectBotSpam),
        logChannelId:  typeof b.logChannelId === 'string' && b.logChannelId ? b.logChannelId : null,

        // ── Rate limits / escalation / word/link/regex ───────────────────
        rateRules:  sanitiseRateRules(b.rateRules),
        warnSteps:  sanitiseWarnSteps(b.warnSteps),
        wordGroups: sanitiseWordGroups(b.wordGroups),
        linkGroups: sanitiseLinkGroups(b.linkGroups),
        regexRules: sanitiseRegexRules(b.regexRules),

        // ── Legacy single-list banned words (keep for backward compat) ───
        bannedWords:      sanitiseBannedWords(b.bannedWords),
        wordFilterAction: clampAction(b.wordFilterAction, 'delete'),
        wordMuteDuration: clampNum(b.wordMuteDuration, 1, 10080, 10),
        wordWildcard:     Boolean(b.wordWildcard),

        // ── Invites ─────────────────────────────────────────────────────
        filterInvites:      Boolean(b.filterInvites),
        inviteAction:       clampAction(b.inviteAction, 'delete'),
        inviteMuteDuration: clampNum(b.inviteMuteDuration, 1, 10080, 10),
        allowOwnInvites:    b.allowOwnInvites !== false,
        extraInviteDomains: Array.isArray(b.extraInviteDomains)
          ? b.extraInviteDomains.filter(d => typeof d === 'string' && d.trim()).map(d => d.trim().toLowerCase()).slice(0, 20)
          : [],

        // ── Zalgo ────────────────────────────────────────────────────────
        filterZalgo:       Boolean(b.filterZalgo),
        zalgoAction:       clampAction(b.zalgoAction, 'delete'),
        zalgoMuteDuration: clampNum(b.zalgoMuteDuration, 1, 10080, 10),
        zalgoThreshold:    Math.min(1, Math.max(0, Number(b.zalgoThreshold) || 0.20)),

        // ── Mass mention ─────────────────────────────────────────────────
        filterMassMention:       Boolean(b.filterMassMention),
        massMentionAction:       clampAction(b.massMentionAction, 'delete'),
        massMentionMuteDuration: clampNum(b.massMentionMuteDuration, 1, 10080, 10),

        // ── Repeat characters ─────────────────────────────────────────────
        filterRepeatChar:       Boolean(b.filterRepeatChar),
        repeatCharLimit:        clampNum(b.repeatCharLimit, 3, 500, 10),
        repeatCharAction:       clampAction(b.repeatCharAction, 'delete'),
        repeatCharMuteDuration: clampNum(b.repeatCharMuteDuration, 1, 10080, 10),

        // ── Stickers ─────────────────────────────────────────────────────
        filterStickers:      Boolean(b.filterStickers),
        stickerLimit:        clampNum(b.stickerLimit, 1, 50, 2),
        stickerAction:       clampAction(b.stickerAction, 'delete'),
        stickerMuteDuration: clampNum(b.stickerMuteDuration, 1, 10080, 10),

        // ── Spoilers ─────────────────────────────────────────────────────
        filterSpoilers:      Boolean(b.filterSpoilers),
        spoilerLimit:        clampNum(b.spoilerLimit, 1, 50, 5),
        spoilerAction:       clampAction(b.spoilerAction, 'delete'),
        spoilerMuteDuration: clampNum(b.spoilerMuteDuration, 1, 10080, 10),
      };

      await AutoMod.findOneAndUpdate(
        { guildId: req.params.id },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.json({ success: true });
    } catch (err) {
      console.error("POST advanced-automod error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// Legacy POST compat
router.post(
  "/api/guild/:id/antispam",
  isAuth, checkDashboardAccess('antispam'), tierRequired('basic'),
  (req, res, next) => {
    req.url = req.url.replace('/antispam', '/advanced-automod');
    next();
  }
);

module.exports = router;