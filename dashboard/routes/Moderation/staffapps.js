"use strict";
/**
 * dashboard/routes/Moderation/staffapps.js
 *
 * REST API + page route for the Staff Application system.
 *
 * Routes:
 *   GET  /guild/:id/staffapps            → serve dashboard page
 *   GET  /api/guild/:id/staffapps        → list all panels
 *   POST /api/guild/:id/staffapps        → create panel
 *   GET  /api/guild/:id/staffapps/:pid   → get panel
 *   PATCH /api/guild/:id/staffapps/:pid  → update panel
 *   DELETE /api/guild/:id/staffapps/:pid → delete panel
 *   POST /api/guild/:id/staffapps/:pid/post   → post panel button to channel
 *   GET  /api/guild/:id/staffapps/:pid/submissions  → list submissions
 *   GET  /api/guild/:id/staffapps/:pid/submissions/:sid  → get one submission
 *   POST /api/guild/:id/staffapps/:pid/submissions/:sid/decision  → accept/deny
 */

const router = require("express").Router();
const path   = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { cbSend } = require("../../lib/cbSend");

const StaffApplication          = require("../../../Schemas/staffApplicationSchema");
const StaffApplicationSubmission = require("../../../Schemas/staffApplicationSubmission");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { parseEmoji } = require("../../../Utils/emojis");

// ── Helpers ───────────────────────────────────────────────────────────────────

function nanoid(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Fetch a channel via the guild object (works with BotClientShim). */
async function fetchChannel(req, guildId, channelId) {
  try {
    const guild = req.client?.guilds?.cache?.get(guildId);
    if (guild) return await guild.channels.fetch(channelId).catch(() => null);
    return await req.client?.channels?.fetch(channelId).catch(() => null);
  } catch {
    return null;
  }
}

/** Build the panel embed posted to the panel channel. */
function buildPanelEmbed(panel) {
  const embed = new EmbedBuilder()
    .setColor(panel.embedColor || "#6C53FF")
    .setTitle(panel.embedTitle || `${panel.emoji || "📋"} ${panel.name} Application`)
    .setDescription(
      panel.description ||
      `Click the button below to apply for **${panel.name}**.\nMake sure you meet all requirements before applying.`
    )
    .setTimestamp();

  if (panel.embedFooter) embed.setFooter({ text: panel.embedFooter });
  if (panel.requiredRoleId) {
    embed.addFields({ name: "Required Role", value: `<@&${panel.requiredRoleId}>`, inline: true });
  }
  if (panel.cooldownHours > 0) {
    embed.addFields({ name: "Cooldown", value: `${panel.cooldownHours}h between applications`, inline: true });
  }

  return embed;
}

/** Build the apply button row. */
function buildPanelRow(panelId, label, emoji) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`staffapp_apply:${panelId}`)
      .setLabel(label || "Apply Now")
      .setStyle(ButtonStyle.Primary)
      .setEmoji(typeof emoji === "string" && emoji.startsWith("<") ? parseEmoji(emoji) : (emoji || "📋")),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
router.get("/guild/:id/staffapps", isAuth, checkDashboardAccess('moderation'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/staffapps.html"))
);

// ── Web application form page (public, no auth required) ─────────────────────
router.get("/apply/:guildId/:panelId", (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/apply.html"))
);

// ─────────────────────────────────────────────────────────────────────────────
// Public panel info — used by the web application form (no auth required)
// Only returns safe, non-sensitive fields
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:guildId/staffapps/:pid/public", async (req, res) => {
  try {
    const panel = await StaffApplication.findOne({
      panelId: req.params.pid,
      guildId: req.params.guildId,
    }).lean();
    if (!panel) return res.status(404).json({ error: "Application not found." });
    if (!panel.enabled) return res.status(403).json({ error: "This application is currently closed." });

    // Only expose fields needed for the form
    res.json({
      panel: {
        panelId:       panel.panelId,
        name:          panel.name,
        description:   panel.description,
        emoji:         panel.emoji,
        enabled:       panel.enabled,
        questions:     panel.questions,
        cooldownHours: panel.cooldownHours,
        // Expose that a required role exists (but not what it is — checked server-side)
        hasRequiredRole: !!panel.requiredRoleId,
      },
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load application." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility check — authenticated, returns whether the user can apply
// Called by apply.html immediately after login to gate the form
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:guildId/staffapps/:pid/eligibility", async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ eligible: false, error: "Not logged in." });

    const { guildId, pid: panelId } = req.params;

    const panel = await StaffApplication.findOne({ panelId, guildId }).lean();
    if (!panel)         return res.status(404).json({ eligible: false, error: "Application not found." });
    if (!panel.enabled) return res.status(403).json({ eligible: false, error: "This application is currently closed." });

    // No required role — always eligible
    if (!panel.requiredRoleId) return res.json({ eligible: true });

    // Fetch member's roles via the bot's internal API
    try {
      const { apiGet } = require("../../lib/botClient");
      const memberData = await apiGet(`/internal/guild/${guildId}/member/${req.user.id}/roles`);
      const hasRole = Array.isArray(memberData?.roles) && memberData.roles.includes(panel.requiredRoleId);
      if (!hasRole) {
        return res.json({
          eligible:    false,
          error:       "You don't have the required role to apply.",
          requiredRole: panel.requiredRoleId,
        });
      }
    } catch {
      // Bot unreachable — fail open so an outage doesn't lock everyone out.
      // The server-side apply route will re-check before saving.
      return res.json({ eligible: true, warning: "Role check skipped — bot temporarily unavailable." });
    }

    // Also do a cooldown pre-check so the user sees it before filling the form
    if (panel.cooldownHours > 0) {
      const since  = new Date(Date.now() - panel.cooldownHours * 60 * 60 * 1000);
      const recent = await (require("../../../Schemas/staffApplicationSubmission"))
        .findOne({ panelId, guildId, userId: req.user.id, createdAt: { $gte: since } })
        .lean();
      if (recent) {
        const nextAllowed = new Date(recent.createdAt.getTime() + panel.cooldownHours * 60 * 60 * 1000);
        return res.json({
          eligible: false,
          error:    `You applied too recently. You can apply again after ${nextAllowed.toLocaleString()}.`,
        });
      }
    }

    res.json({ eligible: true });
  } catch (e) {
    console.error("[StaffApps Eligibility]", e);
    res.status(500).json({ eligible: false, error: "Failed to check eligibility." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Web submit — authenticated via session cookie, no Discord modal needed
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:guildId/staffapps/:pid/apply", async (req, res) => {
  try {
    const { guildId, pid: panelId } = req.params;

    // Must be logged in via dashboard session
    if (!req.user?.id) return res.status(401).json({ error: "You must be logged in to apply." });

    const panel = await StaffApplication.findOne({ panelId, guildId }).lean();
    if (!panel)         return res.status(404).json({ error: "Application not found." });
    if (!panel.enabled) return res.status(403).json({ error: "This application is currently closed." });

    // Cooldown check
    if (panel.cooldownHours > 0) {
      const since = new Date(Date.now() - panel.cooldownHours * 60 * 60 * 1000);
      const recent = await StaffApplicationSubmission.findOne({
        panelId, guildId, userId: req.user.id, createdAt: { $gte: since },
      }).lean();
      if (recent) {
        const nextAllowed = new Date(recent.createdAt.getTime() + panel.cooldownHours * 60 * 60 * 1000);
        return res.status(429).json({
          error: `You applied too recently. You can apply again after ${nextAllowed.toLocaleString()}.`,
        });
      }
    }

    // Check required role (if configured) — fetch via internal API
    if (panel.requiredRoleId) {
      try {
        const { apiGet } = require("../../lib/botClient");
        const memberData = await apiGet(`/internal/guild/${guildId}/member/${req.user.id}/roles`);
        if (!memberData?.roles?.includes(panel.requiredRoleId)) {
          return res.status(403).json({ error: "You don't have the required role to apply." });
        }
      } catch { /* non-fatal — skip role check if bot unreachable */ }
    }

    // Build answers array, validating required fields
    const { answers: rawAnswers = {} } = req.body;
    const answers = [];
    for (const q of panel.questions) {
      const answer = String(rawAnswers[q.id] || "").trim().slice(0, q.maxLength || 1000);
      if (q.required !== false && !answer) {
        return res.status(400).json({ error: `"${q.label}" is required.` });
      }
      answers.push({ questionId: q.id, label: q.label, answer });
    }

    // Create submission
    const submissionId = nanoid(12);
    const submission = await StaffApplicationSubmission.create({
      guildId,
      panelId,
      submissionId,
      userId:     req.user.id,
      userTag:    req.user.username + (req.user.discriminator && req.user.discriminator !== "0" ? `#${req.user.discriminator}` : ""),
      userAvatar: req.user.avatar || null,
      answers,
      status: "pending",
    });

    // Post to log channel in background
    setImmediate(async () => {
      try {
        if (!panel.logChannelId) return;

        const guild = req.client?.guilds?.cache?.get(guildId);
        const channel = guild
          ? await guild.channels.fetch(panel.logChannelId).catch(() => null)
          : null;
        if (!channel) return;

        const embed = new EmbedBuilder()
          .setColor("#6C53FF")
          .setTitle(`${panel.emoji || "📋"} ${panel.name} — New Application`)
          .setDescription(`**Applicant:** <@${req.user.id}> (${submission.userTag})
**Method:** 🌐 Web form
**Status:** ⏳ Pending`)
          .setFooter({ text: `Submission ID: ${submissionId}` })
          .setTimestamp();

        for (const ans of answers) {
          embed.addFields({ name: ans.label, value: ans.answer?.trim() || "*No answer*", inline: false });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`staffapp_accept:${submissionId}`)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✅"),
          new ButtonBuilder()
            .setCustomId(`staffapp_deny:${submissionId}`)
            .setLabel("Deny")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌"),
        );

        const pingContent = panel.pingRoleId ? `<@&${panel.pingRoleId}>` : undefined;

        const { cbSend } = require("../../lib/cbSend");
        const { messageId, viaCB } = await cbSend(req, guildId, channel, {
          content:    pingContent,
          embeds:     [embed.toJSON()],
          components: [row.toJSON()],
        });

        await StaffApplicationSubmission.updateOne(
          { submissionId },
          { logMessageId: messageId, logChannelId: panel.logChannelId, reviewViaCB: viaCB }
        );
      } catch (err) {
        console.error("[StaffApps WebApply Log]", err.message);
      }
    });

    res.json({ success: true, submissionId });
  } catch (e) {
    console.error("[StaffApps WebApply]", e);
    res.status(500).json({ error: "Failed to submit application." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// List panels
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/staffapps", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const panels = await StaffApplication.find({ guildId: req.params.id }).lean();
    res.json({ success: true, panels });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch panels" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Create panel
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/staffapps", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const count = await StaffApplication.countDocuments({ guildId });
    if (count >= 10) return res.status(400).json({ error: "Maximum 10 application panels per server." });

    // Map legacy frontend field names to schema field names
    const fieldAliases = {
      panelChannel:      "panelChannelId",
      submissionChannel: "logChannelId",
      logChannel:        "logChannelId",
      staffRole:         "staffRoleId",
      requiredRole:      "requiredRoleId",
      pingRole:          "pingRoleId",
      cooldown:          "cooldownHours",
      dmAccept:          "dmOnAccept",
      dmDeny:            "dmOnDeny",
    };
    for (const [alias, canonical] of Object.entries(fieldAliases)) {
      if (req.body[alias] !== undefined && req.body[canonical] === undefined) {
        req.body[canonical] = req.body[alias];
      }
    }
    const {
      name, description, emoji, panelChannelId, logChannelId, resultsChannelId,
      staffRoleId, requiredRoleId, pingRoleId,
      embedColor, embedTitle, embedFooter,
      enabled, dmOnAccept, dmOnDeny, cooldownHours, autoCloseOnAccept,
      questions,
      blacklistedRoleIds, deniedRoleId, deniedRoleDurationHours,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "Panel name is required." });

    // Validate questions
    // Enforce premium tier question limit
    const { getGuildTier } = require("../../../Utils/premiumTiers");
    const _tier = await getGuildTier(guildId);
    const Q_LIMITS = { free: 5, basic: 10, pro: 20, elite: 25 };
    const qLimit   = Q_LIMITS[_tier] ?? 5;

    const qs = (questions || []).slice(0, qLimit).map((q, i) => ({
      id:          q.id?.trim() || `q${i + 1}`,
      label:       String(q.label || q.text || `Question ${i + 1}`).slice(0, 45),
      placeholder: String(q.placeholder || "").slice(0, 100),
      style:       q.style === "paragraph" ? "paragraph" : "short",
      required:    (q.required !== false && q.mandatory !== false),
      minLength:   Math.max(0, parseInt(q.minLength) || 0),
      maxLength:   Math.min(1000, parseInt(q.maxLength) || 1000),
    }));

    const panel = await StaffApplication.create({
      guildId,
      panelId:          nanoid(10),
      name:             name.trim().slice(0, 50),
      description:      String(description || "").slice(0, 500),
      emoji:            String(emoji || "📋").slice(0, 8),
      panelChannelId:   panelChannelId || null,
      logChannelId:     logChannelId   || null,
      resultsChannelId: resultsChannelId || null,
      staffRoleId:      staffRoleId    || null,
      requiredRoleId:   requiredRoleId || null,
      pingRoleId:       pingRoleId     || null,
      embedColor:       embedColor     || "#6C53FF",
      embedTitle:       String(embedTitle || "").slice(0, 100),
      embedFooter:      String(embedFooter || "").slice(0, 100),
      enabled:          enabled !== false,
      dmOnAccept:       dmOnAccept !== false,
      dmOnDeny:         dmOnDeny !== false,
      cooldownHours:    Math.max(0, parseInt(cooldownHours) || 0),
      autoCloseOnAccept:        autoCloseOnAccept === true,
      blacklistedRoleIds:       Array.isArray(blacklistedRoleIds) ? blacklistedRoleIds.filter(Boolean) : [],
      deniedRoleId:             deniedRoleId || null,
      deniedRoleDurationHours:  Math.max(0, parseInt(deniedRoleDurationHours) || 0),
      questions:                qs,
    });

    res.json({ success: true, panel });
  } catch (e) {
    console.error("[StaffApps Create]", e);
    res.status(500).json({ error: "Failed to create panel" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// List ALL submissions across all panels for a guild (no :pid)
// NOTE: Must be before /:pid routes — Express would otherwise capture the
// literal segment "submissions" as a panel ID and return 404 Panel not found.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/staffapps/submissions", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const q = { guildId: req.params.id };
    if (status) q.status = status;
    const [submissions, total] = await Promise.all([
      StaffApplicationSubmission.find(q).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(parseInt(skip)).lean(),
      StaffApplicationSubmission.countDocuments(q),
    ]);
    res.json({ success: true, submissions, total });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Post combined dropdown (multiple panels → one StringSelectMenu message)
// NOTE: Must be before /:pid routes — same reason as above.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/staffapps/post-dropdown", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const { channelId, panelIds, placeholder } = req.body;

    if (!channelId) return res.status(400).json({ error: "channelId is required." });
    if (!Array.isArray(panelIds) || panelIds.length < 2) {
      return res.status(400).json({ error: "Select at least 2 panels to combine." });
    }
    if (panelIds.length > 25) return res.status(400).json({ error: "Maximum 25 panels per dropdown." });

    const panels = await StaffApplication.find({
      guildId,
      panelId: { $in: panelIds },
      enabled: true,
    }).lean();

    if (panels.length < 2) {
      return res.status(400).json({ error: "At least 2 enabled panels are required." });
    }

    const channel = await fetchChannel(req, guildId, channelId);
    if (!channel) return res.status(400).json({ error: "Channel not found or bot lacks access." });

    const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`staffapp_menu:${guildId}`)
      .setPlaceholder(String(placeholder || "Select an application to start").slice(0, 150))
      .addOptions(
        panels.map(p =>
          new StringSelectMenuOptionBuilder()
            .setLabel(p.name.slice(0, 100))
            .setValue(p.panelId)
            .setDescription((p.description || `Apply for ${p.name}`).slice(0, 100))
            .setEmoji(p.emoji && !p.emoji.startsWith("<") ? p.emoji : "📋")
        )
      );

    const row = new ActionRowBuilder().addComponents(menu);

    const embed = new EmbedBuilder()
      .setColor("#6C53FF")
      .setTitle("📋 Staff Applications")
      .setDescription(
        panels.map(p =>
          `${p.emoji || "📋"} **${p.name}**${p.description ? ` — ${p.description.slice(0, 80)}` : ""}`
        ).join("\n")
      )
      .setFooter({ text: `${panels.length} application${panels.length !== 1 ? "s" : ""} available` })
      .setTimestamp();

    const { messageId } = await cbSend(req, guildId, channel, {
      embeds:     [embed.toJSON()],
      components: [row.toJSON()],
    });

    res.json({ success: true, messageId });
  } catch (e) {
    console.error("[StaffApps PostDropdown]", e);
    res.status(500).json({ error: "Failed to post dropdown: " + e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Get single panel
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/staffapps/:pid", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const panel = await StaffApplication.findOne({ panelId: req.params.pid, guildId: req.params.id }).lean();
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    res.json({ success: true, panel });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch panel" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Update panel
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/api/guild/:id/staffapps/:pid", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const panel = await StaffApplication.findOne({ panelId: req.params.pid, guildId: req.params.id });
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    const allowed = [
      "name", "description", "emoji",
      "panelChannelId", "logChannelId", "resultsChannelId",
      "staffRoleId", "requiredRoleId", "pingRoleId",
      "embedColor", "embedTitle", "embedFooter",
      "enabled", "dmMode", "dmOnAccept", "dmOnDeny", "cooldownHours", "autoCloseOnAccept",
      "blacklistedRoleIds", "deniedRoleId", "deniedRoleDurationHours",
      "questions",
    ];

    // Map legacy frontend field names to schema field names
    const fieldAliases = {
      panelChannel:      "panelChannelId",
      submissionChannel: "logChannelId",
      logChannel:        "logChannelId",
      staffRole:         "staffRoleId",
      requiredRole:      "requiredRoleId",
      pingRole:          "pingRoleId",
      cooldown:          "cooldownHours",
      dmAccept:          "dmOnAccept",
      dmDeny:            "dmOnDeny",
    };
    for (const [alias, canonical] of Object.entries(fieldAliases)) {
      if (req.body[alias] !== undefined && req.body[canonical] === undefined) {
        req.body[canonical] = req.body[alias];
      }
    }

    for (const key of allowed) {
      if (req.body[key] !== undefined) panel[key] = req.body[key];
    }

    if (req.body.questions !== undefined) {
      // Enforce premium tier question limit
      const { getGuildTier: _getGuildTier } = require("../../../Utils/premiumTiers");
      const _updateTier = await _getGuildTier(req.params.id);
      const _Q_LIMITS = { free: 5, basic: 10, pro: 20, elite: 25 };
      const _qLimit   = _Q_LIMITS[_updateTier] ?? 5;
      panel.questions = (req.body.questions || []).slice(0, _qLimit).map((q, i) => ({
        id:          q.id?.trim() || `q${i + 1}`,
        label:       String(q.label || q.text || `Question ${i + 1}`).slice(0, 45),
        placeholder: String(q.placeholder || "").slice(0, 100),
        style:       q.style === "paragraph" ? "paragraph" : "short",
        required:    (q.required !== false && q.mandatory !== false),
        minLength:   Math.max(0, parseInt(q.minLength) || 0),
        maxLength:   Math.min(1000, parseInt(q.maxLength) || 1000),
      }));
    }

    await panel.save();
    res.json({ success: true, panel });
  } catch (e) {
    console.error("[StaffApps Update]", e);
    res.status(500).json({ error: "Failed to update panel" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete panel
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/api/guild/:id/staffapps/:pid", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const panel = await StaffApplication.findOneAndDelete({ panelId: req.params.pid, guildId: req.params.id });
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    // Optionally clean up submissions too
    await StaffApplicationSubmission.deleteMany({ panelId: req.params.pid, guildId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete panel" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Post panel button to channel
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/staffapps/:pid/post", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const panel = await StaffApplication.findOne({ panelId: req.params.pid, guildId });
    if (!panel) return res.status(404).json({ error: "Panel not found" });
    if (!panel.panelChannelId) return res.status(400).json({ error: "No panel channel configured." });
    if (!panel.logChannelId)   return res.status(400).json({ error: "No log channel configured." });
    if (!panel.questions?.length) return res.status(400).json({ error: "Add at least one question before posting." });

    const channel = await fetchChannel(req, guildId, panel.panelChannelId);
    if (!channel) return res.status(400).json({ error: "Panel channel not found or bot lacks access." });

    const embed = buildPanelEmbed(panel);
    const row   = buildPanelRow(panel.panelId, `Apply for ${panel.name}`, panel.emoji);

    const { messageId, viaCB } = await cbSend(req, guildId, channel, {
      embeds:     [embed.toJSON()],
      components: [row.toJSON()],
    });

    await StaffApplication.updateOne(
      { panelId: panel.panelId },
      { panelMessageId: messageId, panelViaCB: viaCB }
    );

    res.json({ success: true, messageId });
  } catch (e) {
    console.error("[StaffApps Post Panel]", e);
    res.status(500).json({ error: "Failed to post panel: " + e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// List ALL submissions across all panels for a guild (no :pid)
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// List submissions for a panel
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/staffapps/:pid/submissions", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const q = { guildId: req.params.id, panelId: req.params.pid };
    if (status) q.status = status;

    const [submissions, total] = await Promise.all([
      StaffApplicationSubmission.find(q)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip))
        .lean(),
      StaffApplicationSubmission.countDocuments(q),
    ]);

    res.json({ success: true, submissions, total });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Get single submission
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/staffapps/:pid/submissions/:sid", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const sub = await StaffApplicationSubmission.findOne({
      submissionId: req.params.sid,
      guildId: req.params.id,
    }).lean();
    if (!sub) return res.status(404).json({ error: "Submission not found" });
    res.json({ success: true, submission: sub });
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch submission" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard accept / deny
// ─────────────────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/staffapps/:pid/submissions/:sid/decision", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const { decision, note } = req.body;
    if (!["accepted", "denied"].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'accepted' or 'denied'" });
    }

    const sub = await StaffApplicationSubmission.findOne({
      submissionId: req.params.sid, guildId,
    });
    if (!sub) return res.status(404).json({ error: "Submission not found" });
    if (sub.status !== "pending") return res.status(409).json({ error: `Already ${sub.status}` });

    const panel = await StaffApplication.findOne({ panelId: req.params.pid, guildId });
    if (!panel) return res.status(404).json({ error: "Panel not found" });

    // Update DB
    await StaffApplicationSubmission.updateOne(
      { submissionId: req.params.sid },
      { status: decision, reviewedBy: req.user?.id ?? "dashboard", reviewNote: note || "" }
    );
    sub.status     = decision;
    sub.reviewedBy = req.user?.id ?? "dashboard";
    sub.reviewNote = note || "";

    // Assign role
    if (decision === "accepted" && panel.staffRoleId) {
      try {
        const guild  = req.client?.guilds?.cache?.get(guildId);
        const member = await guild?.members.fetch(sub.userId);
        if (member) await member.roles.add(panel.staffRoleId, "Staff application accepted via dashboard");
      } catch (err) {
        console.warn("[StaffApps Dashboard Decision] role assign:", err.message);
      }
    }

    // DM user
    const dmEnabled = decision === "accepted" ? panel.dmOnAccept : panel.dmOnDeny;
    if (dmEnabled) {
      try {
        const guild = req.client?.guilds?.cache?.get(guildId);
        const { apiPost: _apiPostDm } = require("../../lib/botClient");
        const { EmbedBuilder: E } = require("discord.js");
        const dmEmbed = new E()
          .setTitle(`${panel.emoji || "📋"} Application Update — ${panel.name}`)
          .setColor(decision === "accepted" ? 0x53FF6C : 0xf87171)
          .setDescription(
            decision === "accepted"
              ? `🎉 Your **${panel.name}** application in **${guild?.name ?? "the server"}** has been **accepted**!${note ? `\n\n> ${note}` : ""}`
              : `Your **${panel.name}** application has been **denied**.${note ? `\n\n> ${note}` : ""}`
          )
          .setTimestamp();
        await _apiPostDm(`/internal/user/${sub.userId}/dm`, { embeds: [dmEmbed.toJSON()] });
      } catch (_) {}
    }

    // Update log message
    if (sub.logMessageId && sub.logChannelId) {
      try {
        const { apiPost } = require("../../lib/botClient");
        const updatedEmbed = new EmbedBuilder()
          .setColor(decision === "accepted" ? "#53FF6C" : "#f87171")
          .setTitle(`${panel.emoji || "📋"} ${panel.name} Application — ${decision === "accepted" ? "✅ Accepted" : "❌ Denied"}`)
          .setDescription(`**Applicant:** <@${sub.userId}> (${sub.userTag})\n**Status:** ${decision === "accepted" ? "✅ Accepted" : "❌ Denied"}`)
          .setFooter({ text: `Submission ID: ${sub.submissionId}` })
          .setTimestamp();

        for (const ans of sub.answers) {
          updatedEmbed.addFields({ name: ans.label, value: ans.answer?.trim() || "*No answer*" });
        }
        updatedEmbed.addFields({
          name: decision === "accepted" ? "Accepted by" : "Denied by",
          value: `Dashboard (${req.user?.username ?? "admin"})${note ? `\n> ${note}` : ""}`,
        });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`staffapp_accept:${sub.submissionId}`).setLabel("Accept").setStyle(ButtonStyle.Success).setEmoji("✅").setDisabled(true),
          new ButtonBuilder().setCustomId(`staffapp_deny:${sub.submissionId}`).setLabel("Deny").setStyle(ButtonStyle.Danger).setEmoji("❌").setDisabled(true),
        );

        const editPayload = {
          embeds:     [updatedEmbed.toJSON()],
          components: [disabledRow.toJSON()],
        };

        if (sub.reviewViaCB) {
          await apiPost("/internal/cb/edit", {
            guildId, channelId: sub.logChannelId, messageId: sub.logMessageId, payload: editPayload,
          });
        } else {
          await apiPost(`/internal/guild/${guildId}/channel/${sub.logChannelId}/message/${sub.logMessageId}/edit`, editPayload);
        }
      } catch (err) {
        console.warn("[StaffApps Dashboard Decision] log edit:", err.message);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("[StaffApps Dashboard Decision]", e);
    res.status(500).json({ error: "Failed to process decision: " + e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Premium tier info — used by frontend to set question limits
// ─────────────────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/premium/tier", isAuth, async (req, res) => {
  try {
    const { getGuildTier } = require("../../../Utils/premiumTiers");
    const tier = await getGuildTier(req.params.id);
    res.json({ tier });
  } catch (e) {
    res.json({ tier: "free" });
  }
});

module.exports = router;