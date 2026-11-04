'use strict';

// ─── Snipe Store ──────────────────────────────────────────────────────────────
// Each Map key = channelId, value = array of snipe objects (newest first).
// Max 15 entries per channel per type; entries expire after EXPIRY_MS.

const HISTORY_LIMIT = 15;
const EXPIRY_MS     = 5 * 60 * 1000; // 5 minutes

const snipes      = new Map(); // Deleted messages
const editSnipes  = new Map(); // Edited messages
const reactSnipes = new Map(); // Removed reactions
const bulkSnipes  = new Map(); // Bulk deletes

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Push a new entry to the front of a channel's snipe list. */
function push(map, channelId, entry) {
  const list = map.get(channelId) || [];
  list.unshift({ ...entry, sniped_at: Date.now() });
  if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
  map.set(channelId, list);
}

/** Return non-expired entries for a channel; prune expired ones in-place. */
function fresh(map, channelId) {
  const list = map.get(channelId);
  if (!list) return [];
  const now  = Date.now();
  const live = list.filter(e => now - e.sniped_at < EXPIRY_MS);
  if (live.length !== list.length) map.set(channelId, live);
  return live;
}

/** Format an attachment collection into a newline-separated URL string. */
function fmtAttachments(attachments) {
  if (!attachments?.size) return null;
  return [...attachments.values()].map(a => a.url).join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Clear all snipe types for a given channel. */
function clearChannel(channelId) {
  snipes.delete(channelId);
  editSnipes.delete(channelId);
  reactSnipes.delete(channelId);
  bulkSnipes.delete(channelId);
}

/** Clear all snipes across every channel in the guild. */
function clearGuild(guildId) {
  for (const [id, list] of snipes)
    if (list[0]?.guild_id === guildId) snipes.delete(id);
  for (const [id, list] of editSnipes)
    if (list[0]?.guild_id === guildId) editSnipes.delete(id);
  for (const [id, list] of reactSnipes)
    if (list[0]?.guild_id === guildId) reactSnipes.delete(id);
  for (const [id, list] of bulkSnipes)
    if (list[0]?.guild_id === guildId) bulkSnipes.delete(id);
}

// ─── Event Module ─────────────────────────────────────────────────────────────

module.exports = {
  name: 'clientReady',

  async execute(client) {

    // ── Deleted message ──────────────────────────────────────────────────────
    client.on('messageDelete', (message) => {
      if (message.partial) return;
      if (!message.author || message.author.bot) return;
      if (!message.channel) return;

      push(snipes, message.channel.id, {
        content:       message.content || null,
        author: {
          id:          message.author.id,
          tag:         message.author.tag,
          username:    message.author.username,
          displayName: message.member?.displayName ?? message.author.displayName,
          avatarURL:   message.author.displayAvatarURL({ size: 256 }),
        },
        channel_id:    message.channel.id,
        guild_id:      message.guild?.id ?? null,
        message_id:    message.id,
        created_at:    message.createdTimestamp,
        attachments:   fmtAttachments(message.attachments),
        stickers:      message.stickers.size
          ? [...message.stickers.values()].map(s => s.name).join(', ')
          : null,
        embed_count:   message.embeds.length,
      });
    });

    // ── Edited message ───────────────────────────────────────────────────────
    client.on('messageUpdate', (oldMessage, newMessage) => {
      if (oldMessage.partial || newMessage.partial) return;
      if (!oldMessage.author || oldMessage.author.bot) return;
      if (oldMessage.content === newMessage.content) return;
      if (!oldMessage.channel) return;

      push(editSnipes, oldMessage.channel.id, {
        before:      oldMessage.content || null,
        after:       newMessage.content || null,
        author: {
          id:          oldMessage.author.id,
          tag:         oldMessage.author.tag,
          username:    oldMessage.author.username,
          displayName: oldMessage.member?.displayName ?? oldMessage.author.displayName,
          avatarURL:   oldMessage.author.displayAvatarURL({ size: 256 }),
        },
        channel_id:  oldMessage.channel.id,
        guild_id:    oldMessage.guild?.id ?? null,
        message_url: newMessage.url,
        created_at:  oldMessage.createdTimestamp,
      });
    });

    // ── Removed reaction ─────────────────────────────────────────────────────
    client.on('messageReactionRemove', (reaction, user) => {
      if (user?.bot) return;
      if (!reaction.message?.channel) return;

      push(reactSnipes, reaction.message.channel.id, {
        emoji:       reaction.emoji.toString(),
        emoji_id:    reaction.emoji.id ?? null,
        emoji_name:  reaction.emoji.name,
        user: {
          id:        user.id,
          tag:       user.tag,
          avatarURL: user.displayAvatarURL?.({ size: 256 }) ?? null,
        },
        message_id:  reaction.message.id,
        message_url: reaction.message.url,
        channel_id:  reaction.message.channel.id,
        guild_id:    reaction.message.guild?.id ?? null,
      });
    });

    // ── Bulk delete ──────────────────────────────────────────────────────────
    client.on('messageBulkDelete', (messages) => {
      if (!messages?.size) return;

      const first     = messages.first();
      const channelId = first.channel.id;

      const collected = [...messages.values()]
        .filter(m => !m.partial && m.author && !m.author.bot)
        .map(m => ({
          content:     m.content || null,
          author: {
            id:          m.author.id,
            tag:         m.author.tag,
            displayName: m.member?.displayName ?? m.author.displayName,
          },
          created_at:  m.createdTimestamp,
          attachments: fmtAttachments(m.attachments),
        }))
        .reverse(); // oldest-first for natural reading order

      if (!collected.length) return;

      push(bulkSnipes, channelId, {
        messages:   collected,
        total:      messages.size,
        channel_id: channelId,
        guild_id:   first.guild?.id ?? null,
      });
    });

    // ── Periodic expiry sweep (every 2 minutes) ──────────────────────────────
    setInterval(() => {
      for (const [id] of snipes)      fresh(snipes,      id);
      for (const [id] of editSnipes)  fresh(editSnipes,  id);
      for (const [id] of reactSnipes) fresh(reactSnipes, id);
      for (const [id] of bulkSnipes)  fresh(bulkSnipes,  id);
    }, 2 * 60 * 1000);
  },

  // ─── Exported Maps & helpers ───────────────────────────────────────────────
  snipes,
  editSnipes,
  reactSnipes,
  bulkSnipes,
  fresh,
  push,
  clearChannel,
  clearGuild,
  EXPIRY_MS,
  HISTORY_LIMIT,
};