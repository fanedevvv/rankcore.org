"use strict";

const router = require("express").Router();
const path   = require("path");
const { PermissionFlagsBits, ChannelType } = require("discord.js");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ─────────────────────────────────────────────────────────────────────────────
// Config (mirrors setperm.js command)
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE     = 5;
const BATCH_DELAY_MS = 2000;

// Per-guild lock: guildId → userId running the job
const guildLocks = new Map();

// Per-guild cooldown: guildId → timestamp of last completed job
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const guildCooldowns = new Map();

const PERM_CATEGORIES = {
    General: {
        label: "🌐 General & Access",
        perms: ["ViewChannel", "CreateInstantInvite", "ManageGuild", "Administrator"],
    },
    Text: {
        label: "💬 Text & Media",
        perms: [
            "SendMessages", "SendMessagesInThreads", "EmbedLinks", "AttachFiles",
            "AddReactions", "UseExternalEmojis", "UseExternalStickers", "MentionEveryone",
            "ReadMessageHistory", "ManageMessages", "UseApplicationCommands",
            "ManageThreads", "CreatePublicThreads", "CreatePrivateThreads",
        ],
    },
    Voice: {
        label: "🎤 Voice & Stage",
        perms: [
            "Connect", "Speak", "Stream", "Video", "UseVAD",
            "PrioritySpeaker", "RequestToSpeak", "MoveMembers", "MuteMembers", "DeafenMembers",
        ],
    },
    Moderation: {
        label: "🔨 Moderation & Management",
        perms: ["ManageRoles", "ManageChannels", "ManageWebhooks", "KickMembers", "BanMembers", "ManageGuild"],
    },
    Other: {
        label: "⚙️ Other",
        perms: [
            "ManageNicknames", "ChangeNickname",
            "ManageEmojisAndStickers", "ManageEvents", "UseExternalApps",
        ],
    },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Channel filter (same logic as command)
// ─────────────────────────────────────────────────────────────────────────────
function getChannelFilter(scope) {
    switch (scope) {
        case "text":
            return c =>
                c.isTextBased() &&
                c.type !== ChannelType.GuildVoice &&
                c.type !== ChannelType.GuildStageVoice &&
                c.type !== ChannelType.GuildCategory;
        case "voice":
            return c => c.isVoiceBased() || c.type === ChannelType.GuildStageVoice;
        case "category":
            return c => c.type === ChannelType.GuildCategory;
        default:
            return c =>
                c.isTextBased() ||
                c.isVoiceBased() ||
                c.type === ChannelType.GuildForum ||
                c.type === ChannelType.GuildCategory;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk update (same logic as command, adapted for HTTP)
// ─────────────────────────────────────────────────────────────────────────────
async function runBulkUpdate(guild, { roleIds, permissions, action, channelType }) {
    const bot      = guild.members.me;
    const channels = Array.from(guild.channels.cache.filter(getChannelFilter(channelType)).values());

    const roles = roleIds
        .map(id => (id === guild.id ? guild.roles.everyone : guild.roles.cache.get(id)))
        .filter(Boolean);

    const tasks = [];
    for (const perm of permissions) {
        for (const role of roles) {
            for (const channel of channels) {
                tasks.push({ perm, role, channel });
            }
        }
    }

    if (tasks.length === 0) {
        return { successCount: 0, failedCount: 0, channels: channels.length };
    }

    let success = 0;
    let failed  = 0;

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        await Promise.allSettled(
            tasks.slice(i, i + BATCH_SIZE).map(async ({ perm, role, channel }) => {
                try {
                    if (!channel.permissionsFor(bot)?.has(PermissionFlagsBits.ManageChannels)) {
                        failed++;
                        return;
                    }

                    if (action === "remove") {
                        await channel.permissionOverwrites.delete(role);
                    } else {
                        const value = action === "allow" ? true : action === "deny" ? false : null;
                        await channel.permissionOverwrites.edit(role, { [perm]: value });
                    }

                    success++;
                } catch (err) {
                    failed++;
                    console.error(`[global-perm/dashboard] ${role?.name} / ${perm} / #${channel.name}: ${err.message}`);
                }
            })
        );

        if (i + BATCH_SIZE < tasks.length) await sleep(BATCH_DELAY_MS);
    }

    return { successCount: success, failedCount: failed, channels: channels.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// Page
router.get("/guild/:id/global-perm", isAuth, checkDashboardAccess('overview'), (req, res) => {
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/globalperm.html"));
});

// Permission categories metadata (for UI)
router.get("/api/guild/:id/global-perms/categories", isAuth, checkDashboardAccess('overview'), (req, res) => {
    res.json(PERM_CATEGORIES);
});

// Apply permissions
router.post("/api/guild/:id/global-perms/apply", isAuth, checkDashboardAccess('overview'), async (req, res) => {
    const guildId = req.params.id;
    const userId  = req.user.id;

    const { roles, permissions, state: action, channelType } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "No roles provided." });
    }
    if (roles.length > 25) {
        return res.status(400).json({ error: "Maximum 25 roles allowed." });
    }
    if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({ error: "No permissions provided." });
    }
    if (permissions.length > 10) {
        return res.status(400).json({ error: "Maximum 10 permissions allowed per request." });
    }

    const validActions = ["allow", "deny", "none", "remove"];
    if (!validActions.includes(action)) {
        return res.status(400).json({ error: "Invalid action." });
    }

    const validScopes = ["all", "text", "voice", "category"];
    const scope = validScopes.includes(channelType) ? channelType : "all";

    // Validate permission names against our whitelist
    const allValidPerms = Object.values(PERM_CATEGORIES).flatMap(c => c.perms);
    const badPerms = permissions.filter(p => !allValidPerms.includes(p));
    if (badPerms.length > 0) {
        return res.status(400).json({ error: `Unknown permissions: ${badPerms.join(", ")}` });
    }

    // ── Guild lock (one active job per guild) ─────────────────────────────────
    if (guildLocks.has(guildId)) {
        return res.status(409).json({ error: "A global-perm job is already running for this server. Please wait." });
    }

    // ── Cooldown (one job per guild per 5 minutes) ────────────────────────────
    const lastRun = guildCooldowns.get(guildId);
    if (lastRun) {
        const elapsed = Date.now() - lastRun;
        if (elapsed < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
            return res.status(429).json({ error: `Global perms are on cooldown. Try again in ${label}.` });
        }
    }

    // ── Standalone mode: proxy to bot process via internal API ────────────────
    if (req.client.isStandaloneMode) {
        try {
            const result = await req.client.globalPerms.apply(guildId, {
                roles, permissions, state: action, channelType: scope,
            });
            return res.json(result);
        } catch (err) {
            const status = err.status || 500;
            return res.status(status).json({ error: err.message || 'Internal API error.' });
        }
    }

    // ── Get guild object (embedded mode) ─────────────────────────────────────
    let guild;
    try {
        guild = req.client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ error: "Guild not found." });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    // ── Bot permission check ──────────────────────────────────────────────────
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return res.status(403).json({ error: "Bot is missing ManageChannels permission." });
    }

    // ── Run the update ────────────────────────────────────────────────────────
    guildLocks.set(guildId, userId);
    try {
        const result = await runBulkUpdate(guild, {
            roleIds:     roles,
            permissions,
            action,
            channelType: scope,
        });
        guildCooldowns.set(guildId, Date.now());
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("[global-perm/dashboard] Unexpected error:", err);
        res.status(500).json({ error: "An unexpected error occurred." });
    } finally {
        guildLocks.delete(guildId);
    }
});

module.exports = router;