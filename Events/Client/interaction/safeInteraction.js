'use strict';
/**
 * safeInteraction.js
 *
 * Helpers that make every Discord interaction call safe against:
 *   10062 — Unknown Interaction (expired — Discord only waits 3 s for an ack)
 *   40060 — Interaction Already Acknowledged
 *   10008 — Unknown Message (message deleted before we could edit)
 *
 * Import: const { safeReply, safeUpdate, safeDeferUpdate, safeDeferReply } = require('./safeInteraction');
 */

const DEAD_CODES = new Set([10062, 40060, 10008]);

function isDead(err) {
  return DEAD_CODES.has(err?.code) ||
    /unknown interaction/i.test(err?.message ?? '') ||
    /already.*acknowledged/i.test(err?.message ?? '') ||
    /interaction.*expired/i.test(err?.message ?? '');
}

function swallow(label, err) {
  if (!isDead(err)) console.error(`[${label}]`, err?.message ?? err);
}

/** Reply ephemerally, or editReply if already deferred/replied. */
async function safeReply(interaction, payload, ephemeral = true) {
  try {
    const flags = ephemeral
      ? ((payload.flags ?? 0) | 64)   // 64 = MessageFlags.Ephemeral
      : (payload.flags ?? 0);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(e => swallow('safeReply.editReply', e));
    } else {
      await interaction.reply({ ...payload, flags }).catch(e => swallow('safeReply.reply', e));
    }
  } catch (e) { swallow('safeReply', e); }
}

/** update(), falling back to editReply if already deferred/replied. */
async function safeUpdate(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(e => swallow('safeUpdate.editReply', e));
    } else {
      await interaction.update(payload).catch(e => swallow('safeUpdate.update', e));
    }
  } catch (e) { swallow('safeUpdate', e); }
}

/** deferUpdate() — no-op if already acked. */
async function safeDeferUpdate(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(e => swallow('safeDeferUpdate', e));
    }
  } catch (e) { swallow('safeDeferUpdate', e); }
}

/** deferReply() — no-op if already acked. */
async function safeDeferReply(interaction, ephemeral = true) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral }).catch(e => swallow('safeDeferReply', e));
    }
  } catch (e) { swallow('safeDeferReply', e); }
}

module.exports = { safeReply, safeUpdate, safeDeferUpdate, safeDeferReply, isDead };
