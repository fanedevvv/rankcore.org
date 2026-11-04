/**
 * componentExpiry — when a component collector ends (timeout / idle / stop),
 * disable every button & select menu on the message it was watching, so an
 * expired command menu can no longer be clicked.
 *
 * Works globally by wrapping every createMessageComponentCollector() factory
 * (Message, InteractionResponse, text-based channels). Slash commands run
 * inside an AsyncLocalStorage "session" (see runWithInteraction) so we know
 * which interaction a collector belongs to — this lets us edit ephemeral
 * replies through the interaction webhook and avoid disabling a menu while
 * the same command still has another collector running on it.
 *
 * Every collector created inside a command expires after COMMAND_IDLE_MS
 * without use (overriding its own time/idle). Pass `persistent: true` in the
 * collector options to keep a command's own duration (e.g. poll voting).
 */
const { AsyncLocalStorage } = require('node:async_hooks');
const Discord = require('discord.js');

const COMMAND_IDLE_MS   = 3 * 60_000;
const DISABLE_DELAY_MS  = 3_000;            // let the command's own 'end' handler run first
const TOKEN_LIFETIME_MS = 14.5 * 60_000;    // interaction webhooks expire after 15 min
const SKIP_REASONS = new Set(['messageDelete', 'channelDelete', 'threadDelete', 'guildDelete']);
const SELECT_TYPES = new Set([3, 5, 6, 7, 8]);

const als = new AsyncLocalStorage();
const active = new Set(); // { sessionId, messageId, messageInteractionId, channelId }

function runWithInteraction(interaction, fn) {
  return als.run({ interaction }, fn);
}

// ── Component JSON transform ──────────────────────────────────────────────────
function disableTree(c, attachments, state) {
  if (!c || typeof c !== 'object') return c;
  const out = { ...c };

  if (out.type === 2 && out.style !== 5 && out.style !== 6 && !out.disabled) {
    out.disabled = true; state.changed = true;
  } else if (SELECT_TYPES.has(out.type) && !out.disabled) {
    out.disabled = true; state.changed = true;
  }

  if (Array.isArray(out.components)) out.components = out.components.map(x => disableTree(x, attachments, state));
  if (out.accessory) out.accessory = disableTree(out.accessory, attachments, state);
  if (out.media) out.media = fixMedia(out.media, attachments);
  if (out.file) out.file = fixMedia(out.file, attachments);
  if (Array.isArray(out.items)) out.items = out.items.map(it => (it?.media ? { ...it, media: fixMedia(it.media, attachments) } : it));
  return out;
}

// Re-sent media must point at the message's own attachments, not the signed CDN URL.
function fixMedia(media, attachments) {
  if (!media?.url) return media;
  const byId = media.attachment_id && attachments.get(media.attachment_id);
  if (byId) return { url: `attachment://${byId.name}` };
  const path = media.url.split('?')[0];
  const byUrl = attachments.find(a => a.url.split('?')[0] === path || a.proxyURL?.split('?')[0] === path);
  return { url: byUrl ? `attachment://${byUrl.name}` : media.url };
}

// ── Disabling ────────────────────────────────────────────────────────────────
function stillInUse(track, messageId) {
  for (const t of active) {
    if (track.sessionId && t.sessionId === track.sessionId) return true;
    if (messageId && t.messageId === messageId) return true;
  }
  return false;
}

async function disableMessage(track, target) {
  const { interaction, channel } = track;
  const viaWebhook = interaction?.webhook && Date.now() - interaction.createdTimestamp < TOKEN_LIFETIME_MS;

  let msg = null;
  if (viaWebhook) msg = await interaction.webhook.fetchMessage(target).catch(() => null);
  if (!msg && target !== '@original' && channel?.messages) msg = await channel.messages.fetch(target).catch(() => null);
  if (!msg || stillInUse(track, msg.id)) return;

  const state = { changed: false };
  const components = msg.components.map(c => disableTree(c.toJSON(), msg.attachments, state));
  if (!state.changed) return;

  if (viaWebhook && msg.webhookId === interaction.applicationId) {
    const ok = await interaction.webhook.editMessage(msg.id, { components }).then(() => true, () => false);
    if (ok) return;
  }
  if (!msg.flags?.has(Discord.MessageFlags.Ephemeral)) await msg.edit({ components }).catch(() => {});
}

function track(collector, source, store) {
  const fromResponse = source instanceof Discord.InteractionResponse;
  const t = {
    sessionId: store?.interaction?.id ?? null,
    interaction: (fromResponse ? source.interaction : store?.interaction) ?? null,
    channel: (source?.messages ? source : source?.channel)
      ?? collector.client.channels.cache.get(collector.channelId)
      ?? store?.interaction?.channel ?? null,
    messageId: collector.messageId ?? null,
    seen: new Set(),
  };
  active.add(t);

  // Keep the session alive for collectors created inside this collector's handlers.
  if (store) {
    const emit = collector.emit;
    collector.emit = function (...args) { return als.run(store, () => emit.apply(this, args)); };
  }

  collector.on('collect', i => { if (i.message?.id) t.seen.add(i.message.id); });
  collector.on('end', (_c, reason) => {
    active.delete(t);
    if (SKIP_REASONS.has(reason)) return;

    const targets = new Set();
    if (t.messageId) targets.add(t.messageId);
    else if (collector.messageInteractionId) targets.add('@original');
    else {
      t.seen.forEach(id => targets.add(id));
      if (!targets.size && t.interaction) targets.add('@original');
    }

    setTimeout(() => {
      for (const target of targets) {
        if (target !== '@original' && stillInUse(t, target)) continue;
        disableMessage(t, target).catch(() => {});
      }
    }, DISABLE_DELAY_MS).unref?.();
  });
}

function wrap(proto) {
  if (!proto || !Object.prototype.hasOwnProperty.call(proto, 'createMessageComponentCollector')) return;
  const original = proto.createMessageComponentCollector;
  if (original.__expiryWrapped) return;

  const wrapped = function (options = {}) {
    const store = als.getStore();
    if (store && !options.persistent) {
      const { time, ...rest } = options;
      options = { ...rest, idle: COMMAND_IDLE_MS };
    }
    const collector = original.call(this, options);
    try { track(collector, this, store); } catch { /* never break the command */ }
    return collector;
  };
  wrapped.__expiryWrapped = true;
  proto.createMessageComponentCollector = wrapped;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  for (const value of Object.values(Discord)) {
    if (typeof value === 'function' && value.prototype) wrap(value.prototype);
  }
}

module.exports = { install, runWithInteraction };
