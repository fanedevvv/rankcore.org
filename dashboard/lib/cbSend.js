"use strict";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              CB-AWARE CHANNEL SENDER                         ║
 * ║                                                              ║
 * ║  Drop-in replacement for channel.send() in dashboard routes. ║
 * ║  When a Custom Branding bot is active for a guild, messages  ║
 * ║  are sent through the CB bot instead of RankCore, so they appear ║
 * ║  from the guild's branded bot identity.                      ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    const { cbSend } = require('../../lib/cbSend');           ║
 * ║    const { messageId } = await cbSend(req, guildId, channel, ║
 * ║      { embeds: [embed], components: [row] });                ║
 * ║                                                              ║
 * ║  Falls back to channel.send() if CB is not active.           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const CustomBranding = require("../../Schemas/customBrandingSchema");
const { apiPost }    = require("./botClient");
const cbm            = require("../../src/core/CustomBrandingManager");

/**
 * Send a message to a channel, routing through the CB bot when active.
 *
 * @param {import('express').Request} req         Express request (used for fallback client)
 * @param {string}                    guildId     Discord guild ID
 * @param {object}                    channel     discord.js Channel object (for fallback)
 * @param {object}                    payload     Message payload: { content?, embeds?, components? }
 *                                                NOTE: embeds must be plain JSON objects (.toJSON() if using EmbedBuilder)
 * @returns {Promise<{ messageId: string|null, viaCB: boolean }>}
 */
async function cbSend(req, guildId, channel, payload) {
  // Normalise embeds AND components to raw JSON so they survive IPC serialisation.
  // Applied to both the CB path AND the RankCore fallback so components are always
  // serialised correctly regardless of which bot ends up sending.
  const normPayload = {
    ...payload,
    embeds:     payload.embeds?.map(e =>
      (typeof e.toJSON === "function" ? e.toJSON() : e)),
    components: payload.components?.map(c =>
      (typeof c.toJSON === "function" ? c.toJSON() : c)),
  };

  // ── Step 1: Fast live-state check (in-memory, no DB hit) ──────────────────
  // cbm.isActive() returns true only when the CB worker is in state "running".
  // In standalone mode this is populated by a 5-second poll from noxx-cb;
  // in combined mode it reads the _instances Map directly.
  let cbIsActive = cbm.isActive(guildId);

  // ── Step 2: DB fallback check ─────────────────────────────────────────────
  // The live cache can be empty/stale in two real-world scenarios:
  //   a) The dashboard process just started and the first 5-second poll hasn't
  //      completed yet (standalone mode).
  //   b) CB_STANDALONE is not set, so the dashboard uses CustomBrandingManager
  //      directly — but that instance never called init(), so _instances is
  //      always empty and isActive() always returns false.
  // In both cases we fall back to a quick DB read to confirm whether CB is
  // actually configured and active for this guild before giving up.
  if (!cbIsActive) {
    try {
      const doc = await CustomBranding.findOne({
        guildId,
        enabled:    true,
        setupState: "active",
      }).select("guildId").lean();

      if (doc) {
        cbIsActive = true;
        console.log(
          `[cbSend] Live cache missed for guild ${guildId} but DB confirms CB ` +
          `is active — routing through CB bot.`
        );
      }
    } catch (dbErr) {
      // Non-fatal — if the DB check fails we continue with the live result (false).
      console.warn(`[cbSend] DB fallback check failed for guild ${guildId}: ${dbErr.message}`);
    }
  }

  // ── Step 3: Attempt CB send ───────────────────────────────────────────────
  if (cbIsActive) {
    try {
      const result = await apiPost("/internal/cb/send", {
        guildId,
        channelId: channel.id,
        payload:   normPayload,
      });

      if (result?.messageId) {
        return { messageId: result.messageId, viaCB: true };
      }

      // CB returned a response but with no messageId — log clearly so it shows
      // up in the process output rather than silently disappearing.
      console.error(
        `[cbSend] CB send returned no messageId for guild ${guildId}, ` +
        `channel ${channel.id} — CB error: ${result?.error ?? "unknown"}. ` +
        `Falling back to RankCore.`
      );
    } catch (err) {
      console.error(
        `[cbSend] CB send threw for guild ${guildId}, channel ${channel.id}: ` +
        `${err.message}. Falling back to RankCore.`
      );
    }
  }

  // ── Step 4: RankCore fallback ─────────────────────────────────────────────────
  // Use normPayload here too so ActionRowBuilder components are always
  // serialised to plain JSON before hitting discord.js / the internal API.
  const msg = await channel.send(normPayload);
  return { messageId: msg?.id ?? null, viaCB: false };
}

module.exports = { cbSend };