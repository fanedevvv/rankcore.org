"use strict";

const router   = require("express").Router();
const path     = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require("../../middleware");
const PollModel = require("../../../Schemas/pollDiscord");

// ── Page ──────────────────────────────────────────────────────────────────────
router.get("/guild/:id/polls", isAuth, checkDashboardAccess("polls"), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/polls.html"))
);

// ── GET all polls for guild ───────────────────────────────────────────────────
router.get("/api/guild/:id/polls", isAuth, checkDashboardAccess("polls"), async (req, res) => {
  try {
    const polls = await PollModel.find({ Guild: req.params.id })
      .sort({ EndTs: -1 })
      .limit(100)
      .lean();
    res.json(polls);
  } catch (e) {
    console.error("[polls] GET error:", e);
    res.status(500).json({ error: "Failed to load polls" });
  }
});

// ── GET single poll ───────────────────────────────────────────────────────────
router.get("/api/guild/:id/polls/:messageId", isAuth, checkDashboardAccess("polls"), async (req, res) => {
  try {
    const poll = await PollModel.findOne({ Guild: req.params.id, Message: req.params.messageId }).lean();
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: "Failed to load poll" });
  }
});

// ── POST end a poll early (sets EndTs to now) ─────────────────────────────────
router.post("/api/guild/:id/polls/:messageId/end", isAuth, checkDashboardAccess("polls"), async (req, res) => {
  try {
    const result = await PollModel.findOneAndUpdate(
      { Guild: req.params.id, Message: req.params.messageId },
      { $set: { EndTs: Math.floor(Date.now() / 1000) } },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: "Poll not found" });
    res.json({ success: true });
  } catch (e) {
    console.error("[polls] end error:", e);
    res.status(500).json({ error: "Failed to end poll" });
  }
});

// ── DELETE a poll record ──────────────────────────────────────────────────────
router.delete("/api/guild/:id/polls/:messageId", isAuth, checkDashboardAccess("polls"), async (req, res) => {
  try {
    await PollModel.deleteOne({ Guild: req.params.id, Message: req.params.messageId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete poll" });
  }
});

module.exports = router;
