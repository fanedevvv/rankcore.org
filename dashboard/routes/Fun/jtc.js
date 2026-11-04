const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const JTCConfig = require("../../../Schemas/jointocreate");
const JTCChannels = require("../../../Schemas/jointocreatechannels");

// ── Pages ──────────────────────────────────────────────────────
router.get("/guild/:id/jtc", isAuth, checkDashboardAccess('jtc'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/jtc.html"))
);

// ── GET config ─────────────────────────────────────────────────
router.get("/api/guild/:id/jtc", isAuth, checkDashboardAccess('jtc'), async (req, res) => {
  try {
    const config = await JTCConfig.findOne({ Guild: req.params.id }).lean();

    if (!config) return res.json(null);

    // Augment with live stats (active channels count)
    const activeChannels = await JTCChannels.countDocuments({ Guild: req.params.id });
    config._activeChannels = activeChannels;
    config._totalSessions = config._totalSessions || 0; // populated separately if tracked

    res.json(config);
  } catch (err) {
    console.error("[JTC GET]", err);
    res.status(500).json({ error: "Failed to load config" });
  }
});

// ── POST config ────────────────────────────────────────────────
router.post("/api/guild/:id/jtc", isAuth, checkDashboardAccess('jtc'), async (req, res) => {
  try {
    const allowed = [
      "Channel", "Category", "VoiceLimit", "InheritPermissions",
      "OwnerManage", "AllowLock", "OnePerUser", "BlockBots",
      "NameTemplate", "DupStrategy",
      "DeleteWhenEmpty", "GracePeriod", "MaxLifetime",
      "RequiredRole", "BlacklistRole",
      "PanelEnabled", "PanelDest", "PanelChannel", "PanelButtons",
      "WelcomeEnabled", "WelcomeMessage",
      "LogEnabled", "LogChannel", "LogEvents",
      "Bitrate", "VideoQuality", "RegionOverride",
    ];

    // Build sanitised update object
    const update = { Guild: req.params.id };
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        update[key] = req.body[key];
      }
    }

    // Clamp numeric values server-side
    if (typeof update.GracePeriod === "number") update.GracePeriod = Math.min(300, Math.max(0, update.GracePeriod));
    if (typeof update.MaxLifetime === "number") update.MaxLifetime = Math.min(1440, Math.max(0, update.MaxLifetime));
    if (typeof update.VoiceLimit === "number") update.VoiceLimit = Math.min(99, Math.max(0, update.VoiceLimit));
    if (typeof update.Bitrate === "number") update.Bitrate = Math.min(96, Math.max(8, update.Bitrate));

    const saved = await JTCConfig.findOneAndUpdate({ Guild: req.params.id }, update, { upsert: true, new: true });

    // Permanent panel: post it (or refresh the existing message) right after saving
    let panel = null;
    if (saved.PanelEnabled && saved.PanelDest === "persistent") {
      try {
        if (req.client.isStandaloneMode) {
          const { apiPost } = require("../../lib/botClient");
          await apiPost(`/internal/guild/${req.params.id}/jtc/panel`, {});
        } else {
          const guild = req.client.guilds.cache.get(req.params.id);
          await require("../../../Systems/jointocreate").postPersistentPanel(req.client, guild);
        }
        panel = { posted: true };
      } catch (err) {
        panel = { posted: false, error: err.message || "Could not post the panel." };
      }
    }
    res.json({ success: true, panel });
  } catch (err) {
    console.error("[JTC POST]", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

// ── DELETE config ──────────────────────────────────────────────
router.delete("/api/guild/:id/jtc", isAuth, checkDashboardAccess('jtc'), async (req, res) => {
  try {
    await JTCConfig.findOneAndDelete({ Guild: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("[JTC DELETE]", err);
    res.status(500).json({ error: "Failed to delete config" });
  }
});

module.exports = router;