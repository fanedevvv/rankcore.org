/**
 * Message Templates — Express Router
 *
 * Stores message templates in a local SQLite database (templates.db).
 * Falls back gracefully if better-sqlite3 is unavailable.
 *
 * Routes:
 *   GET    /guild/:id/templates                        → serve HTML page
 *   GET    /api/guild/:id/templates                    → list all templates
 *   GET    /api/guild/:id/templates/:tid               → get one template
 *   POST   /api/guild/:id/templates                    → create template
 *   PUT    /api/guild/:id/templates/:tid               → update template
 *   DELETE /api/guild/:id/templates/:tid               → delete template
 *   POST   /api/guild/:id/templates/verify-webhook     → verify webhook ownership
 *   POST   /api/guild/:id/templates/:tid/send          → send via channel OR webhook
 */

const router  = require("express").Router();
const path    = require("path");
const crypto  = require("crypto");
const https   = require("https");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');

// ── SQLite setup ──────────────────────────────────────────────────────────────

let db = null;

function getDb() {
  if (db) return db;
  try {
    const Database = require("better-sqlite3");
    const dbPath   = path.join(__dirname, "../../../../data/templates.db");

    const fs = require("fs");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    db.exec(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id          TEXT PRIMARY KEY,
        guild_id    TEXT NOT NULL,
        name        TEXT NOT NULL DEFAULT 'Unnamed',
        description TEXT DEFAULT '',
        tags        TEXT DEFAULT '[]',
        type        TEXT NOT NULL DEFAULT 'text',
        data        TEXT NOT NULL DEFAULT '{}',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_templates_guild ON message_templates (guild_id);
      CREATE INDEX IF NOT EXISTS idx_templates_type  ON message_templates (guild_id, type);
    `);

    console.log("[Templates] SQLite database initialized:", dbPath);
    return db;
  } catch (err) {
    console.warn("[Templates] SQLite unavailable, falling back to in-memory Map:", err.message);
    return null;
  }
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const memStore = new Map();

function memGet(guildId)         { return [...(memStore.get(guildId)?.values() || [])]; }
function memGetOne(guildId, id)  { return memStore.get(guildId)?.get(id) || null; }
function memSet(guildId, t)      { if (!memStore.has(guildId)) memStore.set(guildId, new Map()); memStore.get(guildId).set(t.id, t); }
function memDel(guildId, id)     { memStore.get(guildId)?.delete(id); }

// ── Storage abstraction ───────────────────────────────────────────────────────

function storageList(guildId) {
  const db = getDb();
  if (db) return db.prepare("SELECT * FROM message_templates WHERE guild_id = ? ORDER BY updated_at DESC").all(guildId).map(deserializeRow);
  return memGet(guildId);
}

function storageGet(guildId, id) {
  const db = getDb();
  if (db) { const row = db.prepare("SELECT * FROM message_templates WHERE guild_id = ? AND id = ?").get(guildId, id); return row ? deserializeRow(row) : null; }
  return memGetOne(guildId, id);
}

function storageCreate(guildId, template) {
  const db  = getDb();
  const now = new Date().toISOString();
  const row = {
    id:          template.id,
    guild_id:    guildId,
    name:        template.name        || "Unnamed",
    description: template.description || "",
    tags:        JSON.stringify(template.tags || []),
    type:        template.type        || "text",
    data:        JSON.stringify(buildDataPayload(template)),
    created_at:  now,
    updated_at:  now,
  };
  if (db) {
    db.prepare(`INSERT INTO message_templates (id,guild_id,name,description,tags,type,data,created_at,updated_at) VALUES (@id,@guild_id,@name,@description,@tags,@type,@data,@created_at,@updated_at)`).run(row);
  } else {
    memSet(guildId, { ...template, createdAt: now, updatedAt: now });
  }
}

function storageUpdate(guildId, id, template) {
  const db  = getDb();
  const now = new Date().toISOString();
  if (db) {
    const result = db.prepare(`UPDATE message_templates SET name=@name,description=@description,tags=@tags,type=@type,data=@data,updated_at=@updated_at WHERE guild_id=@guild_id AND id=@id`).run({
      guild_id:    guildId, id,
      name:        template.name        || "Unnamed",
      description: template.description || "",
      tags:        JSON.stringify(template.tags || []),
      type:        template.type        || "text",
      data:        JSON.stringify(buildDataPayload(template)),
      updated_at:  now,
    });
    return result.changes > 0;
  }
  const existing = memGetOne(guildId, id);
  if (!existing) return false;
  memSet(guildId, { ...existing, ...template, id, updatedAt: now });
  return true;
}

function storageDelete(guildId, id) {
  const db = getDb();
  if (db) db.prepare("DELETE FROM message_templates WHERE guild_id = ? AND id = ?").run(guildId, id);
  else memDel(guildId, id);
}

// ── Serialization ─────────────────────────────────────────────────────────────

function deserializeRow(row) {
  let data = {}, tags = [];
  try { data = JSON.parse(row.data); } catch {}
  try { tags = JSON.parse(row.tags); } catch {}
  return { id: row.id, guildId: row.guild_id, name: row.name, description: row.description, tags, type: row.type, createdAt: row.created_at, updatedAt: row.updated_at, ...data };
}

function buildDataPayload(template) {
  const payload = {};
  const t = template.type || "text";
  if (t === "text")  { payload.content      = (template.content || "").slice(0, 2000); }
  if (t === "embed") { payload.plainText    = (template.plainText || "").slice(0, 2000); payload.embed = sanitizeEmbed(template.embed || {}); }
  if (t === "v2")    { payload.v2Components = Array.isArray(template.v2Components) ? template.v2Components.slice(0, 40) : []; }
  if (template.buttons?.components?.length) payload.buttons = sanitizeButtons(template.buttons);
  return payload;
}

function sanitizeEmbed(e) {
  return {
    color: e.color || "#6C53FF", title: (e.title||"").slice(0,256), description: (e.description||"").slice(0,4096),
    authorName: (e.authorName||"").slice(0,256), authorIcon: e.authorIcon||"", thumbnail: e.thumbnail||"",
    image: e.image||"", footerText: (e.footerText||"").slice(0,2048), footerIcon: e.footerIcon||"",
    timestamp: !!e.timestamp,
    fields: Array.isArray(e.fields) ? e.fields.slice(0,25).map(f=>({ name:(f.name||"").slice(0,256), value:(f.value||"").slice(0,1024), inline:!!f.inline })) : [],
  };
}

function sanitizeButtons(row) {
  if (!Array.isArray(row.components)) return undefined;
  return {
    type: 1,
    components: row.components.slice(0,5).map(b => ({
      type: 2, label: (b.label||"").slice(0,80), style: Number(b.style)||1,
      custom_id: b.style==5 ? undefined : (b.custom_id||`btn_${Math.random().toString(36).slice(2,8)}`),
      url: b.style==5 ? (b.url||"") : undefined, disabled: !!b.disabled,
      emoji: b.emoji?.name ? { name: b.emoji.name } : undefined,
      _action: b._action?.type && b._action.type!=="none" ? b._action : undefined,
    })),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(["text", "embed", "v2"]);

function validateTemplate(body) {
  const errors = [];
  if (!body.name?.trim())                     errors.push("Template name is required");
  if (!VALID_TYPES.has(body.type))            errors.push(`Invalid type. Must be: ${[...VALID_TYPES].join(", ")}`);
  if (body.type==="text"  && !body.content?.trim())                              errors.push("Content required for text templates");
  if (body.type==="embed" && !body.embed?.title && !body.embed?.description)    errors.push("Embed needs a title or description");
  if (body.type==="v2"    && (!Array.isArray(body.v2Components)||!body.v2Components.length)) errors.push("V2 template needs at least one component");
  return errors;
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

/**
 * Parse a Discord webhook URL into { id, token } or null.
 */
function parseWebhookUrl(url) {
  const m = (url||"").match(/discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_\-]+)/);
  return m ? { id: m[1], token: m[2] } : null;
}

/**
 * Fetch webhook info from Discord REST to verify guild ownership.
 * Returns the webhook object or throws.
 */
function fetchDiscordWebhook(id, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "discord.com",
      path:     `/api/v10/webhooks/${id}/${token}`,
      method:   "GET",
      headers:  { "User-Agent": "NoxxDashboard/1.0" },
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error("Invalid webhook response")); }
        } else if (res.statusCode === 404) {
          reject(new Error("Webhook not found or token is invalid"));
        } else {
          reject(new Error(`Discord returned ${res.statusCode}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("Webhook fetch timed out")); });
    req.end();
  });
}

// ── Discord payload builders ──────────────────────────────────────────────────

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, WebhookClient, MessageFlags } = require("discord.js");
const { apiPost } = require("../../lib/botClient");

function buildEmbedObj(embedData) {
  const eb = new EmbedBuilder();
  if (!embedData) return eb;
  if (embedData.color)       eb.setColor(embedData.color);
  if (embedData.title)       eb.setTitle(embedData.title.slice(0,256));
  if (embedData.description) eb.setDescription(embedData.description.slice(0,4096));
  if (embedData.authorName)  eb.setAuthor({ name: embedData.authorName.slice(0,256), iconURL: embedData.authorIcon||undefined });
  if (embedData.thumbnail)   eb.setThumbnail(embedData.thumbnail);
  if (embedData.image)       eb.setImage(embedData.image);
  if (embedData.footerText)  eb.setFooter({ text: embedData.footerText.slice(0,2048), iconURL: embedData.footerIcon||undefined });
  if (embedData.timestamp)   eb.setTimestamp();
  if (Array.isArray(embedData.fields)) {
    for (const f of embedData.fields.slice(0,25)) {
      if (f.name && f.value) eb.addFields({ name: f.name.slice(0,256), value: f.value.slice(0,1024), inline: !!f.inline });
    }
  }
  return eb;
}

function buildButtonRow(buttonsData) {
  if (!buttonsData?.components?.length) return null;
  const row = new ActionRowBuilder();
  for (const b of buttonsData.components.slice(0,5)) {
    if (!b.label) continue;
    const btn = new ButtonBuilder().setLabel(b.label).setStyle(Number(b.style)||1).setDisabled(!!b.disabled);
    if (Number(b.style)===5) btn.setURL(b.url||"https://example.com");
    else btn.setCustomId(b.custom_id||`tpl_${Math.random().toString(36).slice(2,8)}`);
    if (b.emoji?.name) btn.setEmoji(b.emoji.name);
    try { row.addComponents(btn); } catch {}
  }
  return row.components.length ? row : null;
}

function buildDiscordPayload(template) {
  const payload = { allowedMentions: { parse: [] } };

  if (template.type === "text") {
    payload.content = template.content || "";
  } else if (template.type === "embed") {
    if (template.plainText) payload.content = template.plainText;
    payload.embeds = [buildEmbedObj(template.embed)];
  } else if (template.type === "v2") {
    payload.flags      = MessageFlags.IsComponentsV2 ?? (1 << 15);
    payload.components = template.v2Components || [];
    return payload; // V2 can't mix with action row buttons or embeds
  }

  const row = buildButtonRow(template.buttons);
  if (row) payload.components = [row];

  return payload;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Serve page
router.get("/guild/:id/templates", isAuth, checkDashboardAccess('welcome'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/messagetemplates.html"))
);

// List
router.get("/api/guild/:id/templates", isAuth, checkDashboardAccess('welcome'), (req, res) => {
  try {
    let data = storageList(req.params.id);
    const { type, tag } = req.query;
    if (type && VALID_TYPES.has(type)) data = data.filter(t => t.type === type);
    if (tag)                           data = data.filter(t => (t.tags||[]).includes(tag));
    res.json({ total: data.length, data });
  } catch (err) {
    console.error("[templates GET list]", err.message);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get one
router.get("/api/guild/:id/templates/:tid", isAuth, checkDashboardAccess('welcome'), (req, res) => {
  try {
    const t = storageGet(req.params.id, req.params.tid);
    if (!t) return res.status(404).json({ error: "Template not found" });
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Create
router.post("/api/guild/:id/templates", isAuth, checkDashboardAccess('welcome'), (req, res) => {
  try {
    const errors = validateTemplate(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });
    if (storageList(req.params.id).length >= 100) return res.status(400).json({ error: "Maximum 100 templates per guild" });
    const template = { ...req.body, id: `tpl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`, guildId: req.params.id };
    storageCreate(req.params.id, template);
    res.json({ success: true, id: template.id });
  } catch (err) {
    console.error("[templates POST]", err.message);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Sync bulk
router.post("/api/guild/:id/templates/sync", isAuth, checkDashboardAccess('welcome'), (req, res) => {
  try {
    if (!Array.isArray(req.body.templates)) return res.status(400).json({ error: "Expected {templates:[...]}" });
    const existingIds = new Set(storageList(req.params.id).map(t => t.id));
    for (const t of req.body.templates.slice(0, 100)) {
      if (!t.id || !t.name) continue;
      existingIds.has(t.id) ? storageUpdate(req.params.id, t.id, t) : storageCreate(req.params.id, t);
    }
    res.json({ success: true, synced: req.body.templates.length });
  } catch (err) {
    console.error("[templates sync]", err.message);
    res.status(500).json({ error: "Failed to sync templates" });
  }
});

// Update
router.put("/api/guild/:id/templates/:tid", isAuth, checkDashboardAccess('welcome'), (req, res) => {
  try {
    const errors = validateTemplate(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });
    const updated = storageUpdate(req.params.id, req.params.tid, req.body);
    if (!updated) return res.status(404).json({ error: "Template not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("[templates PUT]", err.message);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete
router.delete("/api/guild/:id/templates/:tid", isAuth, checkDashboardAccess('welcome'), (req, res) => {
  try {
    storageDelete(req.params.id, req.params.tid);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ── VERIFY WEBHOOK OWNERSHIP ──────────────────────────────────────────────────
/**
 * POST /api/guild/:id/templates/verify-webhook
 * Body: { webhookUrl: string }
 *
 * Fetches the webhook from Discord REST and confirms its guild_id matches.
 * Returns { valid:true, id, token, name } or { valid:false, error }.
 */
router.post("/api/guild/:id/templates/verify-webhook", isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  const { webhookUrl } = req.body;

  if (!webhookUrl) return res.status(400).json({ valid: false, error: "webhookUrl is required" });

  const parsed = parseWebhookUrl(webhookUrl);
  if (!parsed) return res.status(400).json({ valid: false, error: "Not a valid Discord webhook URL" });

  try {
    const wh = await fetchDiscordWebhook(parsed.id, parsed.token);

    // guild_id check — the guild_id on the webhook object must match the requested guild
    if (wh.guild_id !== req.params.id) {
      return res.status(403).json({
        valid: false,
        error: "This webhook does not belong to this server.",
      });
    }

    return res.json({
      valid: true,
      id:    wh.id,
      token: parsed.token,  // don't send back from Discord response; use parsed token
      name:  wh.name || "Webhook",
      channelId: wh.channel_id,
    });
  } catch (err) {
    console.error("[verify-webhook]", err.message);
    return res.status(400).json({ valid: false, error: err.message });
  }
});

// ── SEND TEMPLATE ─────────────────────────────────────────────────────────────
/**
 * POST /api/guild/:id/templates/:tid/send
 *
 * Send via channel:
 *   Body: { channelId: string }
 *
 * Send via webhook:
 *   Body: { webhookId: string, webhookToken: string, username?: string, avatarUrl?: string }
 *   OR:   { webhookUrl: string, username?: string, avatarUrl?: string }
 *
 * Webhooks are always re-verified server-side before sending.
 */
router.post("/api/guild/:id/templates/:tid/send", isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  const guildId = req.params.id;
  const tid     = req.params.tid;

  // Load template
  const template = storageGet(guildId, tid);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const payload = buildDiscordPayload(template);

  // ── Send via webhook ──────────────────────────────────────────────────────
  if (req.body.webhookId || req.body.webhookUrl) {
    let id, token;

    if (req.body.webhookUrl) {
      const parsed = parseWebhookUrl(req.body.webhookUrl);
      if (!parsed) return res.status(400).json({ error: "Invalid webhook URL" });
      id    = parsed.id;
      token = parsed.token;
    } else {
      id    = req.body.webhookId;
      token = req.body.webhookToken;
    }

    if (!id || !token) return res.status(400).json({ error: "webhookId and webhookToken are required" });

    // ── Re-verify guild ownership server-side ──────────────────────────────
    try {
      const wh = await fetchDiscordWebhook(id, token);
      if (wh.guild_id !== guildId) {
        return res.status(403).json({ error: "Webhook does not belong to this server." });
      }
    } catch (err) {
      return res.status(400).json({ error: `Webhook verification failed: ${err.message}` });
    }

    // ── Send ───────────────────────────────────────────────────────────────
    try {
      const wc = new WebhookClient({ id, token });

      const whPayload = { ...payload };
      if (req.body.username)  whPayload.username  = req.body.username.slice(0, 80);
      if (req.body.avatarUrl) whPayload.avatarURL = req.body.avatarUrl;

      // WebhookClient doesn't support Components V2 flags yet in all djs versions
      // Pass through flags as-is; djs will handle it
      await wc.send(whPayload);
      wc.destroy();

      return res.json({ success: true, method: "webhook" });
    } catch (err) {
      console.error("[templates send webhook]", err.message);
      return res.status(500).json({ error: err.message || "Failed to send via webhook" });
    }
  }

  // ── Send via channel ─────────────────────────────────────────────────────
  // Uses the internal bot API (port 5182) so this works in standalone dashboard
  // mode without needing direct access to the Discord.js client process.
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: "channelId or webhookId is required" });

  try {
    // Serialise file attachments to base64 so they survive the JSON hop
    const internalPayload = { ...payload };
    if (Array.isArray(payload.files) && payload.files.length) {
      internalPayload.files = payload.files.map(f => {
        const buf = f.attachment ?? f;
        const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
        return { name: f.name || 'file.png', data: raw.toString('base64'), contentType: f.contentType || 'image/png' };
      });
    }

    await apiPost(`/internal/guild/${guildId}/channel/${channelId}/send`, internalPayload);
    return res.json({ success: true, method: "channel" });
  } catch (err) {
    console.error("[templates send channel]", err.message);
    // Translate bot-offline error into a friendlier message
    if (err.isBotOffline) return res.status(503).json({ error: "Bot is offline — cannot send message right now." });
    return res.status(500).json({ error: err.message || "Failed to send to channel" });
  }
});

module.exports = router;