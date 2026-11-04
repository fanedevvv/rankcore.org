const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');
const AutoRole = require("../../../Schemas/autorole");
const { getLimits, limitError } = require("../Utils/limits");

// --- AutoRole ---
router.get("/guild/:id/autorole", isAuth, checkDashboardAccess('role'), (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/autorole.html")));
router.get("/api/guild/:id/autorole", isAuth, checkDashboardAccess('role'), async (req, res) => res.json(await AutoRole.findOne({ GuildID: req.params.id }) || { Roles: [] }));
router.post("/api/guild/:id/autorole", isAuth, checkDashboardAccess('role'), async (req, res) => {
    const lim = await getLimits(req.user?.id, req.params.id);
    const doc = await AutoRole.findOne({ GuildID: req.params.id });
    if ((doc?.Roles?.length || 0) >= lim.autoroles) return res.status(400).json({ error: limitError(lim, 'auto-roles') });
    await AutoRole.findOneAndUpdate({ GuildID: req.params.id }, { $addToSet: { Roles: req.body.roleId } }, { upsert: true });
    res.json({ success: true });
});
router.delete("/api/guild/:id/autorole/:roleId", isAuth, checkDashboardAccess('role'), async (req, res) => {
    await AutoRole.findOneAndUpdate({ GuildID: req.params.id }, { $pull: { Roles: req.params.roleId } });
    res.json({ success: true });
});

module.exports = router;