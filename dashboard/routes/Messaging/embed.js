"use strict";

const embedCooldowns = new Map();
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { EmbedBuilder, PermissionsBitField }           = require("discord.js");
const router   = require("express").Router();
const path     = require("path");
const { logEmbedSend } = require("../Utils/dashboardLoggers");
const { getLimits, limitError } = require("../Utils/limits");

// Resolve messageSaver correctly regardless of route location
const messageSaver = require("../../lib/messageSaver");

// CB-aware sender — routes through Custom Branding bot when active
const { cbSend } = require("../../lib/cbSend");

// Button action persistence
const EmbedButtonAction = require("../../../Schemas/embedButtonActionSchema");

// Valid action types for whitelist validation
const VALID_ACTION_TYPES = new Set(['none', 'reply', 'dm', 'role_add', 'role_remove', 'role_toggle']);

const FREE_MAX_SAVED = 10;   // free tier per guild (was 50 flat)
const COOLDOWN_MS = 10_000;

// ─── Page ─────────────────────────────────────────────────────────────────────
router.get("/guild/:id/embed", isAuth, checkDashboardAccess('embed'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/embed.html"))
);

// ─── Send Message ─────────────────────────────────────────────────────────────
router.post("/api/guild/:id/embed/send", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  const userId  = req.user.id;
  const guildId = req.params.id;

  // Cooldown
  const lastSend = embedCooldowns.get(userId);
  if (lastSend && Date.now() - lastSend < COOLDOWN_MS)
    return res.status(429).json({ error: `Cooldown — wait ${Math.ceil((COOLDOWN_MS - (Date.now() - lastSend)) / 1000)}s before sending again.` });

  const { type = "embed", channelId, content, embed, components, flags } = req.body;

  if (content && typeof content === "string" && content.length > 2000)
    return res.status(400).json({ error: "Message content must be 2000 characters or fewer." });

  const guild   = req.client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.get(channelId);
  if (!channel?.isTextBased())
    return res.status(400).json({ error: "Invalid or missing channel." });

  try {
    let msg;

    // ── Classic Embed (+ optional button rows from embed_v1 mode) ────────────
    if (type === "embed") {
      let safeEmbed;
      if (embed && Object.keys(embed).length) {
        try { safeEmbed = new EmbedBuilder(embed); }
        catch { safeEmbed = new EmbedBuilder().setTitle("Embed").setDescription("Invalid embed data.").setColor("#FF0000"); }
      }
      const msgPayload = {
        content:    content || undefined,
        embeds:     safeEmbed ? [safeEmbed.toJSON()] : undefined,
        components: components?.length ? sanitizeV1Components(components) : undefined,
      };
      ({ messageId: msg } = await cbSend(req, guildId, channel, msgPayload));
      msg = { id: msg };
    }

    // ── Components V1 ────────────────────────────────────────────────────────
    else if (type === "v1") {
      if (!components?.length)
        return res.status(400).json({ error: "V1 messages require at least one action row." });
      const v1Payload = {
        content: content || undefined,
        components: sanitizeV1Components(components),
      };
      ({ messageId: msg } = await cbSend(req, guildId, channel, v1Payload));
      msg = { id: msg };
    }

    // ── Components V2 ────────────────────────────────────────────────────────
    else if (type === "v2") {
      if (!components?.length)
        return res.status(400).json({ error: "V2 messages require at least one component." });

      const restPayload = {
        content: content || undefined,
        components: sanitizeV2Components(components),
        flags: 32768, // IS_COMPONENTS_V2
      };
      try {
        ({ messageId: msg } = await cbSend(req, guildId, channel, restPayload));
        msg = { id: msg };
      } catch (djsErr) {
        const restResult = await req.client.rest.post(`/channels/${channel.id}/messages`, { body: restPayload });
        msg = { id: restResult?.id };
      }
    }

    else { return res.status(400).json({ error: `Unknown message type: ${type}` }); }

    logEmbedSend({ userId, guildId, channelId: channel.id, command: `dashboard_${type}_send`,
      content, embed: type === "embed" ? embed : undefined,
      components: type !== "embed" ? components : undefined,
      messageId: msg?.id || null, timestamp: new Date().toISOString() });

    embedCooldowns.set(userId, Date.now());
    res.json({ success: true, messageId: msg?.id });
  } catch (err) {
    console.error("Embed send error:", err);
    res.status(500).json({ error: `Failed to send message: ${err.message}` });
  }
});

// ─── Saved Messages — List ────────────────────────────────────────────────────
router.get("/api/guild/:id/embed/saved", isAuth, checkDashboardAccess('embed'), (req, res) => {
  try {
    const msgs = messageSaver.listMessages(req.params.id);
    res.json({ success: true, messages: msgs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Saved Messages — Create / Update ────────────────────────────────────────
router.post("/api/guild/:id/embed/saved", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  const guildId = req.params.id;
  const { id, name, type, payload } = req.body;

  if (!name || !type || !payload)
    return res.status(400).json({ error: "name, type and payload are required." });

  // Enforce per-guild limit (skip if updating existing)
  if (!id) {
    const lim = await getLimits(req.user?.id, guildId);
    const cap = lim.savedEmbeds;
    if (messageSaver.countMessages(guildId) >= cap)
      return res.status(400).json({ error: limitError(lim, 'saved embeds') });
  }

  try {
    const record = messageSaver.saveMessage(guildId, req.user.id, { id, name, type, payload });
    res.json({ success: true, message: record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Saved Messages — Get One ─────────────────────────────────────────────────
router.get("/api/guild/:id/embed/saved/:msgId", isAuth, checkDashboardAccess('embed'), (req, res) => {
  const record = messageSaver.getMessage(req.params.id, req.params.msgId);
  if (!record) return res.status(404).json({ error: "Message not found." });
  res.json({ success: true, message: record });
});

// ─── Saved Messages — Delete ──────────────────────────────────────────────────
router.delete("/api/guild/:id/embed/saved/:msgId", isAuth, checkDashboardAccess('embed'), (req, res) => {
  const deleted = messageSaver.deleteMessage(req.params.id, req.params.msgId);
  if (!deleted) return res.status(404).json({ error: "Message not found." });
  res.json({ success: true });
});

// ─── Saved Messages — Duplicate ───────────────────────────────────────────────
router.post("/api/guild/:id/embed/saved/:msgId/duplicate", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  const guildId = req.params.id;
  const lim = await getLimits(req.user?.id, guildId);
  if (messageSaver.countMessages(guildId) >= lim.savedEmbeds)
    return res.status(400).json({ error: limitError(lim, 'saved embeds') });
  try {
    const record = messageSaver.duplicateMessage(guildId, req.params.msgId, req.user.id, req.body.name);
    res.json({ success: true, message: record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Button Actions — Get all for guild ───────────────────────────────────────
router.get("/api/guild/:id/embed/button-actions", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  try {
    const actions = await EmbedButtonAction.find({ Guild: req.params.id }).lean();
    res.json({ success: true, actions });
  } catch (err) {
    res.status(500).json({ error: "Failed to load button actions." });
  }
});

// ─── Button Actions — Upsert one ──────────────────────────────────────────────
router.post("/api/guild/:id/embed/button-actions", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  const { customId, actionType, replyContent, replyEphemeral, roleId } = req.body;

  // Validate customId format
  if (!customId || typeof customId !== "string" || customId.length < 1 || customId.length > 100)
    return res.status(400).json({ error: "customId must be a string of 1–100 characters." });

  if (!VALID_ACTION_TYPES.has(actionType))
    return res.status(400).json({ error: `Invalid actionType. Valid values: ${[...VALID_ACTION_TYPES].join(", ")}.` });

  // Validate role ID looks like a snowflake when provided
  if (roleId && !/^\d{17,20}$/.test(roleId))
    return res.status(400).json({ error: "roleId must be a valid Discord snowflake." });

  if (replyContent && typeof replyContent === "string" && replyContent.length > 2000)
    return res.status(400).json({ error: "Reply content must be 2000 characters or fewer." });

  try {
    const doc = await EmbedButtonAction.findOneAndUpdate(
      { Guild: req.params.id, CustomId: customId },
      {
        ActionType:     actionType      || "none",
        ReplyContent:   replyContent    || "",
        ReplyEphemeral: replyEphemeral !== false,
        RoleId:         roleId          || "",
        UpdatedAt:      new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, action: doc });
  } catch (err) {
    console.error("Button action save error:", err);
    res.status(500).json({ error: "Failed to save button action." });
  }
});

// ─── Button Actions — Delete one ──────────────────────────────────────────────
router.delete("/api/guild/:id/embed/button-actions/:customId", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  try {
    await EmbedButtonAction.deleteOne({ Guild: req.params.id, CustomId: req.params.customId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete button action." });
  }
});

// ─── Guild roles (for action picker dropdowns) ────────────────────────────────
router.get("/api/guild/:id/roles", isAuth, checkDashboardAccess('embed'), async (req, res) => {
  try {
    const client = req.client || req.app.get("client");
    if (!client) return res.json([]);
    
    const guildId = req.params.id;
    const guild = client.guilds.cache?.get(guildId);
    if (!guild) return res.json([]);
    
    // Try to use cached roles first
    let roles = guild.roles?.cache?.size ? guild.roles.cache : null;
    
    // If cache is empty, fetch from internal API (for BotClientShim compatibility)
    if (!roles || roles.size === 0) {
      try {
        // Check if client has apiGet method (BotClientShim)
        if (typeof client.apiGet === 'function') {
          const rolesData = await client.apiGet(`/internal/guild/${guildId}/roles`);
          if (!Array.isArray(rolesData)) return res.json([]);
          
          // Map API response to role objects
          const list = rolesData
            .filter(r => !r.managed && r.name !== "@everyone")
            .sort((a, b) => b.position - a.position)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
          
          return res.json(list);
        }
      } catch (err) {
        console.warn(`Failed to fetch roles from internal API for guild ${guildId}:`, err.message);
      }
      
      // If internal API didn't work, return empty
      return res.json([]);
    }
    
    // Use cached roles
    const list = [...roles.values()]
      .filter(r => !r.managed && r.name !== "@everyone")
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor }));
    
    res.json(list);
  } catch (err) {
    console.error("Roles fetch error:", err);
    res.status(500).json({ error: "Failed to fetch roles." });
  }
});

// ─── Component Sanitisers ─────────────────────────────────────────────────────

function sanitizeV1Components(rows) {
  return rows.slice(0, 5).map(row => ({
    type: 1,
    components: (row.components || []).slice(0, 5).map(btn => {
      const style = Number(btn.style) || 1;
      const base  = { type: 2, label: String(btn.label || "Button").slice(0, 80), style, disabled: btn.disabled === true };
      if (style === 5) base.url = btn.url || "https://example.com";
      else base.custom_id = String(btn.custom_id || `btn_${Math.random().toString(36).slice(2, 8)}`).slice(0, 100);
      if (btn.emoji) base.emoji = btn.emoji;
      return base;
    }),
  }));
}

function sanitizeV2Components(comps) {
  return comps.slice(0, 40).map(comp => {
    const type = Number(comp.type);
    if (type === 10) return { type: 10, content: String(comp.content || "").slice(0, 4000) };
    if (type === 14) return { type: 14, divider: comp.divider !== false, spacing: comp.spacing || 1 };
    if (type === 9) {
      const section = { type: 9, components: (comp.components || []).slice(0, 3).map(c => ({ type: 10, content: String(c.content || "").slice(0, 4000) })) };
      if (comp.accessory?.type === 2) section.accessory = { type: 2, label: String(comp.accessory.label || "Button").slice(0, 80), style: Number(comp.accessory.style) || 1, custom_id: String(comp.accessory.custom_id || `sec_${Math.random().toString(36).slice(2)}`).slice(0, 100) };
      else if (comp.accessory?.type === 11) section.accessory = { type: 11, media: { url: String(comp.accessory.media?.url || "") } };
      return section;
    }
    if (type === 12) return { type: 12, items: (comp.items || []).slice(0, 10).map(item => ({ media: { url: String(item.media?.url || item.url || "") }, description: item.description ? String(item.description).slice(0, 1024) : undefined })) };
    if (type === 1) {
      return {
        type: 1,
        components: (comp.components || []).slice(0, 5).map(btn => {
          const style = Number(btn.style) || 1;
          const base  = { type: 2, label: String(btn.label || "Button").slice(0, 80), style, disabled: btn.disabled === true };
          if (style === 5) base.url = btn.url || "https://example.com";
          else base.custom_id = String(btn.custom_id || `btn_${Math.random().toString(36).slice(2, 8)}`).slice(0, 100);
          if (btn.emoji) base.emoji = btn.emoji;
          return base;
        }),
      };
    }
    return comp;
  });
}

module.exports = router;