const AntiScam = require('../../../Schemas/antiscam');
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ─── Page Route ──────────────────────────────────────────────────────────────
router.get("/guild/:id/antiscam", isAuth, checkDashboardAccess('antiscam'), (req, res) => {
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/antiscam.html"));
});

// ─── GET Config ──────────────────────────────────────────────────────────────
router.get("/api/guild/:id/antiscam", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        const data = await AntiScam.findOne({ guildId: req.params.id });
        if (!data) {
            return res.json({
                enabled: false, logChannelId: null, globalAction: 'delete', globalMuteMinutes: 10,
                detectPhishing: {}, detectFakeNitro: {}, detectSuspiciousContent: {},
                detectNewAccounts: {}, detectSuspiciousUsernames: {},
                newAccountDays: 7, heatThreshold: 10, heatDecayMinutes: 60,
                heatValues: { noAvatar: 3, weirdName: 5, phishingLink: 10, suspiciousContent: 7, repeatedOffence: 4 },
                customDomains: [], customPatterns: [],
                warnSteps: [
                    { count: 1, action: 'warn', note: 'First offence' },
                    { count: 3, action: 'mute', note: '30m mute' },
                    { count: 5, action: 'kick', note: 'Repeated offences' },
                    { count: 7, action: 'ban', note: 'Persistent violations' },
                ],
                whitelist: [], ignoredRoles: [], ignoredChannels: [], warns: {}, punishmentLog: []
            });
        }
        const obj = data.toObject();
        if (!obj.warns) obj.warns = {};
        return res.json(obj);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch Anti-Scam config' });
    }
});

// ─── POST Config (global settings + detection toggles) ───────────────────────
router.post("/api/guild/:id/antiscam/config", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        const {
            enabled, logChannelId, globalAction, globalMuteMinutes,
            detectPhishing, detectFakeNitro, detectSuspiciousContent,
            detectNewAccounts, detectSuspiciousUsernames,
            newAccountDays, heatThreshold, heatDecayMinutes, heatValues,
            customDomains, customPatterns, warnSteps,
        } = req.body;

        const update = {
            enabled: !!enabled,
            logChannelId: logChannelId || null,
            globalAction: globalAction || 'delete',
            globalMuteMinutes: Math.max(1, Math.min(1440, parseInt(globalMuteMinutes) || 10)),
            newAccountDays: Math.max(1, Math.min(365, parseInt(newAccountDays) || 7)),
            heatThreshold: Math.max(1, Math.min(100, parseInt(heatThreshold) || 10)),
            heatDecayMinutes: Math.max(1, Math.min(1440, parseInt(heatDecayMinutes) || 60)),
        };

        if (heatValues && typeof heatValues === 'object') {
            update.heatValues = {
                noAvatar: Math.max(0, parseInt(heatValues.noAvatar) || 3),
                weirdName: Math.max(0, parseInt(heatValues.weirdName) || 5),
                phishingLink: Math.max(0, parseInt(heatValues.phishingLink) || 10),
                suspiciousContent: Math.max(0, parseInt(heatValues.suspiciousContent) || 7),
                repeatedOffence: Math.max(0, parseInt(heatValues.repeatedOffence) || 4),
            };
        }

        const sanitiseDetection = (d) => {
            if (!d || typeof d !== 'object') return {};
            const out = {};
            if (d.enabled !== undefined) out.enabled = !!d.enabled;
            if (d.action) out.action = d.action;
            if (d.muteMinutes) out.muteMinutes = Math.max(1, Math.min(1440, parseInt(d.muteMinutes) || 10));
            if (d.threshold !== undefined) out.threshold = Math.max(0, parseInt(d.threshold) || 0);
            return out;
        };

        if (detectPhishing)     update.detectPhishing     = sanitiseDetection(detectPhishing);
        if (detectFakeNitro)     update.detectFakeNitro     = sanitiseDetection(detectFakeNitro);
        if (detectSuspiciousContent) update.detectSuspiciousContent = sanitiseDetection(detectSuspiciousContent);
        if (detectNewAccounts)   update.detectNewAccounts   = sanitiseDetection(detectNewAccounts);
        if (detectSuspiciousUsernames) update.detectSuspiciousUsernames = sanitiseDetection(detectSuspiciousUsernames);

        if (Array.isArray(customDomains)) {
            update.customDomains = customDomains.map(s => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 50);
        }
        if (Array.isArray(customPatterns)) {
            update.customPatterns = customPatterns.map(s => String(s).trim()).filter(Boolean).slice(0, 50);
        }

        if (Array.isArray(warnSteps)) {
            update.warnSteps = warnSteps
                .map(s => ({
                    count: Math.max(1, parseInt(s.count) || 1),
                    action: s.action || 'warn',
                    note: String(s.note || '').slice(0, 100),
                }))
                .filter(s => ['warn', 'mute', 'kick', 'ban'].includes(s.action))
                .slice(0, 10);
        }

        await AntiScam.findOneAndUpdate({ guildId: req.params.id }, { $set: update }, { upsert: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Failed to save config' });
    }
});

// ─── Whitelist ──────────────────────────────────────────────────────────────
router.post("/api/guild/:id/antiscam/whitelist", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId || !/^\d{17,20}$/.test(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        await AntiScam.findOneAndUpdate(
            { guildId: req.params.id },
            { $addToSet: { whitelist: userId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add to whitelist' });
    }
});

router.delete("/api/guild/:id/antiscam/whitelist/:userId", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        await AntiScam.findOneAndUpdate(
            { guildId: req.params.id },
            { $pull: { whitelist: req.params.userId } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove from whitelist' });
    }
});

// ─── Ignored Roles ──────────────────────────────────────────────────────────
router.post("/api/guild/:id/antiscam/ignored-roles", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        const { roleId } = req.body;
        if (!roleId || !/^\d{17,20}$/.test(roleId)) {
            return res.status(400).json({ error: 'Invalid role ID' });
        }
        await AntiScam.findOneAndUpdate(
            { guildId: req.params.id },
            { $addToSet: { ignoredRoles: roleId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add ignored role' });
    }
});

router.delete("/api/guild/:id/antiscam/ignored-roles/:roleId", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        await AntiScam.findOneAndUpdate(
            { guildId: req.params.id },
            { $pull: { ignoredRoles: req.params.roleId } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove ignored role' });
    }
});

// ─── Ignored Channels ────────────────────────────────────────────────────────
router.post("/api/guild/:id/antiscam/ignored-channels", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        const { channelId } = req.body;
        if (!channelId || !/^\d{17,20}$/.test(channelId)) {
            return res.status(400).json({ error: 'Invalid channel ID' });
        }
        await AntiScam.findOneAndUpdate(
            { guildId: req.params.id },
            { $addToSet: { ignoredChannels: channelId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to add ignored channel' });
    }
});

router.delete("/api/guild/:id/antiscam/ignored-channels/:channelId", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        await AntiScam.findOneAndUpdate(
            { guildId: req.params.id },
            { $pull: { ignoredChannels: req.params.channelId } }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove ignored channel' });
    }
});

// ─── Punishment Logs ────────────────────────────────────────────────────────
router.get("/api/guild/:id/antiscam/logs", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        const data = await AntiScam.findOne({ guildId: req.params.id });
        res.json((data?.punishmentLog || []).slice().reverse());
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

router.delete("/api/guild/:id/antiscam/logs", isAuth, checkDashboardAccess('antiscam'), async (req, res) => {
    try {
        await AntiScam.findOneAndUpdate({ guildId: req.params.id }, { $set: { punishmentLog: [] } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

module.exports = router;
