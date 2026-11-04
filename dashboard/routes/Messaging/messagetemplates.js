'use strict';
/**
 * Message Templates — Express Router
 *
 * Stores message templates in MongoDB via Schemas/messageTemplateSchema.js.
 * Replaces the old SQLite (better-sqlite3) storage.
 *
 * Routes:
 *   GET    /guild/:id/templates                        → serve HTML page
 *   GET    /api/guild/:id/templates                    → list all templates
 *   GET    /api/guild/:id/templates/:tid               → get one template
 *   POST   /api/guild/:id/templates                    → create template
 *   PUT    /api/guild/:id/templates/:tid               → update template
 *   DELETE /api/guild/:id/templates/:tid               → delete template
 *   POST   /api/guild/:id/templates/sync               → bulk upsert
 *   POST   /api/guild/:id/templates/verify-webhook     → verify webhook ownership
 *   POST   /api/guild/:id/templates/:tid/send          → send via channel OR webhook
 */

const router  = require('express').Router();
const path    = require('path');
const crypto  = require('crypto');
const https   = require('https');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const MessageTemplate = require('../../../Schemas/messageTemplateSchema');

// ── Serialization ─────────────────────────────────────────────────────────────

/**
 * Flatten a MongoDB doc into the shape the frontend expects:
 * top-level fields + all data fields spread out.
 */
function serialize(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const { _id, __v, data, ...rest } = obj;
  return { ...rest, ...(data || {}) };
}

function buildDataPayload(template) {
  const payload = {};
  const t = template.type || 'text';
  if (t === 'text')  { payload.content       = (template.content  || '').slice(0, 2000); }
  if (t === 'embed') { payload.plainText      = (template.plainText || '').slice(0, 2000); payload.embed = sanitizeEmbed(template.embed || {}); }
  if (t === 'v2')    { payload.v2Components   = Array.isArray(template.v2Components) ? template.v2Components.slice(0, 40) : []; }
  if (template.buttons?.components?.length) payload.buttons = sanitizeButtons(template.buttons);
  if (Array.isArray(template.selectMenus) && template.selectMenus.length) payload.selectMenus = sanitizeSelectMenus(template.selectMenus);
  return payload;
}

function sanitizeEmbed(e) {
  return {
    color:       e.color || '#6C53FF',
    title:       (e.title       || '').slice(0, 256),
    description: (e.description || '').slice(0, 4096),
    authorName:  (e.authorName  || '').slice(0, 256),
    authorIcon:  e.authorIcon  || '',
    thumbnail:   e.thumbnail   || '',
    image:       e.image       || '',
    footerText:  (e.footerText  || '').slice(0, 2048),
    footerIcon:  e.footerIcon  || '',
    timestamp:   !!e.timestamp,
    fields: Array.isArray(e.fields)
      ? e.fields.slice(0, 25).map(f => ({
          name:   (f.name  || '').slice(0, 256),
          value:  (f.value || '').slice(0, 1024),
          inline: !!f.inline,
        }))
      : [],
  };
}

function sanitizeButtons(row) {
  if (!Array.isArray(row.components)) return undefined;
  return {
    type: 1,
    components: row.components.slice(0, 5).map(b => ({
      type:      2,
      label:     (b.label || '').slice(0, 80),
      style:     Number(b.style) || 1,
      custom_id: b.style == 5 ? undefined : (b.custom_id || `btn_${Math.random().toString(36).slice(2, 8)}`),
      url:       b.style == 5 ? (b.url || '') : undefined,
      disabled:  !!b.disabled,
      emoji:     b.emoji?.name ? { name: b.emoji.name } : undefined,
      _action:   b._action?.type && b._action.type !== 'none' ? b._action : undefined,
    })),
  };
}

function sanitizeSelectMenus(menus) {
  if (!Array.isArray(menus)) return [];
  return menus.slice(0, 5).map(m => ({
    type:        3,
    custom_id:   (m.custom_id || `sel_${Math.random().toString(36).slice(2, 8)}`).slice(0, 100),
    placeholder: (m.placeholder || '').slice(0, 150),
    min_values:  Math.min(Math.max(parseInt(m.min_values) || 1, 0), 25),
    max_values:  Math.min(Math.max(parseInt(m.max_values) || 1, 1), 25),
    disabled:    !!m.disabled,
    options:     Array.isArray(m.options)
      ? m.options.slice(0, 25).map(o => ({
          label:       (o.label || 'Option').slice(0, 100),
          value:       (o.value || o.label || '').slice(0, 100),
          description: (o.description || '').slice(0, 100),
          default:     !!o.default,
          emoji:       o.emoji?.name ? { name: o.emoji.name } : undefined,
          _action:     o._action?.type && o._action.type !== 'none' ? o._action : undefined,
        }))
      : [],
  })).filter(m => m.options.length > 0);
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['text', 'embed', 'v2']);

function validateTemplate(body) {
  const errors = [];
  if (!body.name?.trim())          errors.push('Template name is required');
  if (!VALID_TYPES.has(body.type)) errors.push(`Invalid type. Must be: ${[...VALID_TYPES].join(', ')}`);
  if (body.type === 'text'  && !body.content?.trim())                               errors.push('Content required for text templates');
  if (body.type === 'embed' && !body.embed?.title && !body.embed?.description)      errors.push('Embed needs a title or description');
  if (body.type === 'v2'    && (!Array.isArray(body.v2Components) || !body.v2Components.length)) errors.push('V2 template needs at least one component');
  return errors;
}

// ── Webhook helpers ───────────────────────────────────────────────────────────

function parseWebhookUrl(url) {
  const m = (url || '').match(/discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_\-]+)/);
  return m ? { id: m[1], token: m[2] } : null;
}

function fetchDiscordWebhook(id, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path:     `/api/v10/webhooks/${id}/${token}`,
      method:   'GET',
      headers:  { 'User-Agent': 'NoxxDashboard/1.0' },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid webhook response')); }
        } else if (res.statusCode === 404) {
          reject(new Error('Webhook not found or token is invalid'));
        } else {
          reject(new Error(`Discord returned ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Webhook fetch timed out')); });
    req.end();
  });
}

// ── Discord payload builders ──────────────────────────────────────────────────

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, WebhookClient, MessageFlags } = require('discord.js');
const { apiPost } = require('../../lib/botClient');

function buildEmbedObj(embedData) {
  const eb = new EmbedBuilder();
  if (!embedData) return eb;
  if (embedData.color)       eb.setColor(embedData.color);
  if (embedData.title)       eb.setTitle(embedData.title.slice(0, 256));
  if (embedData.description) eb.setDescription(embedData.description.slice(0, 4096));
  if (embedData.authorName)  eb.setAuthor({ name: embedData.authorName.slice(0, 256), iconURL: embedData.authorIcon || undefined });
  if (embedData.thumbnail)   eb.setThumbnail(embedData.thumbnail);
  if (embedData.image)       eb.setImage(embedData.image);
  if (embedData.footerText)  eb.setFooter({ text: embedData.footerText.slice(0, 2048), iconURL: embedData.footerIcon || undefined });
  if (embedData.timestamp)   eb.setTimestamp();
  if (Array.isArray(embedData.fields)) {
    for (const f of embedData.fields.slice(0, 25)) {
      if (f.name && f.value) eb.addFields({ name: f.name.slice(0, 256), value: f.value.slice(0, 1024), inline: !!f.inline });
    }
  }
  return eb;
}

function buildButtonRow(buttonsData) {
  if (!buttonsData?.components?.length) return null;
  const row = new ActionRowBuilder();
  for (const b of buttonsData.components.slice(0, 5)) {
    if (!b.label) continue;
    const btn = new ButtonBuilder().setLabel(b.label).setStyle(Number(b.style) || 1).setDisabled(!!b.disabled);
    if (Number(b.style) === 5) btn.setURL(b.url || 'https://example.com');
    else btn.setCustomId(b.custom_id || `tpl_${Math.random().toString(36).slice(2, 8)}`);
    if (b.emoji?.name) btn.setEmoji(b.emoji.name);
    try { row.addComponents(btn); } catch {}
  }
  return row.components.length ? row : null;
}

function buildSelectMenuRows(selectMenus) {
  if (!Array.isArray(selectMenus) || !selectMenus.length) return [];
  const { StringSelectMenuBuilder } = require('discord.js');
  const rows = [];
  for (const m of selectMenus.slice(0, 5)) {
    if (!m.options?.length) continue;
    const menu = new StringSelectMenuBuilder()
      .setCustomId(m.custom_id || `sel_${Math.random().toString(36).slice(2, 8)}`)
      .setPlaceholder(m.placeholder || 'Select an option')
      .setMinValues(m.min_values ?? 1)
      .setMaxValues(m.max_values ?? 1)
      .setDisabled(!!m.disabled)
      .addOptions(m.options.slice(0, 25).map(o => {
        const opt = { label: o.label || 'Option', value: o.value || o.label || 'value', default: !!o.default };
        if (o.description) opt.description = o.description;
        if (o.emoji?.name) opt.emoji = { name: o.emoji.name };
        return opt;
      }));
    const row = new ActionRowBuilder().addComponents(menu);
    rows.push(row);
  }
  return rows;
}

function buildDiscordPayload(template) {
  const payload = { allowedMentions: { parse: [] } };

  if (template.type === 'text') {
    payload.content = template.content || '';
  } else if (template.type === 'embed') {
    if (template.plainText) payload.content = template.plainText;
    payload.embeds = [buildEmbedObj(template.embed)];
  } else if (template.type === 'v2') {
    payload.flags      = MessageFlags.IsComponentsV2 ?? (1 << 15);
    payload.components = template.v2Components || [];
    return payload;
  }

  const row = buildButtonRow(template.buttons);
  const selectRows = buildSelectMenuRows(template.selectMenus);
  const componentRows = [];
  if (row) componentRows.push(row);
  componentRows.push(...selectRows);
  if (componentRows.length) payload.components = componentRows;

  return payload;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Serve page
router.get('/guild/:id/templates', isAuth, checkDashboardAccess('welcome'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/messagetemplates.html'))
);

// List
router.get('/api/guild/:id/templates', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  try {
    const query = { guildId: req.params.id };
    const { type, tag } = req.query;
    if (type && VALID_TYPES.has(type)) query.type = type;
    if (tag) query.tags = tag;

    const docs = await MessageTemplate.find(query).sort({ updatedAt: -1 }).lean();
    const data = docs.map(doc => {
      const { _id, __v, data, ...rest } = doc;
      return { ...rest, ...(data || {}) };
    });
    res.json({ total: data.length, data });
  } catch (err) {
    console.error('[templates GET list]', err.message);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get one
router.get('/api/guild/:id/templates/:tid', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  try {
    const doc = await MessageTemplate.findOne({ guildId: req.params.id, id: req.params.tid }).lean();
    if (!doc) return res.status(404).json({ error: 'Template not found' });
    const { _id, __v, data, ...rest } = doc;
    res.json({ ...rest, ...(data || {}) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create
router.post('/api/guild/:id/templates', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  try {
    const errors = validateTemplate(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const count = await MessageTemplate.countDocuments({ guildId: req.params.id });
    if (count >= 100) return res.status(400).json({ error: 'Maximum 100 templates per guild' });

    const id = `tpl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await MessageTemplate.create({
      id,
      guildId:     req.params.id,
      name:        req.body.name?.trim().slice(0, 100) || 'Unnamed',
      description: (req.body.description || '').slice(0, 500),
      tags:        Array.isArray(req.body.tags) ? req.body.tags.slice(0, 20) : [],
      type:        req.body.type,
      data:        buildDataPayload(req.body),
    });
    res.json({ success: true, id });
  } catch (err) {
    console.error('[templates POST]', err.message);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Bulk sync
router.post('/api/guild/:id/templates/sync', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  try {
    if (!Array.isArray(req.body.templates)) return res.status(400).json({ error: 'Expected {templates:[...]}' });

    const ops = req.body.templates.slice(0, 100)
      .filter(t => t.id && t.name)
      .map(t => ({
        updateOne: {
          filter:  { guildId: req.params.id, id: t.id },
          update:  { $set: {
            name:        t.name?.trim().slice(0, 100) || 'Unnamed',
            description: (t.description || '').slice(0, 500),
            tags:        Array.isArray(t.tags) ? t.tags.slice(0, 20) : [],
            type:        t.type || 'text',
            data:        buildDataPayload(t),
          }},
          upsert: true,
        },
      }));

    if (ops.length) await MessageTemplate.bulkWrite(ops);
    res.json({ success: true, synced: ops.length });
  } catch (err) {
    console.error('[templates sync]', err.message);
    res.status(500).json({ error: 'Failed to sync templates' });
  }
});

// Update
router.put('/api/guild/:id/templates/:tid', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  try {
    const errors = validateTemplate(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const result = await MessageTemplate.findOneAndUpdate(
      { guildId: req.params.id, id: req.params.tid },
      { $set: {
        name:        req.body.name?.trim().slice(0, 100) || 'Unnamed',
        description: (req.body.description || '').slice(0, 500),
        tags:        Array.isArray(req.body.tags) ? req.body.tags.slice(0, 20) : [],
        type:        req.body.type,
        data:        buildDataPayload(req.body),
      }},
    );
    if (!result) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[templates PUT]', err.message);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete
router.delete('/api/guild/:id/templates/:tid', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  try {
    await MessageTemplate.deleteOne({ guildId: req.params.id, id: req.params.tid });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Verify webhook ownership
router.post('/api/guild/:id/templates/verify-webhook', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) return res.status(400).json({ valid: false, error: 'webhookUrl is required' });

  const parsed = parseWebhookUrl(webhookUrl);
  if (!parsed) return res.status(400).json({ valid: false, error: 'Not a valid Discord webhook URL' });

  try {
    const wh = await fetchDiscordWebhook(parsed.id, parsed.token);
    if (wh.guild_id !== req.params.id) {
      return res.status(403).json({ valid: false, error: 'This webhook does not belong to this server.' });
    }
    return res.json({ valid: true, id: wh.id, token: parsed.token, name: wh.name || 'Webhook', channelId: wh.channel_id });
  } catch (err) {
    console.error('[verify-webhook]', err.message);
    return res.status(400).json({ valid: false, error: err.message });
  }
});

// Send template
router.post('/api/guild/:id/templates/:tid/send', isAuth, checkDashboardAccess('welcome'), async (req, res) => {
  const guildId = req.params.id;
  const tid     = req.params.tid;

  const doc = await MessageTemplate.findOne({ guildId, id: tid }).lean();
  if (!doc) return res.status(404).json({ error: 'Template not found' });

  const { _id, __v, data, ...rest } = doc;
  const template = { ...rest, ...(data || {}) };
  const payload  = buildDiscordPayload(template);

  // Send via webhook
  if (req.body.webhookId || req.body.webhookUrl) {
    let id, token;
    if (req.body.webhookUrl) {
      const parsed = parseWebhookUrl(req.body.webhookUrl);
      if (!parsed) return res.status(400).json({ error: 'Invalid webhook URL' });
      id = parsed.id; token = parsed.token;
    } else {
      id = req.body.webhookId; token = req.body.webhookToken;
    }
    if (!id || !token) return res.status(400).json({ error: 'webhookId and webhookToken are required' });

    try {
      const wh = await fetchDiscordWebhook(id, token);
      if (wh.guild_id !== guildId) return res.status(403).json({ error: 'Webhook does not belong to this server.' });
    } catch (err) {
      return res.status(400).json({ error: `Webhook verification failed: ${err.message}` });
    }

    try {
      const wc = new WebhookClient({ id, token });
      const whPayload = { ...payload };
      if (req.body.username)  whPayload.username  = req.body.username.slice(0, 80);
      if (req.body.avatarUrl) whPayload.avatarURL = req.body.avatarUrl;
      await wc.send(whPayload);
      wc.destroy();
      return res.json({ success: true, method: 'webhook' });
    } catch (err) {
      console.error('[templates send webhook]', err.message);
      return res.status(500).json({ error: err.message || 'Failed to send via webhook' });
    }
  }

  // Send via channel
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId or webhookId is required' });

  try {
    const internalPayload = { ...payload };
    if (Array.isArray(payload.files) && payload.files.length) {
      internalPayload.files = payload.files.map(f => {
        const buf = f.attachment ?? f;
        const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
        return { name: f.name || 'file.png', data: raw.toString('base64'), contentType: f.contentType || 'image/png' };
      });
    }
    await apiPost(`/internal/guild/${guildId}/channel/${channelId}/send`, internalPayload);
    return res.json({ success: true, method: 'channel' });
  } catch (err) {
    console.error('[templates send channel]', err.message);
    if (err.isBotOffline) return res.status(503).json({ error: 'Bot is offline — cannot send message right now.' });
    return res.status(500).json({ error: err.message || 'Failed to send to channel' });
  }
});

module.exports = router;