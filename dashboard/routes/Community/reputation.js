"use strict";

const router     = require("express").Router();
const path       = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require("../../middleware");
const Reputation = require("../../../Schemas/Reputation");

// ── Page ──────────────────────────────────────────────────────────────────────
router.get("/guild/:id/reputation", isAuth, checkDashboardAccess("reputation"), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/reputation.html"))
);

// ── GET full leaderboard (global rep, filtered by query if desired) ────────────
// Reputation is global (not per-guild) but we expose it per-guild dashboard for
// convenience — returns all users sorted by reps desc, limit 500.
router.get("/api/guild/:id/reputation", isAuth, checkDashboardAccess("reputation"), async (req, res) => {
  try {
    const data = await Reputation.find({})
      .sort({ reps: -1 })
      .limit(500)
      .lean();
    res.json(data);
  } catch (e) {
    console.error("[reputation] GET error:", e);
    res.status(500).json({ error: "Failed to load reputation data" });
  }
});

// ── GET single user ───────────────────────────────────────────────────────────
router.get("/api/guild/:id/reputation/:userId", isAuth, checkDashboardAccess("reputation"), async (req, res) => {
  try {
    const data = await Reputation.findOne({ userId: req.params.userId }).lean();
    res.json(data || null);
  } catch (e) {
    res.status(500).json({ error: "Failed to load user reputation" });
  }
});

// ── PATCH update a user's rep ─────────────────────────────────────────────────
router.patch("/api/guild/:id/reputation/:userId", isAuth, checkDashboardAccess("reputation"), async (req, res) => {
  try {
    const reps = parseInt(req.body.reps);
    if (isNaN(reps) || reps < 0) return res.status(400).json({ error: "Invalid rep value" });

    const result = await Reputation.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: { reps } },
      { new: true }
    );
    if (!result) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, reps: result.reps });
  } catch (e) {
    console.error("[reputation] PATCH error:", e);
    res.status(500).json({ error: "Failed to update reputation" });
  }
});

// ── DELETE reset a user's rep ─────────────────────────────────────────────────
router.delete("/api/guild/:id/reputation/:userId", isAuth, checkDashboardAccess("reputation"), async (req, res) => {
  try {
    await Reputation.deleteOne({ userId: req.params.userId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete reputation" });
  }
});

module.exports = router;
