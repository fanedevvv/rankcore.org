const {
  EmbedBuilder,
  AttachmentBuilder,
  PermissionsBitField,
  WebhookClient
} = require("discord.js");

/* ----------------------------- */
/* CONSTANTS                     */
/* ----------------------------- */

const LOG_BATCH_SIZE  = 2;
const LOG_BATCH_DELAY = 1_500;   // ms between batches
const MAX_RETRIES     = 5;

// Sapphire-style global rate-limit bucket:
// Discord allows 30 webhook sends per 60s per webhook
const GLOBAL_RATELIMIT_MAX      = 30;
const GLOBAL_RATELIMIT_WINDOW   = 60_000;

/* ----------------------------- */
/* IN-MEMORY STATE               */
/* ----------------------------- */

/** channelId → WebhookClient */
const webhookCache = new Map();

/** channelId → { queue: [], running: bool } */
const logQueues = new Map();

/** channelId → { count: number, resetAt: number } */
const rateLimitBuckets = new Map();

/** guildIds that have permanently failed setup */
const disabledGuilds = new Set();

/* ----------------------------- */
/* RATE-LIMIT HELPERS            */
/* ----------------------------- */

/**
 * Consume one slot in the per-channel bucket.
 * Returns the number of ms to wait before sending (0 = send now).
 */
function consumeBucket(channelId) {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(channelId);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + GLOBAL_RATELIMIT_WINDOW };
    rateLimitBuckets.set(channelId, bucket);
  }

  if (bucket.count >= GLOBAL_RATELIMIT_MAX) {
    return bucket.resetAt - now;   // caller should wait this long
  }

  bucket.count++;
  return 0;
}

/* ----------------------------- */
/* WEBHOOK GET / CREATE / CACHE  */
/* ----------------------------- */

/**
 * Priority order:
 *  1. In-memory WebhookClient cache
 *  2. MongoDB (webhookSchema)
 *  3. Fetch existing webhooks owned by the bot
 *  4. Create a new webhook and persist it
 */
async function getOrCreateWebhook(channel) {
  const channelId = channel.id;

  // 1. Hot memory cache
  if (webhookCache.has(channelId))
    return webhookCache.get(channelId);

  const WebhookSchema = require("../../Schemas/Webhookschema");
  const { decryptWebhook, encryptWebhook } = require("../../Utils/webhookCrypto");

  // 2. Persistent DB record
  const existing = await WebhookSchema.findOne({ channelId }).select("+webhookToken").catch(() => null);
  if (existing) {
    const client = new WebhookClient({
      id:    existing.webhookId,
      token: decryptWebhook(existing.webhookToken)
    });
    webhookCache.set(channelId, client);
    return client;
  }

  // 3 & 4. Create or adopt an existing bot-owned webhook
  try {
    const hooks = await channel.fetchWebhooks();
    let hook = hooks.find(w => w.owner?.id === channel.client.user.id);

    if (!hook) {
      // Respect Discord's 10-webhook-per-channel cap gracefully
      if (hooks.size >= 10) {
        console.warn(`[Logs] Channel ${channelId} has 10 webhooks; cannot create another.`);
        return null;
      }

      hook = await channel.createWebhook({
        name:   "Roco Logs",
        avatar: channel.client.user.displayAvatarURL()
      });
    }

    // Persist to MongoDB so restarts don't lose the token
    await WebhookSchema.create({
      channelId,
      guildId:      channel.guild.id,
      webhookId:    hook.id,
      webhookToken: encryptWebhook(hook.token)
    });

    const client = new WebhookClient({ id: hook.id, token: hook.token });
    webhookCache.set(channelId, client);
    return client;

  } catch (err) {
    console.error("[Logs] Webhook create/fetch failed:", err);
    return null;
  }
}

/**
 * Evict a stale cached webhook (e.g. after a 404 Unknown Webhook error).
 * Also removes the DB record so it will be recreated fresh.
 */
async function evictWebhook(channelId) {
  webhookCache.delete(channelId);

  const WebhookSchema = require("../../Schemas/Webhookschema");
  await WebhookSchema.deleteOne({ channelId }).catch(() => null);
}

/* ----------------------------- */
/* CORE SEND FUNCTION            */
/* ----------------------------- */

async function sendViaWebhook(webhook, payload, channelId, retry = 0) {
  // Respect our own pre-emptive bucket before every attempt
  const waitMs = consumeBucket(channelId);
  if (waitMs > 0) {
    await new Promise(r => setTimeout(r, waitMs));
  }

  try {
    await webhook.send(payload);

  } catch (err) {
    // 10015 = Unknown Webhook  →  token was deleted, evict and bail
    if (err.code === 10015) {
      await evictWebhook(channelId);
      return;
    }

    // 429 = Discord rate-limit (use Discord's retry_after)
    if (err.status === 429 || err.code === 429) {
      if (retry >= MAX_RETRIES) return;

      const retryAfterMs = (err.retry_after ?? 2) * 1_000;
      await new Promise(r => setTimeout(r, retryAfterMs));
      return sendViaWebhook(webhook, payload, channelId, retry + 1);
    }

    // Generic transient error → exponential back-off
    if (retry < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 2_000 * (retry + 1)));
      return sendViaWebhook(webhook, payload, channelId, retry + 1);
    }

    console.error("[Logs] Permanent send failure after retries:", err);
  }
}

/* ----------------------------- */
/* QUEUE SYSTEM                  */
/* ----------------------------- */

async function processQueue(channelId, client) {
  const data = logQueues.get(channelId);
  if (!data) return;

  data.running = true;

  while (data.queue.length) {
    const batch = data.queue.splice(0, LOG_BATCH_SIZE);

    for (const item of batch) {
      try {
        // Webhook may have been evicted mid-queue; always re-fetch
        const webhook = await getOrCreateWebhook(item.channel);
        if (!webhook) continue;

        // Discord allows max 10 embeds per message — split into batches
        const MAX_EMBEDS = 10;
        const embedBatches = [];
        for (let i = 0; i < item.embeds.length; i += MAX_EMBEDS) {
          embedBatches.push(item.embeds.slice(i, i + MAX_EMBEDS));
        }
        if (embedBatches.length === 0) embedBatches.push([]);

        for (let b = 0; b < embedBatches.length; b++) {
          await sendViaWebhook(
            webhook,
            {
              // Include custom content if set, otherwise just embeds
              content:   b === 0 ? item.customContent : null,
              embeds:    embedBatches[b],
              // Only attach files on the first batch so they aren't re-sent
              files:     b === 0 ? item.files : [],
              username:  client.user.username,
              avatarURL: client.user.displayAvatarURL()
            },
            channelId
          );
        }
      } catch (err) {
        console.error("[Logs] Queue send error:", err);
      }
    }

    if (data.queue.length)
      await new Promise(r => setTimeout(r, LOG_BATCH_DELAY));
  }

  data.running = false;
}

/* ----------------------------- */
/* MAIN ENTRY POINT              */
/* ----------------------------- */

async function send_log(client, guildId, embeds, logType, files = []) {
  if (disabledGuilds.has(guildId)) return;

  // If a CB bot is actively running for this guild, let it handle logging
  try {
    const cbMgr = require("../../src/core/CustomBrandingManager");
    if (cbMgr.isActive(guildId)) return;
  } catch { /* non-critical */ }

  const logSchema = require("../../Schemas/logschema");
  const data = await logSchema.findOne({ Guild: guildId });
  if (!data) return;

  // Check for custom template override
  const eventKey = `event.${logType}`;
  const eventConfig = data[eventKey] || {};
  const template = eventConfig.template;
  
  let customContent = null;
  let customEmbeds = null;
  
  // Handle custom template (can be string for legacy, or object for new format)
  if (template) {
    if (typeof template === 'string') {
      // Legacy plain text template
      customContent = template;
      customEmbeds = [];
    } else if (template.type === 'text') {
      // New text template format
      customContent = template.content;
      customEmbeds = [];
    } else if (template.type === 'embed' && template.embeds) {
      // New embed template format - build Discord embeds from template
      customEmbeds = template.embeds.map(et => {
        const { EmbedBuilder } = require('discord.js');
        const eb = new EmbedBuilder();
        if (et.title) eb.setTitle(et.title);
        if (et.description) eb.setDescription(et.description);
        if (et.color) eb.setColor(et.color);
        if (et.author?.name) {
          eb.setAuthor({ name: et.author.name, iconURL: et.author.icon_url });
        }
        if (et.thumbnail?.url) eb.setThumbnail(et.thumbnail.url);
        if (et.image?.url) eb.setImage(et.image.url);
        if (et.footer?.text) {
          eb.setFooter({ text: et.footer.text, iconURL: et.footer.icon_url });
        }
        if (et.timestamp) eb.setTimestamp();
        return eb;
      });
    }
  }

  const channelId = data.LogChannels[logType] ?? data.LogChannels.all;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  // Use custom content/embeds if template was set, otherwise use provided embeds
  if (customContent || customEmbeds) {
    embeds = customEmbeds || [];
  } else {
    if (!Array.isArray(embeds)) embeds = [embeds];
    embeds.forEach(e => e?.setTimestamp());
  }

  if (!logQueues.has(channelId)) {
    logQueues.set(channelId, { queue: [], running: false });
  }

  const queueData = logQueues.get(channelId);
  // Store both content and embeds for queue processing
  queueData.queue.push({ channel, embeds, customContent, files, guildId, logType });

  if (!queueData.running) processQueue(channelId, client);
}

/* ----------------------------- */
/* UTILS                         */
/* ----------------------------- */

function contentToFile(content, filename) {
  return new AttachmentBuilder(Buffer.from(content, "utf-8"), { name: filename });
}

function chunkString(text, maxLength = 4_000) {
  if (!text) return [];
  const chunks = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + "\n" + line).length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1_000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d) return `${d}d ${h % 24}h`;
  if (h) return `${h}h ${m % 60}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/* ----------------------------- */
/* HANDLER                       */
/* ----------------------------- */

function handleLogs(client) {
  const utils = {
    send_log:       (guildId, embeds, logType, files = []) => send_log(client, guildId, embeds, logType, files),
    contentToFile,
    chunkString,
    formatDuration,
    EmbedBuilder,
    AttachmentBuilder,
    PermissionsBitField
  };

  require("./logs/messageLogs")(client, utils);
  require("./logs/channelLogs")(client, utils);
  require("./logs/guildLogs")(client, utils);
  require("./logs/memberLogs")(client, utils);
  require("./logs/roleLogs")(client, utils);
  require("./logs/voiceLogs")(client, utils);
  require("./logs/emojiStickerlogs")(client, utils);
  require("./logs/inviteLogs")(client, utils);
  require("./logs/webhookLogs")(client, utils);
  require("./logs/AutomodLogs")(client, utils);
}

module.exports = { handleLogs };