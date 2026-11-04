"use strict";

const router  = require("express").Router();
const path    = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require("../../middleware");
const JoinPing = require("../../../Schemas/joinping");

// ── Page ──────────────────────────────────────────────────────────────────────
router.get("/guild/:id/joinping", isAuth, checkDashboardAccess("joinping"), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/joinping.html"))
);

// ── GET config ────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/joinping", isAuth, checkDashboardAccess("joinping"), async (req, res) => {
  try {
    const data = await JoinPing.findOne({ Guild: req.params.id }).lean();
    res.json(data || { Guild: req.params.id, Channel: [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to load config" });
  }
});

// ── POST config (save / add channel) ─────────────────────────────────────────
router.post("/api/guild/:id/joinping", isAuth, checkDashboardAccess("joinping"), async (req, res) => {
  try {
    const channels = Array.isArray(req.body.channels)
      ? req.body.channels.filter(c => typeof c === "string" && /^\d{17,20}$/.test(c.trim())).map(c => c.trim())
      : [];

    await JoinPing.findOneAndUpdate(
      { Guild: req.params.id },
      { $set: { Guild: req.params.id, Channel: channels } },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to save config" });
  }
});

// ── DELETE single channel ─────────────────────────────────────────────────────
router.delete("/api/guild/:id/joinping/:channelId", isAuth, checkDashboardAccess("joinping"), async (req, res) => {
  try {
    const channelId = req.params.channelId;
    if (!/^\d{17,20}$/.test(channelId)) return res.status(400).json({ error: "Invalid channel ID" });

    await JoinPing.findOneAndUpdate(
      { Guild: req.params.id },
      { $pull: { Channel: channelId } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to remove channel" });
  }
});

module.exports = router;
