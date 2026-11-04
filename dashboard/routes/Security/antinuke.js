const Antinuke = require('../../../Schemas/antinukeSchema');
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, tierRequired, checkDashboardAccess } = require('../../middleware');

// ─── Page Route ──────────────────────────────────────────────────────────────
router.get("/guild/:id/antinuke", isAuth, checkDashboardAccess('security'), tierRequired('basic'), (req, res) => {
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/antinuke.html"));
});

// ─── GET Config ──────────────────────────────────────────────────────────────
router.get("/api/guild/:id/antinuke", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        const data = await Antinuke.findOne({ guildId: req.params.id });
        res.json(data || {
            enabled: false,
            whitelist: [],
            trustedRoles: [],
            logChannelId: null,
            action: 'log',
            dmOwner: false,
            alertPing: null,
            events: {},
            punishmentLog: []
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

// ─── POST Config (global settings) ───────────────────────────────────────────
router.post("/api/guild/:id/antinuke/config", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        const { enabled, logChannelId, action, dmOwner, alertPing } = req.body;
        await Antinuke.findOneAndUpdate(
            { guildId: req.params.id },
            {
                enabled: !!enabled,
                logChannelId: logChannelId || null,
                action: action || 'log',
                dmOwner: !!dmOwner,
                alertPing: alertPing || null,
            },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// ─── POST Per-Event Settings ──────────────────────────────────────────────────
router.post("/api/guild/:id/antinuke/events", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        // req.body.events = { memberKick: { enabled, action, threshold, thresholdWindow }, ... }
        const { events } = req.body;
        const updateObj = {};
        for (const [key, val] of Object.entries(events || {})) {
            updateObj[`events.${key}.enabled`] = val.enabled !== undefined ? val.enabled : true;
            updateObj[`events.${key}.action`] = val.action || 'inherit';
            updateObj[`events.${key}.threshold`] = val.threshold ?? 0;
            updateObj[`events.${key}.thresholdWindow`] = val.thresholdWindow ?? 10;
        }
        await Antinuke.findOneAndUpdate({ guildId: req.params.id }, { $set: updateObj }, { upsert: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save event settings' });
    }
});

// ─── Whitelist ────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/antinuke/whitelist", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId || !/^\d{17,20}$/.test(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        await Antinuke.findOneAndUpdate(
            { guildId: req.params.id },
            { $addToSet: { whitelist: userId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add to whitelist' });
    }
});

router.delete("/api/guild/:id/antinuke/whitelist/:userId", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        await Antinuke.findOneAndUpdate(
            { guildId: req.params.id },
            { $pull: { whitelist: req.params.userId } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove from whitelist' });
    }
});

// ─── Trusted Roles ────────────────────────────────────────────────────────────
router.post("/api/guild/:id/antinuke/trusted-roles", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        const { roleId } = req.body;
        if (!roleId || !/^\d{17,20}$/.test(roleId)) {
            return res.status(400).json({ error: 'Invalid role ID' });
        }
        await Antinuke.findOneAndUpdate(
            { guildId: req.params.id },
            { $addToSet: { trustedRoles: roleId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add trusted role' });
    }
});

router.delete("/api/guild/:id/antinuke/trusted-roles/:roleId", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        await Antinuke.findOneAndUpdate(
            { guildId: req.params.id },
            { $pull: { trustedRoles: req.params.roleId } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove trusted role' });
    }
});

// ─── Punishment Logs ──────────────────────────────────────────────────────────
router.get("/api/guild/:id/antinuke/logs", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        const data = await Antinuke.findOne({ guildId: req.params.id });
        res.json((data?.punishmentLog || []).slice().reverse());
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

router.delete("/api/guild/:id/antinuke/logs", isAuth, checkDashboardAccess('security'), tierRequired('basic'), async (req, res) => {
    try {
        await Antinuke.findOneAndUpdate({ guildId: req.params.id }, { $set: { punishmentLog: [] } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

module.exports = router;