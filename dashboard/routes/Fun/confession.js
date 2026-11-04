const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');
const ConfessionConfig = require("../../../Schemas/confession");

// ── Views ─────────────────────────────────────────────────────────────────────
router.get("/guild/:id/confession", isAuth, checkDashboardAccess('confession'), (req, res) =>
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/confession.html"))
);

// ── Get config ────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/confession", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        const data = await ConfessionConfig.findOne({ Guild: req.params.id });
        res.json(data || {});
    } catch (e) { res.json({}); }
});

// ── Save full config ──────────────────────────────────────────────────────────
router.post("/api/guild/:id/confession", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        const allowed = [
            // Channels
            'ConfessionChannel','ReviewChannel','LogChannel','ReportChannel',
            // Review
            'ReviewEnabled','AnonymousReview','ReviewPingRole','AutoApproveAfterMs',
            // Posting
            'ConfessionPingRole','ReportPingRole',
            'ConfessionTitle','ConfessionColor','ConfessionFooter','ShowConfessionNumber',
            // Cooldown / limits
            'CooldownSeconds','MaxConfessionLength','MinConfessionLength',
            // Access
            'Blacklist','TrustedUsers','ModeratorRoles','RequiredRoles',
            // Word filter
            'WordFilterEnabled','BlockedWords','FilterAction',
            // Reactions
            'ReactionsEnabled','ReactionEmojis',
            // Features
            'ThreadReplies','DMOnApprove','DMOnDeny',
            'CategoriesEnabled','Categories',
        ];

        const update = { Guild: req.params.id };
        for (const key of allowed) {
            if (req.body[key] !== undefined) update[key] = req.body[key];
        }

        await ConfessionConfig.findOneAndUpdate(
            { Guild: req.params.id },
            { $set: update },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to save' });
    }
});

// ── Delete / reset config ─────────────────────────────────────────────────────
router.delete("/api/guild/:id/confession", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        await ConfessionConfig.findOneAndDelete({ Guild: req.params.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Delete failed' }); }
});

// ── Word filter — add words ───────────────────────────────────────────────────
router.post("/api/guild/:id/confession/filter/add", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        const { words } = req.body;
        if (!Array.isArray(words) || !words.length) return res.status(400).json({ error: 'words must be a non-empty array' });

        const doc = await ConfessionConfig.findOne({ Guild: req.params.id });
        if (!doc) return res.status(404).json({ error: 'Config not found' });

        const toAdd = words.map(w => w.trim().toLowerCase()).filter(Boolean);
        for (const w of toAdd) {
            if (!doc.BlockedWords.includes(w)) doc.BlockedWords.push(w);
        }
        await doc.save();
        res.json({ success: true, blockedWords: doc.BlockedWords });
    } catch (e) { res.status(500).json({ error: 'Failed to add words' }); }
});

// ── Word filter — remove word ─────────────────────────────────────────────────
router.delete("/api/guild/:id/confession/filter/:word", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        const word = decodeURIComponent(req.params.word).toLowerCase().trim();
        await ConfessionConfig.updateOne({ Guild: req.params.id }, { $pull: { BlockedWords: word } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to remove word' }); }
});

// ── Categories ────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/confession/categories/add", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        const { label, emoji, channel } = req.body;
        if (!label) return res.status(400).json({ error: 'label required' });
        const doc = await ConfessionConfig.findOne({ Guild: req.params.id });
        if (!doc) return res.status(404).json({ error: 'Config not found' });
        if (doc.Categories.find(c => c.label === label)) return res.status(409).json({ error: 'Category already exists' });
        doc.Categories.push({ label, emoji: emoji || '📂', channel: channel || null });
        await doc.save();
        res.json({ success: true, categories: doc.Categories });
    } catch (e) { res.status(500).json({ error: 'Failed to add category' }); }
});

router.delete("/api/guild/:id/confession/categories/:label", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        const label = decodeURIComponent(req.params.label);
        await ConfessionConfig.updateOne({ Guild: req.params.id }, { $pull: { Categories: { label } } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to remove category' }); }
});

// ── Blacklist ─────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/confession/blacklist/add", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
        await ConfessionConfig.findOneAndUpdate(
            { Guild: req.params.id },
            { $addToSet: { Blacklist: userId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post("/api/guild/:id/confession/blacklist/remove", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
        await ConfessionConfig.updateOne({ Guild: req.params.id }, { $pull: { Blacklist: userId } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ── Trusted users ─────────────────────────────────────────────────────────────
router.post("/api/guild/:id/confession/trusted/add", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
        await ConfessionConfig.findOneAndUpdate(
            { Guild: req.params.id },
            { $addToSet: { TrustedUsers: userId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

router.post("/api/guild/:id/confession/trusted/remove", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
        await ConfessionConfig.updateOne({ Guild: req.params.id }, { $pull: { TrustedUsers: userId } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ── Reset stats ───────────────────────────────────────────────────────────────
router.post("/api/guild/:id/confession/stats/reset", isAuth, checkDashboardAccess('confession'), async (req, res) => {
    try {
        await ConfessionConfig.updateOne({ Guild: req.params.id }, {
            $set: { TotalPosted: 0, TotalDenied: 0, TotalFiltered: 0, ConfessionCount: 0 }
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed to reset stats' }); }
});

module.exports = router;