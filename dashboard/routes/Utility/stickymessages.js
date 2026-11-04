const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');
const StickySchema = require("../../../Schemas/stickySchema");
const { getLimits, limitError } = require("../Utils/limits");

// --- Sticky Messages ---
router.get("/guild/:id/sticky", isAuth, checkDashboardAccess('sticky'), (req, res) =>
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/sticky.html")));

router.get("/api/guild/:id/sticky", isAuth, checkDashboardAccess('sticky'), async (req, res) =>
    res.json(await StickySchema.find({ Guild: req.params.id })));

router.post("/api/guild/:id/sticky", isAuth, checkDashboardAccess('sticky'), async (req, res) => {
    if (await StickySchema.findOne({ Guild: req.params.id, Channel: req.body.channelId, Message: req.body.message }))
        return res.status(400).json({ error: "Exists" });
    const lim = await getLimits(req.user?.id, req.params.id);
    const count = await StickySchema.countDocuments({ Guild: req.params.id });
    if (count >= lim.stickyMessages) return res.status(400).json({ error: limitError(lim, 'sticky messages') });
    await StickySchema.create({
        Guild:           req.params.id,
        Channel:         req.body.channelId,
        Message:         req.body.message,
        Cap:             req.body.cap,
        Count:           0,
        UseEmbed:        req.body.useEmbed !== false,
        EmbedColor:      req.body.embedColor || null,
        IgnoreBots:      req.body.ignoreBots !== false,
        ConvoDetection:  !!req.body.convoDetection,
        ConvoWindowMs:   req.body.convoWindowMs ?? 8000,
    });
    res.json({ success: true });
});

router.patch("/api/guild/:id/sticky/:dbId", isAuth, checkDashboardAccess('sticky'), async (req, res) => {
    const doc = await StickySchema.findOne({ _id: req.params.dbId, Guild: req.params.id });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (req.body.useEmbed       !== undefined) doc.UseEmbed       = req.body.useEmbed !== false;
    if (req.body.embedColor     !== undefined) doc.EmbedColor     = req.body.embedColor || null;
    if (req.body.message        !== undefined) doc.Message        = req.body.message;
    if (req.body.cap            !== undefined) doc.Cap            = req.body.cap;
    if (req.body.ignoreBots     !== undefined) doc.IgnoreBots     = req.body.ignoreBots !== false;
    if (req.body.convoDetection !== undefined) doc.ConvoDetection = !!req.body.convoDetection;
    if (req.body.convoWindowMs  !== undefined) doc.ConvoWindowMs  = req.body.convoWindowMs;
    await doc.save();
    res.json({ success: true });
});

router.delete("/api/guild/:id/sticky/:dbId", isAuth, checkDashboardAccess('sticky'), async (req, res) => {
    await StickySchema.deleteOne({ _id: req.params.dbId, Guild: req.params.id });
    res.json({ success: true });
});

module.exports = router;