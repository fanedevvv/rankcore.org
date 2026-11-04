"use strict";

const CatLock = require("../../../Schemas/catschema");
const UwULock = require("../../../Schemas/uwuschema");
const router  = require("express").Router();
const path    = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidSnowflake(id) {
    return typeof id === "string" && /^\d{17,20}$/.test(id);
}

async function fetchMember(client, guildId, userId) {
    try {
        const guild = await client.guilds.fetch(guildId);
        return await guild.members.fetch(userId);
    } catch {
        return null;
    }
}

// ── Page ──────────────────────────────────────────────────────────────────────

router.get("/guild/:id/catlock", isAuth, checkDashboardAccess('overview'), (req, res) =>
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/catlock.html"))
);

// ── GET all cat-locked users ──────────────────────────────────────────────────

router.get("/api/guild/:id/catlock", isAuth, checkDashboardAccess('overview'), async (req, res) => {
    try {
        const records = await CatLock.find({ Guild: req.params.id });
        const client  = req.client || req.app.get("client");
        const guild   = client
            ? await client.guilds.fetch(req.params.id).catch(() => null)
            : null;

        const enriched = await Promise.all(
            records.map(async r => {
                let username  = r.User;
                let avatarUrl = null;

                if (guild) {
                    try {
                        const member = await guild.members.fetch(r.User);
                        if (member?.user) {
                            username  = member.user.username;
                            avatarUrl = member.user.displayAvatarURL({ size: 64, extension: "webp" });
                        }
                    } catch { /* member may have left */ }
                }

                return { userId: r.User, username, avatarUrl, lockedAt: r.LockedAt || null };
            })
        );

        res.json(enriched);
    } catch (err) {
        console.error("GET /catlock error:", err);
        res.status(500).json({ error: "Failed to fetch cat-locked users" });
    }
});

// ── POST — add a cat lock ─────────────────────────────────────────────────────

router.post("/api/guild/:id/catlock", isAuth, checkDashboardAccess('overview'), async (req, res) => {
    const { userId } = req.body;

    if (!userId || !isValidSnowflake(userId))
        return res.status(400).json({ error: "A valid Discord User ID is required" });

    const client = req.client || req.app.get("client");
    if (client) {
        const member = await fetchMember(client, req.params.id, userId);
        if (!member)
            return res.status(404).json({ error: "That user is not a member of this server" });
        if (member.user?.bot)
            return res.status(400).json({ error: "You cannot cat-lock a bot 🐱" });
    }

    try {
        // Prevent duplicates
        const existing = await CatLock.findOne({ Guild: req.params.id, User: userId });
        if (existing)
            return res.status(409).json({ error: "User is already cat-locked" });

        // Block if user is already UwULocked
        const uwuLocked = await UwULock.findOne({ Guild: req.params.id, User: userId });
        if (uwuLocked)
            return res.status(409).json({ error: "User is already UwU-locked! Remove their UwULock first." });

        await CatLock.create({ Guild: req.params.id, User: userId, LockedAt: new Date() });

        let username  = userId;
        let avatarUrl = null;
        if (client) {
            const member = await fetchMember(client, req.params.id, userId);
            if (member?.user) {
                username  = member.user.username;
                avatarUrl = member.user.displayAvatarURL({ size: 64, extension: "webp" });
            }
        }

        res.json({ success: true, username, avatarUrl });
    } catch (err) {
        console.error("POST /catlock error:", err);
        res.status(500).json({ error: "Failed to add cat lock" });
    }
});

// ── DELETE — remove a cat lock ────────────────────────────────────────────────

router.delete("/api/guild/:id/catlock/:userId", isAuth, checkDashboardAccess('overview'), async (req, res) => {
    if (!isValidSnowflake(req.params.userId))
        return res.status(400).json({ error: "Invalid User ID" });

    try {
        const result = await CatLock.deleteMany({ Guild: req.params.id, User: req.params.userId });
        if (result.deletedCount === 0)
            return res.status(404).json({ error: "User is not cat-locked" });
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /catlock error:", err);
        res.status(500).json({ error: "Failed to remove cat lock" });
    }
});

module.exports = router;