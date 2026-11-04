const { isAuth, tierRequired, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const router = require("express").Router();
const path = require("path");
const AIConfig = require("../../../Schemas/aiSchema");


// ────────────────────────────────────────────────────────────────────────────
//  Helper: get-or-create config document
// ────────────────────────────────────────────────────────────────────────────
async function getConfig(guildId) {
    return AIConfig.findOneAndUpdate(
        { guildId },
        { $setOnInsert: { guildId } },
        { upsert: true, new: true }
    );
}


// ────────────────────────────────────────────────────────────────────────────
//  Page route
// ────────────────────────────────────────────────────────────────────────────
router.get("/guild/:id/ai", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), (req, res) => {
    sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/ai.html"));
});

// ────────────────────────────────────────────────────────────────────────────
//  GET  /api/guild/:id/ai   — return full config (used by dashboard init)
// ────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/ai", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const config = await getConfig(req.params.id);
        res.json(config);
    } catch (err) {
        console.error("[AI GET config]", err);
        res.status(500).json({ error: "Failed to load config" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  PATCH  /api/guild/:id/ai   — Auto-save all settings at once
// ────────────────────────────────────────────────────────────────────────────
router.patch("/api/guild/:id/ai", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { channelId, logChannelId, maxTokens, contextSize, maxRegens, systemEnabled, imagesEnabled, autoThread, showRegen, showClear, botName, systemPromptOverride, embedFooter, embedColor, developers, modes, filterEnabled, badWords, spamWindow, spamMax, autoBlacklist, cooldownSec, waitThreshold, cooldownMsg, blacklistedMsg, spamMsg, whitelist, requiredRole, modRole } = req.body;

        const set = {};

        if (channelId !== undefined) set.channelId = channelId || null;
        if (logChannelId !== undefined) set.logChannelId = logChannelId || null;
        if (maxTokens !== undefined) set.maxTokens = Number(maxTokens) || 1500;
        if (contextSize !== undefined) set.contextSize = Number(contextSize) || 20;
        if (maxRegens !== undefined) set.maxRegens = Number(maxRegens) || 3;
        if (systemEnabled !== undefined) set.systemEnabled = !!systemEnabled;
        if (imagesEnabled !== undefined) set.imagesEnabled = !!imagesEnabled;
        if (autoThread !== undefined) set.autoThread = !!autoThread;
        if (showRegen !== undefined) set.showRegen = !!showRegen;
        if (showClear !== undefined) set.showClear = !!showClear;

        if (botName !== undefined) set.botName = String(botName || "Ruby").slice(0, 32);
        if (systemPromptOverride !== undefined) set.systemPromptOverride = String(systemPromptOverride || "").slice(0, 4000);
        if (embedFooter !== undefined) set.embedFooter = String(embedFooter || "").slice(0, 128);
        if (embedColor !== undefined) set.embedColor = /^#[0-9a-fA-F]{6}$/.test(embedColor) ? embedColor : "#7289DA";
        if (developers !== undefined) set.developers = Array.isArray(developers) ? developers.map(String).filter(Boolean).slice(0, 20) : [];

        if (modes !== undefined) set.modes = modes || {};
        if (filterEnabled !== undefined) set.filterEnabled = !!filterEnabled;
        if (badWords !== undefined) set.badWords = Array.isArray(badWords) ? badWords.map(w => String(w).toLowerCase().trim()).filter(Boolean) : [];
        if (spamWindow !== undefined) set.spamWindow = Number(spamWindow) || 10;
        if (spamMax !== undefined) set.spamMax = Number(spamMax) || 5;
        if (autoBlacklist !== undefined) set.autoBlacklist = !!autoBlacklist;

        if (cooldownSec !== undefined) set.cooldownSec = Math.min(Math.max(Number(cooldownSec) || 5, 0), 300);
        if (waitThreshold !== undefined) set.waitThreshold = Math.min(Math.max(Number(waitThreshold) || 5, 1), 60);
        if (cooldownMsg !== undefined) set.cooldownMsg = String(cooldownMsg || "").slice(0, 200) || "⏳ Please wait {remaining}s before using AI again.";
        if (blacklistedMsg !== undefined) set.blacklistedMsg = String(blacklistedMsg || "").slice(0, 200) || "You cannot use AI here as you are blacklisted.";
        if (spamMsg !== undefined) set.spamMsg = String(spamMsg || "").slice(0, 200) || "🚫 You have been automatically blacklisted for spamming.";

        if (whitelist !== undefined) set.whitelist = Array.isArray(whitelist) ? whitelist.filter(id => /^\d{17,20}$/.test(id)) : [];
        if (requiredRole !== undefined) set.requiredRole = requiredRole || null;
        if (modRole !== undefined) set.modRole = modRole || null;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            { $set: set },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI PATCH]", err);
        res.status(500).json({ error: "Failed to save" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  POST  /api/guild/:id/ai/config   — Setup tab (channel, model, toggles)
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/config", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const {
            channelId, logChannelId,
            maxTokens, contextSize, maxRegens,
            systemEnabled, imagesEnabled, autoThread, showRegen, showClear,
        } = req.body;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    channelId:    channelId    || null,
                    logChannelId: logChannelId || null,
                    aiModel:      "gemini-2.5-flash",
                    maxTokens:    Number(maxTokens)   || 1500,
                    contextSize:  Number(contextSize) || 20,
                    maxRegens:    Number(maxRegens)   || 3,
                    systemEnabled: !!systemEnabled,
                    imagesEnabled: !!imagesEnabled,
                    autoThread:    !!autoThread,
                    showRegen:     !!showRegen,
                    showClear:     !!showClear,
                },
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST config]", err);
        res.status(500).json({ error: "Failed to save config" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  POST  /api/guild/:id/ai/behaviour   — Behaviour tab (modes, filter, spam)
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/behaviour", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { modes, filterEnabled, badWords, spamWindow, spamMax, autoBlacklist } = req.body;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    modes:         modes         || {},
                    filterEnabled: !!filterEnabled,
                    badWords:      Array.isArray(badWords) ? badWords.map(w => String(w).toLowerCase().trim()).filter(Boolean) : [],
                    spamWindow:    Number(spamWindow) || 10,
                    spamMax:       Number(spamMax)    || 5,
                    autoBlacklist: !!autoBlacklist,
                },
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST behaviour]", err);
        res.status(500).json({ error: "Failed to save behaviour" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  POST  /api/guild/:id/ai/persona   — Persona tab
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/persona", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { botName, systemPromptOverride, embedFooter, embedColor, developers } = req.body;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    botName:              String(botName || "Ruby").slice(0, 32),
                    systemPromptOverride: String(systemPromptOverride || "").slice(0, 4000),
                    embedFooter:          String(embedFooter || "").slice(0, 128),
                    embedColor:           /^#[0-9a-fA-F]{6}$/.test(embedColor) ? embedColor : "#7289DA",
                    developers:           Array.isArray(developers) ? developers.map(String).filter(Boolean).slice(0, 20) : [],
                },
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST persona]", err);
        res.status(500).json({ error: "Failed to save persona" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  POST  /api/guild/:id/ai/limits   — Limits tab
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/limits", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { cooldownSec, waitThreshold, cooldownMsg, blacklistedMsg, spamMsg } = req.body;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    cooldownSec:    Math.min(Math.max(Number(cooldownSec)   || 5,  0), 300),
                    waitThreshold:  Math.min(Math.max(Number(waitThreshold) || 5,  1), 60),
                    cooldownMsg:    String(cooldownMsg    || "").slice(0, 200) || "⏳ Please wait {remaining}s before using AI again.",
                    blacklistedMsg: String(blacklistedMsg || "").slice(0, 200) || "You cannot use AI here as you are blacklisted.",
                    spamMsg:        String(spamMsg        || "").slice(0, 200) || "🚫 You have been automatically blacklisted for spamming.",
                },
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST limits]", err);
        res.status(500).json({ error: "Failed to save limits" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  POST  /api/guild/:id/ai/access   — Access tab (whitelist, required roles)
//  Note: blacklist is managed separately via its own routes below
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/access", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { whitelist, requiredRole, modRole } = req.body;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    whitelist:    Array.isArray(whitelist) ? whitelist.filter(id => /^\d{17,20}$/.test(id)) : [],
                    requiredRole: requiredRole || null,
                    modRole:      modRole      || null,
                },
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST access]", err);
        res.status(500).json({ error: "Failed to save access settings" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  POST  /api/guild/:id/ai/log-settings   — Log forwarding toggles
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/log-settings", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { logBlocks, logAutoBlacklist, logErrors } = req.body;

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    logBlocks:        !!logBlocks,
                    logAutoBlacklist: !!logAutoBlacklist,
                    logErrors:        !!logErrors,
                },
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST log-settings]", err);
        res.status(500).json({ error: "Failed to save log settings" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  Blacklist — add / remove
// ────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/ai/blacklist", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId || !/^\d{17,20}$/.test(userId))
            return res.status(400).json({ error: "Invalid userId" });

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            { $addToSet: { blacklists: userId } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST blacklist]", err);
        res.status(500).json({ error: "Failed to blacklist user" });
    }
});

router.delete("/api/guild/:id/ai/blacklist/:userId", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            { $pull: { blacklists: req.params.userId } }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI DELETE blacklist]", err);
        res.status(500).json({ error: "Failed to remove user from blacklist" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  DELETE  /api/guild/:id/ai/context   — Clear in-memory context
//  The actual messageHistory map lives in the bot process; this route signals
//  it via a flag the bot checks, OR you can emit a custom event if you have
//  access to the bot client here. Using a DB flag is the safe approach.
// ────────────────────────────────────────────────────────────────────────────
router.delete("/api/guild/:id/ai/context", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        // Set a flag; the bot's messageCreate handler checks and clears context on next message.
        // If your bot and dashboard share the same process you can require the bot and clear directly.
        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            { $set: { clearContextFlag: true } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI DELETE context]", err);
        res.status(500).json({ error: "Failed to queue context clear" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  DELETE  /api/guild/:id/ai/stats   — Reset stat counters
// ────────────────────────────────────────────────────────────────────────────
router.delete("/api/guild/:id/ai/stats", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            { $set: { "stats.messages": 0, "stats.blacklisted": 0, "stats.blocked": 0, "stats.regens": 0 } }
        );
        res.json({ success: true });
    } catch (err) {
        console.error("[AI DELETE stats]", err);
        res.status(500).json({ error: "Failed to reset stats" });
    }
});


// ────────────────────────────────────────────────────────────────────────────
//  GET  /api/guild/:id/ai/knowledge  — Return server knowledge context
//  POST /api/guild/:id/ai/knowledge  — Save server knowledge context (#12)
// ────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/ai/knowledge", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const config = await getConfig(req.params.id);
        res.json(config.knowledge ?? {});
    } catch (err) {
        console.error("[AI GET knowledge]", err);
        res.status(500).json({ error: "Failed to load knowledge" });
    }
});

router.post("/api/guild/:id/ai/knowledge", isAuth, checkDashboardAccess('overview'), tierRequired('pro'), async (req, res) => {
    try {
        const { serverName, serverDesc, serverRules, extraContext, ranks } = req.body;

        if (ranks && !Array.isArray(ranks)) {
            return res.status(400).json({ error: "ranks must be an array" });
        }

        await AIConfig.findOneAndUpdate(
            { guildId: req.params.id },
            {
                $set: {
                    "knowledge.serverName":  serverName  ?? "",
                    "knowledge.serverDesc":  serverDesc  ?? "",
                    "knowledge.serverRules": serverRules ?? "",
                    "knowledge.extraContext":extraContext ?? "",
                    "knowledge.ranks":       ranks       ?? [],
                },
            },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("[AI POST knowledge]", err);
        res.status(500).json({ error: "Failed to save knowledge" });
    }
});


module.exports = router;