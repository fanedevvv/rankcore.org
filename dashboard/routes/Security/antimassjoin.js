const router = require("express").Router();
const path   = require("path");
const { isAuth, sendHTMLWithNonce, tierRequired, checkDashboardAccess } = require('../../middleware');
const AutoMod          = require("../../../Schemas/AutoModSchema");
const MassJoinProtection = require("../../../Schemas/AntiRaidSchema");

// ─── Mass Join ────────────────────────────────────────────────────────────────

router.get("/guild/:id/massjoin", isAuth, checkDashboardAccess('massjoin'), tierRequired("basic"), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/massjoin.html"))
);

router.get("/api/guild/:id/massjoin", isAuth, checkDashboardAccess('massjoin'), tierRequired("basic"), async (req, res) => {
  res.json(await MassJoinProtection.findOne({ guildId: req.params.id }) || {});
});

router.post("/api/guild/:id/massjoin/config", isAuth, checkDashboardAccess('massjoin'), tierRequired("basic"), async (req, res) => {
  try {
    const { threshold, interval, action, enabled } = req.body;
    await MassJoinProtection.findOneAndUpdate(
      { guildId: req.params.id },
      {
        $set: {
          guildId:   req.params.id,
          enabled:   Boolean(enabled),
          threshold: Math.max(1, Number(threshold) || 10),
          interval:  Math.max(1, Number(interval)  || 10),
          action:    ['kick','ban','lockdown'].includes(action) ? action : 'kick',
        },
      },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("POST massjoin error:", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

router.delete("/api/guild/:id/massjoin", isAuth, checkDashboardAccess('massjoin'), tierRequired("basic"), async (req, res) => {
  await MassJoinProtection.findOneAndDelete({ guildId: req.params.id });
  res.json({ success: true });
});

module.exports = router;