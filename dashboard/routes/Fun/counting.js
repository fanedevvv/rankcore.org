const Count = require('../../../Schemas/counting');
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ── Page ───────────────────────────────────────────────────────────────────────
router.get("/guild/:id/counting", isAuth, checkDashboardAccess('counting'), (req, res) =>
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/counting.html"))
);

// ── Get Config ─────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/count", isAuth, checkDashboardAccess('counting'), async (req, res) => {
    const data = await Count.findOne({ Guild: req.params.id });
    if (!data) return res.json({ Guild: req.params.id, Channel: null, Count: 0 });

    // Serialize Map fields for JSON
    res.json({
        ...data.toObject(),
        RewardRoles: data.RewardRoles ? Object.fromEntries(data.RewardRoles) : {},
        UserCounts: data.UserCounts ? Object.fromEntries(data.UserCounts) : {},
    });
});

// ── Save Config ────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/count", isAuth, checkDashboardAccess('counting'), async (req, res) => {
    const {
        Channel,
        FailAction,
        FailRole,
        AllowWords,
        PingOnFail,
        CountdownMode,
        CountdownStart,
        Milestones,
        RewardRoles,
    } = req.body;

    const update = {};
    if (Channel !== undefined) update.Channel = Channel || null;
    if (FailAction !== undefined) update.FailAction = FailAction;
    if (FailRole !== undefined) update.FailRole = FailRole || null;
    if (AllowWords !== undefined) update.AllowWords = !!AllowWords;
    if (PingOnFail !== undefined) update.PingOnFail = !!PingOnFail;
    if (CountdownMode !== undefined) update.CountdownMode = !!CountdownMode;
    if (CountdownStart !== undefined) update.CountdownStart = parseInt(CountdownStart) || 100;
    if (Milestones !== undefined) update.Milestones = Milestones;
    if (RewardRoles !== undefined) update.RewardRoles = RewardRoles;

    const updated = await Count.findOneAndUpdate(
        { Guild: req.params.id },
        update,
        { upsert: true, new: true }
    );

    res.json({ success: true, data: updated });
});

// ── Reset Count ────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/count/reset", isAuth, checkDashboardAccess('counting'), async (req, res) => {
    const updated = await Count.findOneAndUpdate(
        { Guild: req.params.id },
        { Count: 0, LastUser: null },
        { upsert: true, new: true }
    );
    res.json({ success: true, data: updated });
});

// ── Add/Remove Reward Role ─────────────────────────────────────────────────────
router.post("/api/guild/:id/count/rewardrole", isAuth, checkDashboardAccess('counting'), async (req, res) => {
    const { milestone, roleId } = req.body;
    if (!milestone) return res.status(400).json({ error: "milestone required" });

    const data = await Count.findOne({ Guild: req.params.id });
    if (!data) return res.status(404).json({ error: "No counting system found" });

    if (!data.RewardRoles) data.RewardRoles = new Map();

    if (roleId) {
        data.RewardRoles.set(String(milestone), roleId);
    } else {
        data.RewardRoles.delete(String(milestone));
    }
    data.markModified('RewardRoles');
    await data.save();

    res.json({ success: true, RewardRoles: Object.fromEntries(data.RewardRoles) });
});

// ── Leaderboard ────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/count/leaderboard", isAuth, checkDashboardAccess('counting'), async (req, res) => {
    const data = await Count.findOne({ Guild: req.params.id });
    if (!data) return res.json([]);
    const userCounts = data.UserCounts ? Object.fromEntries(data.UserCounts) : {};
    const sorted = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));
    res.json(sorted);
});

// ── History ────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/count/history", isAuth, checkDashboardAccess('counting'), async (req, res) => {
    const data = await Count.findOne({ Guild: req.params.id });
    res.json(data ? data.CountHistory || [] : []);
});

module.exports = router;