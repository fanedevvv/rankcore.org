const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');
const Halloween = require("../../../Schemas/halloweenSchema");

/* ======= GET CONFIG ======= */
router.get("/guild/:id/halloween", isAuth, checkDashboardAccess('overview'), (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/halloween.html")));

router.get("/api/guild/:id/halloween", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const data = await Halloween.findOne({ Guild: req.params.id });

    res.json(data || {
      Enabled: false,
      Channel: "",
      PingRole: "",
      LastSentDay: null
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load Halloween config" });
  }
});

/* ======= SAVE CONFIG ======= */
router.post("/api/guild/:id/halloween", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const { Enabled, Channel, PingRole } = req.body;

  if (Enabled && !Channel) {
    return res.status(400).json({ error: "Channel is required when enabled" });
  }

  try {
    const config = await Halloween.findOneAndUpdate(
      { Guild: req.params.id },
      {
        Enabled: Boolean(Enabled),
        Channel,
        PingRole,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: "Failed to save Halloween config" });
  }
});

/* ======= DELETE CONFIG ======= */
router.delete("/api/guild/:id/halloween", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    await Halloween.findOneAndDelete({ Guild: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete Halloween config" });
  }
});

module.exports = router;