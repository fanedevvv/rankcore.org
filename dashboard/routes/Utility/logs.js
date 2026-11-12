const router = require("express").Router();
const path = require("path");
const LogSchema = require("../../../Schemas/logschema");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ─── Page ─────────────────────────────────────────────────────────────────────
router.get("/guild/:id/logs", isAuth, checkDashboardAccess('logs'), (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/logs.html"));
});

// ─── GET config ───────────────────────────────────────────────────────────────
router.get("/api/guild/:id/logs", isAuth, checkDashboardAccess('logs'), async (req, res) => {
  try {
    const data = await LogSchema.findOne({ Guild: req.params.id });
    res.json(data || { LogChannels: {} });
  } catch (err) {
    res.status(500).json({ error: "Error loading logs config" });
  }
});

// ─── POST save full config (category channels + per-event overrides) ──────────
router.post("/api/guild/:id/logs", isAuth, checkDashboardAccess('logs'), async (req, res) => {
  try {
    const b = req.body;
    const guildId = req.params.id;

    // Legacy single-event save
    if (b.logType !== undefined && b.channelId !== undefined) {
      const logType = String(b.logType).replace(/[^a-z]/gi, '');
      const channelId = b.channelId ? String(b.channelId) : null;
      const update = channelId
        ? { $set: { [`LogChannels.${logType}`]: channelId } }
        : { $unset: { [`LogChannels.${logType}`]: 1 } };
      await LogSchema.findOneAndUpdate({ Guild: guildId }, update, { upsert: true, new: true });
      return res.json({ success: true });
    }

    // Full config save
    const setObj = {};

    // Category channels
    const categories = ['all','message','channel','guild','role','voice','member','emoji','invite','webhook','automod'];
    if (b.LogChannels && typeof b.LogChannels === 'object') {
      categories.forEach(cat => {
        const val = b.LogChannels[cat];
        setObj[`LogChannels.${cat}`] = (typeof val === 'string' && val.trim()) ? val.trim() : null;
      });
    }

    // Per-event overrides
    if (b.events && typeof b.events === 'object') {
      for (const [evtKey, cfg] of Object.entries(b.events)) {
        // Whitelist event keys to prevent arbitrary DB writes
        if (!/^[a-zA-Z.]+$/.test(evtKey)) continue;
        const key = `event.${evtKey}`;
        setObj[`${key}.channelId`] = (typeof cfg?.channelId === 'string' && cfg.channelId.trim()) ? cfg.channelId.trim() : null;
        setObj[`${key}.enabled`]   = cfg?.enabled !== false;
        
        // Handle template - can be null, string (legacy), or object (new embed format)
        let tpl = cfg?.template;
        if (typeof tpl === 'string') {
          // Legacy string template - keep as-is for backward compat
          tpl = tpl.trim() ? tpl.trim().slice(0, 2000) : null;
        } else if (tpl && typeof tpl === 'object') {
          // New object template - validate basic structure
          if (tpl.type === 'text' || tpl.type === 'embed') {
            // Store the object as-is (MongoDB will store it as Mixed type)
          } else {
            tpl = null;
          }
        } else {
          tpl = null;
        }
        setObj[`${key}.template`] = tpl;
      }
    }

    await LogSchema.findOneAndUpdate(
      { Guild: guildId },
      { $set: setObj },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/guild/:id/logs error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE single type ───────────────────────────────────────────────────────
router.delete("/api/guild/:id/logs/:type", isAuth, checkDashboardAccess('logs'), async (req, res) => {
  const type = req.params.type.replace(/[^a-z]/gi, '');
  const update = {};
  update[`LogChannels.${type}`] = 1;
  await LogSchema.updateOne({ Guild: req.params.id }, { $unset: update });
  res.json({ success: true });
});

// ─── DELETE all ───────────────────────────────────────────────────────────────
router.delete("/api/guild/:id/logs", isAuth, checkDashboardAccess('logs'), async (req, res) => {
  await LogSchema.deleteOne({ Guild: req.params.id });
  res.json({ success: true });
});

module.exports = router;