'use strict';
const { parseEmoji } = require('discord.js');

const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// ─────────────────────────────────────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────────────────────────────────────

function isDashboardEnabled(client) {
  return client?.config?.dashboard?.enabled === true;
}

function hasManagePermission(member, docs) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (docs.Handlers && member.roles.cache.has(docs.Handlers))   return true;
  if (docs.AdditionalManageRoles?.some(r => member.roles.cache.has(r))) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Channel-name helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToInt(hex) {
  return parseInt((hex || '#6C53FF').replace('#', ''), 16) || 0x6C53FF;
}

/**
 * Converts a parsed emoji object (from parseEmoji) or a raw emoji string into
 * a string safe for Discord channel names.
 *
 * Discord channel names only allow letters, numbers, and hyphens.
 * Custom emoji tags (<:name:id>) and unicode emoji are both rejected by the
 * API, so we extract only the text name and sanitise it.
 */
function emojiToChannelStr(emoji) {
  if (!emoji) return '';
  // Custom emoji object from parseEmoji() — use the name only (e.g. "legreen")
  if (typeof emoji === 'object' && emoji.id) {
    return (emoji.name || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  }
  // Unicode emoji stored as { name } with no id — not usable in channel names
  if (typeof emoji === 'object') return '';
  // Raw string — strip unicode emoji, variation selectors, and anything that
  // isn't a letter, digit, or hyphen, then collapse repeated hyphens
  return String(emoji)
    .replace(/\p{Emoji}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/[^a-z0-9-]/gi, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sanitises a user-supplied prefix string so it is safe for Discord channel
 * names. Strips unicode emoji, custom emoji tags (<:name:id>), and any other
 * characters that Discord rejects, then collapses repeated hyphens.
 */
function sanitiseChannelSegment(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    // Remove custom emoji tags like <:name:12345> or <a:name:12345>
    .replace(/<a?:\w+:\d+>/g, '')
    // Strip unicode emoji and variation selectors
    .replace(/\p{Emoji}/gu, '')
    .replace(/\uFE0F/g, '')
    // Keep only safe characters
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp helpers
// ─────────────────────────────────────────────────────────────────────────────

function relativeTs(date) {
  return `<t:${Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000)}:R>`;
}

function fullTs(date) {
  return `<t:${Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000)}:f>`;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error embed helper
// ─────────────────────────────────────────────────────────────────────────────

function errEmbed(msg) {
  return new EmbedBuilder().setDescription(`<:crossy:1555544390221562048> ${msg}`).setColor(0xef4444);
}

module.exports = {
  isDashboardEnabled,
  hasManagePermission,
  hexToInt,
  emojiToChannelStr,
  sanitiseChannelSegment,
  relativeTs,
  fullTs,
  formatDuration,
  errEmbed,
};