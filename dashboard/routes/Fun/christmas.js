const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const Christmas = require("../../../Schemas/christmasSchema");

router.get("/guild/:id/christmas", isAuth, checkDashboardAccess('overview'), (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/christmas.html")));
router.get("/api/guild/:id/christmas", isAuth, checkDashboardAccess('overview'), async (req, res) => {
    res.json(await Christmas.findOne({ Guild: req.params.id }) || { Enabled: false });
});
router.post("/api/guild/:id/christmas", isAuth, checkDashboardAccess('overview'), async (req, res) => {
    const config = await Christmas.findOneAndUpdate({ Guild: req.params.id }, { Enabled: req.body.Enabled, Channel: req.body.Channel, PingRole: req.body.PingRole }, { upsert: true, new: true });
    res.json({ success: true, config });
});
module.exports = router;