"use strict";

const router   = require("express").Router();
const path     = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require("../../middleware");
const WarnModel = require("../../../Schemas/warnSchema");

// ── Page ──────────────────────────────────────────────────────────────────────
router.get("/guild/:id/modlogs", isAuth, checkDashboardAccess("modlogs"), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/modlogs.html"))
);

// ── GET all warnings for guild ────────────────────────────────────────────────
router.get("/api/guild/:id/modlogs", isAuth, checkDashboardAccess("modlogs"), async (req, res) => {
  try {
    const data = await WarnModel.find({ GuildID: req.params.id })
      .sort({ "Content.Timestamp": -1 })
      .lean();
    res.json(data);
  } catch (e) {
    console.error("[modlogs] GET error:", e);
    res.status(500).json({ error: "Failed to load moderation logs" });
  }
});

// ── GET warnings for a specific user ─────────────────────────────────────────
router.get("/api/guild/:id/modlogs/:userId", isAuth, checkDashboardAccess("modlogs"), async (req, res) => {
  try {
    const data = await WarnModel.findOne({
      GuildID: req.params.id,
      UserID:  req.params.userId,
    }).lean();
    res.json(data || null);
  } catch (e) {
    res.status(500).json({ error: "Failed to load user logs" });
  }
});

// ── POST pardon a single warning by case number ───────────────────────────────
router.post("/api/guild/:id/modlogs/:userId/pardon", isAuth, checkDashboardAccess("modlogs"), async (req, res) => {
  try {
    const { caseNumber } = req.body;
    if (!caseNumber || typeof caseNumber !== "string") {
      return res.status(400).json({ error: "caseNumber is required" });
    }

    const result = await WarnModel.updateOne(
      {
        GuildID: req.params.id,
        UserID:  req.params.userId,
        "Content.CaseNumber": caseNumber,
      },
      { $set: { "Content.$.Active": false } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Warning not found" });
    }

    res.json({ success: true });
  } catch (e) {
    console.error("[modlogs] pardon error:", e);
    res.status(500).json({ error: "Failed to pardon warning" });
  }
});

// ── DELETE all warnings for a user ───────────────────────────────────────────
router.delete("/api/guild/:id/modlogs/:userId", isAuth, checkDashboardAccess("modlogs"), async (req, res) => {
  try {
    await WarnModel.deleteOne({ GuildID: req.params.id, UserID: req.params.userId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to clear warnings" });
  }
});

module.exports = router;
