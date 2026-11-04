"use strict";
/**
 * staffapps/utils.js
 *
 * Shared low-level helpers for the Staff Applications system:
 *   - nanoid          — collision-resistant random ID
 *   - getDashboardDomain / apiPost — lazy-loaded dashboard bridge
 *   - cbChannelSend / cbChannelEdit — CB-bot routing with Roco fallback
 */

const CustomBranding = require("../../../Schemas/customBrandingSchema");

// ── Dashboard domain (lazy) ───────────────────────────────────────────────────
let _dashboardDomain = null;
function getDashboardDomain() {
  if (!_dashboardDomain) {
    try {
      _dashboardDomain =
        require("../../../src/config/bot").dashboard?.domain ||
        "https://dash.rocobot.xyz";
    } catch {
      _dashboardDomain = "https://dash.rocobot.xyz";
    }
  }
  return _dashboardDomain;
}

// ── CB-bot API bridge (lazy) ──────────────────────────────────────────────────
let _apiPost = null;
function apiPost(path, body) {
  if (!_apiPost) {
    try {
      _apiPost = require("../../../../dashboard/lib/botClient").apiPost;
    } catch {
      _apiPost = () => Promise.resolve(null);
    }
  }
  return _apiPost(path, body);
}

// ── Random ID ─────────────────────────────────────────────────────────────────
function nanoid(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ── CB-aware channel send ─────────────────────────────────────────────────────
/** Send a message to a channel, routing via CB bot when active. */
async function cbChannelSend(guildId, channel, payload) {
  try {
    const cb = await CustomBranding.findOne({ guildId, enabled: true })
      .select("setupState botClientId").lean();
    if (cb?.setupState === "active" && cb.botClientId) {
      const norm = {
        ...payload,
        embeds:     payload.embeds?.map(e => (typeof e.toJSON === "function" ? e.toJSON() : e)),
        components: payload.components?.map(c => (typeof c.toJSON === "function" ? c.toJSON() : c)),
      };
      const result = await apiPost("/internal/cb/send", { guildId, channelId: channel.id, payload: norm });
      if (result?.messageId) return { messageId: result.messageId, viaCB: true };
      console.warn(`[StaffApps CB Send] failed guild ${guildId} — falling back to Roco`);
    }
  } catch (err) {
    console.warn(`[StaffApps CB Send] error: ${err.message} — falling back to Roco`);
  }
  const msg = await channel.send(payload);
  return { messageId: msg?.id ?? null, viaCB: false };
}

// ── CB-aware message edit ─────────────────────────────────────────────────────
/** Edit a message via CB bot if it was originally sent by it. Returns true on success. */
async function cbChannelEdit(guildId, channelId, messageId, payload, viaCB) {
  if (viaCB) {
    try {
      const norm = {
        ...payload,
        embeds:     payload.embeds?.map(e => (typeof e.toJSON === "function" ? e.toJSON() : e)),
        components: payload.components?.map(c => (typeof c.toJSON === "function" ? c.toJSON() : c)),
      };
      const result = await apiPost("/internal/cb/edit", { guildId, channelId, messageId, payload: norm });
      if (result?.success) return true;
    } catch (err) {
      console.warn(`[StaffApps CB Edit] error: ${err.message}`);
    }
  }
  return false;
}

module.exports = { nanoid, getDashboardDomain, apiPost, cbChannelSend, cbChannelEdit };