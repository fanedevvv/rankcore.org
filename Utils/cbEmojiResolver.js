/**
 * cbEmojiResolver.js — Server 2 / Custom Branding
 *
 * CB bots are separate Discord applications — they cannot use emojis that
 * belong to the main RankCore bot's server. This module automatically fixes that:
 *
 *  1. On bot ready, patchCBClient() monkey-patches Discord.js send/reply/edit
 *     so EVERY outbound message (hardcoded strings, E.* usage, anything) has
 *     emoji strings rewritten to ones this CB bot owns.
 *
 *  2. When an unknown emoji is encountered it downloads the image from Discord
 *     CDN and uploads it to this CB bot's application emoji store, then caches
 *     the new ID. Subsequent uses are instant from cache.
 *
 *  3. preloadCBEmojis() is called at ready to proactively upload all E.* emojis
 *     in the background so they're ready before any commands are used.
 *
 * Zero changes needed in any Command / Event / System file.
 */

'use strict';

const https = require('https');

// ── Per-bot cache: botId → Map<emojiName, { id, name, animated }> ─────────────
const _resolvedCache = new Map();
const _warmed        = new Set();     // bots whose app emoji list has been fetched
const _warmingPromise = new Map();    // dedupe concurrent warmCache calls: botId → Promise
const _inflight      = new Map();     // dedupe concurrent uploads: key → Promise

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseEmoji(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);
  if (!m) return null;
  return { animated: m[1] === 'a', name: m[2], id: m[3] };
}

function formatEmoji(o) {
  return `<${o.animated ? 'a' : ''}:${o.name}:${o.id}>`;
}

function getBotCache(client) {
  const id = client.user?.id;
  if (!id) return new Map();
  if (!_resolvedCache.has(id)) _resolvedCache.set(id, new Map());
  return _resolvedCache.get(id);
}

function canUseEmoji(client, emojiId) {
  if (client.application?.emojis?.cache?.has(emojiId)) return true;
  for (const [, guild] of client.guilds.cache) {
    if (guild.emojis.cache.has(emojiId)) return true;
  }
  return false;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Warm cache from the bot's existing application emojis ─────────────────────
async function warmCache(client) {
  const botId = client.user?.id;
  if (!botId) return;
  if (_warmed.has(botId)) return;

  // Dedupe: if a warm is already in progress for this bot, await it
  if (_warmingPromise.has(botId)) return _warmingPromise.get(botId);

  const p = (async () => {
    try {
      let appEmojis = client.application?.emojis?.cache;
      if (!appEmojis?.size) {
        const fetched = await client.application?.emojis?.fetch().catch(() => null);
        appEmojis = fetched;
      }
      if (appEmojis) {
        const cache = getBotCache(client);
        for (const [, emoji] of appEmojis) {
          cache.set(emoji.name, { id: emoji.id, name: emoji.name, animated: emoji.animated ?? false });
        }
      }
      // Only mark warmed AFTER the cache is fully populated
      _warmed.add(botId);
    } catch { /* non-fatal — next call will retry */ } finally {
      _warmingPromise.delete(botId);
    }
  })();

  _warmingPromise.set(botId, p);
  return p;
}

// ── Upload one emoji to this bot's application emoji store ────────────────────
async function uploadEmoji(client, name, buf, animated) {
  try {
    const mime   = animated ? 'image/gif' : 'image/png';
    const data   = `data:${mime};base64,${buf.toString('base64')}`;

    // discord.js 14.16+ ApplicationEmojiManager
    if (client.application?.emojis?.create) {
      const created = await client.application.emojis.create({ name, attachment: data });
      return { id: created.id, name: created.name, animated: created.animated ?? animated };
    }

    // Fallback: raw REST
    const { REST, Routes } = require('discord.js');
    const rest    = new REST({ version: '10' }).setToken(client.token);
    const created = await rest.post(Routes.applicationEmojis(client.user.id), {
      body: { name, image: data },
    });
    return { id: created.id, name: created.name, animated: created.animated ?? animated };
  } catch (err) {
    // ── Name-conflict recovery ────────────────────────────────────────────────
    // On bot restart the emoji already exists in the application emoji store.
    // Discord rejects the re-upload, but the emoji is perfectly usable — fetch
    // its current ID from the existing store instead of returning null.
    try {
      const existing = client.application?.emojis?.cache?.size
        ? client.application.emojis.cache
        : await client.application?.emojis?.fetch().catch(() => null);
      if (existing) {
        const found = [...existing.values()].find(e => e.name === name);
        if (found) {
          console.log(`[cbEmojiResolver] ♻ "${name}" already exists → reusing ${found.id}`);
          return { id: found.id, name: found.name, animated: found.animated ?? animated };
        }
      }
    } catch { /* non-fatal */ }

    console.warn(`[cbEmojiResolver] Upload failed "${name}": ${err.message}`);
    return null;
  }
}

// ── Resolve one { id, name, animated } object ─────────────────────────────────
async function resolveObj(client, emoji) {
  if (!emoji?.id) return emoji;  // unicode — pass through

  // Always warm first so we reuse any emojis already uploaded to this CB bot
  // rather than hitting duplicate-name upload errors on every restart.
  await warmCache(client);

  const cache = getBotCache(client);
  const cached = cache.get(emoji.name);
  if (cached) return cached;  // Found in CB bot's own emoji store — reuse it

  // Not in cache - download from source and upload to this CB bot's app emojis
  const key = `${client.user?.id}:${emoji.name}`;
  if (_inflight.has(key)) return _inflight.get(key);
  
  const p = (async () => {
    try {
      const ext = emoji.animated ? 'gif' : 'png';
      const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=128&quality=lossless`;
      const buf = await fetchBuffer(url);
      const up = await uploadEmoji(client, emoji.name, buf, emoji.animated);
      if (up) {
        cache.set(emoji.name, up);
        console.log(`[cbEmojiResolver] ✔ "${emoji.name}" → ${up.id} (${client.user?.tag})`);
        return up;
      }
    } catch (err) {
      console.warn(`[cbEmojiResolver] Could not resolve "${emoji.name}": ${err.message}`);
    }
    return emoji;
  })();
  
  _inflight.set(key, p);
  const result = await p;
  _inflight.delete(key);
  return result;
}

// ── Replace all <:name:id> / <a:name:id> in a text string ─────────────────────
const EMOJI_RE = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;

async function resolveText(client, text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.includes('<:') && !text.includes('<a:')) return text;

  const matches = [...text.matchAll(EMOJI_RE)];
  if (!matches.length) return text;

  // Resolve all unique raw strings in parallel
  const unique = new Map();
  for (const m of matches) {
    const raw = m[0];
    if (!unique.has(raw)) {
      unique.set(raw, resolveObj(client, { animated: m[1] === 'a', name: m[2], id: m[3] })
        .then(formatEmoji));
    }
  }
  const resolved = new Map();
  for (const [raw, p] of unique) resolved.set(raw, await p);

  return text.replace(EMOJI_RE, match => resolved.get(match) ?? match);
}

// ── Deep-walk a message payload and resolve all emoji strings ─────────────────
async function resolvePayload(client, payload) {
  if (!payload) return payload;

  if (typeof payload === 'string') return resolveText(client, payload);

  if (Array.isArray(payload)) {
    return Promise.all(payload.map(v => resolvePayload(client, v)));
  }

  // Buffers and streams must never be spread — return them untouched.
  if (Buffer.isBuffer(payload) || typeof payload.pipe === 'function') return payload;

  // Discord.js builders (EmbedBuilder, ActionRowBuilder, etc.) are class instances
  // whose text lives inside a plain `.data` object. Resolve the data in-place so
  // emoji strings inside embed descriptions/titles/footers etc. are rewritten,
  // then return the original builder so Discord.js can serialise it correctly.
  if (
    typeof payload === 'object' &&
    Object.getPrototypeOf(payload) !== Object.prototype &&
    payload.data !== undefined &&
    typeof payload.data === 'object'
  ) {
    payload.data = await resolvePayload(client, payload.data);
    return payload;
  }

  // Plain objects — deep-walk every value.
  if (typeof payload === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(payload)) {
      out[k] = await resolvePayload(client, v);
    }
    return out;
  }

  return payload;
}

// ── Preload all E.* emojis on bot ready ───────────────────────────────────────
async function preloadCBEmojis(client, E) {
  await warmCache(client);
  const strings = Object.values(E).filter(v => typeof v === 'string' && v.startsWith('<'));
  const parsed  = [];
  for (const s of strings) {
    const p = parseEmoji(s);
    if (p) parsed.push(p);
  }

  let ok = 0, skipped = 0;
  const BATCH_SIZE = 3;
  const BATCH_DELAY_MS = 2500;

  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const batch = parsed.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(p => resolveObj(client, p)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j] && results[j].id !== batch[j].id) ok++;
      else if (results[j]) skipped++;
    }
    if (i + BATCH_SIZE < parsed.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(`[cbEmojiResolver] ✔ Preload done for ${client.user?.tag} (${parsed.length} emojis, ${ok} resolved, ${skipped} skipped)`);
}

// ── Monkey-patch Discord.js client methods ────────────────────────────────────
// Wraps channel.send, message.edit, and all interaction reply methods so
// every outbound payload is automatically emoji-resolved.
// Safe: only activates when client._isCBClient is true.

function patchCBClient(client) {
  if (client._emojiPatched) return;
  client._emojiPatched = true;

  const fix = payload => resolvePayload(client, payload);

  // TextBasedChannel#send — in discord.js v14 send() is mixed into subclasses,
  // not BaseChannel. Patch every text-based channel class that exposes send().
  const djs = require('discord.js');
  const channelClasses = [
    'TextChannel', 'DMChannel', 'NewsChannel', 'ThreadChannel',
    'VoiceChannel', 'StageChannel', 'BaseChannel',
  ];
  for (const cls of channelClasses) {
    const proto = djs[cls]?.prototype;
    if (!proto?.send || proto.send._cbPatched) continue;
    const orig = proto.send;
    proto.send = async function (opts, ...rest) {
      if (this.client?._isCBClient) opts = await fix(opts);
      return orig.call(this, opts, ...rest);
    };
    proto.send._cbPatched = true;
  }

  // Message#edit
  const { Message } = require('discord.js');
  if (Message.prototype.edit && !Message.prototype.edit._cbPatched) {
    const orig = Message.prototype.edit;
    Message.prototype.edit = async function (opts, ...rest) {
      if (this.client?._isCBClient) opts = await fix(opts);
      return orig.call(this, opts, ...rest);
    };
    Message.prototype.edit._cbPatched = true;
  }

  // Interaction#reply / editReply / followUp / update
  const { BaseInteraction } = require('discord.js');
  for (const method of ['reply', 'editReply', 'followUp', 'update']) {
    const orig = BaseInteraction.prototype[method];
    if (!orig || orig._cbPatched) continue;
    BaseInteraction.prototype[method] = async function (opts, ...rest) {
      if (this.client?._isCBClient) opts = await fix(opts);
      return orig.call(this, opts, ...rest);
    };
    BaseInteraction.prototype[method]._cbPatched = true;
  }

  console.log(`[cbEmojiResolver] ✔ Patched Discord.js — all CB messages will auto-resolve emojis`);
}

module.exports = { resolveText, resolveObj, resolvePayload, preloadCBEmojis, patchCBClient };