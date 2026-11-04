"use strict";

const router = require("express").Router();
const path   = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { SuggestionConfig } = require("../../../Schemas/suggestionSchema");

// ── Page ──────────────────────────────────────────────────────────────────────
router.get("/guild/:id/suggestions", isAuth, checkDashboardAccess('suggestion'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/suggestion.html"))
);

// ── GET config ────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/suggestions", isAuth, checkDashboardAccess('suggestion'), async (req, res) => {
  try {
    const data = await SuggestionConfig.findOne({ guildId: req.params.id }).lean();
    res.json(data || {});
  } catch (e) {
    res.status(500).json({ error: "Failed to load config" });
  }
});

// ── POST config ───────────────────────────────────────────────────────────────
router.post("/api/guild/:id/suggestions", isAuth, checkDashboardAccess('suggestion'), async (req, res) => {
  try {
    const b = req.body;

    // Helpers for safe field extraction
    const str  = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const bool = (v, def = false) => (typeof v === "boolean" ? v : def);
    const num  = (v, def = 0) => { const n = parseInt(v); return isNaN(n) || n < 0 ? def : n; };
    const ids  = (v) => Array.isArray(v) ? v.filter(x => typeof x === "string" && /^\d{17,20}$/.test(x)) : [];

    const update = {
      guildId:              req.params.id,

      // Channels
      channelId:            str(b.channelId),
      reviewChannelId:      str(b.reviewChannelId),
      approvedChannelId:    str(b.approvedChannelId),
      rejectedChannelId:    str(b.rejectedChannelId),
      logChannelId:         str(b.logChannelId),

      // Roles
      staffRoleIds:         ids(b.staffRoleIds),
      requiredRoleIds:      ids(b.requiredRoleIds),
      blockedRoleIds:       ids(b.blockedRoleIds),
      pingRoleId:           str(b.pingRoleId),

      // Toggles
      reviewMode:           bool(b.reviewMode),
      threadOnSuggest:      bool(b.threadOnSuggest),
      dmOnResult:           bool(b.dmOnResult, true),
      allowEdit:            bool(b.allowEdit),
      requireReason:        bool(b.requireReason),
      anonymousMode:        bool(b.anonymousMode),
      selfVoteAllowed:      bool(b.selfVoteAllowed),
      allowVoteChange:      bool(b.allowVoteChange, true),

      // Limits
      minLength:            num(b.minLength),
      maxLength:            Math.min(1024, Math.max(1, num(b.maxLength, 1024))),
      cooldownSeconds:      num(b.cooldownSeconds),
      maxActiveSuggestions: num(b.maxActiveSuggestions),

      // Auto actions
      autoApproveUpvotes:   num(b.autoApproveUpvotes),
      autoRejectDownvotes:  num(b.autoRejectDownvotes),
      autoCloseHours:       num(b.autoCloseHours),
    };

    await SuggestionConfig.findOneAndUpdate(
      { guildId: req.params.id },
      { $set: update },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (e) {
    console.error("[suggestions/dashboard] save error:", e);
    res.status(500).json({ error: "Failed to save config" });
  }
});

// ── DELETE / disable ──────────────────────────────────────────────────────────
router.delete("/api/guild/:id/suggestions", isAuth, checkDashboardAccess('suggestion'), async (req, res) => {
  try {
    await SuggestionConfig.deleteOne({ guildId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;