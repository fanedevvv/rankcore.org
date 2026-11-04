"use strict";
/**
 * staffapps/modalStore.js
 *
 * In-memory store for partial answers across paged modals, and the helper that
 * constructs each modal page.
 *
 * Key: `${guildId}:${userId}:${tempId}`
 * Value: { panelId, answers: [], expiresAt: number }
 *
 * Entries expire after 30 minutes of inactivity and are pruned lazily on each
 * new apply interaction.
 */

const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

// ── Constants ─────────────────────────────────────────────────────────────────
const Q_PER_PAGE = 5;

// ── Store ─────────────────────────────────────────────────────────────────────
const partialStore = new Map();

function partialKey(guildId, userId, tempId) {
  return `${guildId}:${userId}:${tempId}`;
}

function prunePartials() {
  const now = Date.now();
  for (const [k, v] of partialStore) {
    if (v.expiresAt < now) partialStore.delete(k);
  }
}

// ── Modal builder ─────────────────────────────────────────────────────────────
/**
 * Build and return a ModalBuilder for one page of questions.
 *
 * @param {object}   panel      - Staff application panel document
 * @param {object[]} questions  - Subset of questions for this page
 * @param {number}   page       - Zero-based page index
 * @param {number}   totalPages - Total page count
 * @param {string}   panelId    - Panel identifier
 * @param {string}   tempId     - Session temp ID (used for multi-page tracking)
 */
function buildPageModal(panel, questions, page, totalPages, panelId, tempId) {
  const isLast    = page === totalPages - 1;
  const pageNum   = page + 1;
  const titleBase = panel.name.slice(0, 30);
  const title     = totalPages > 1
    ? `${titleBase} (${pageNum}/${totalPages})`.slice(0, 45)
    : `${titleBase} Application`.slice(0, 45);

  // For single-page applications use the classic customId (no tempId/page)
  // so submissions stored before the paged-modal update still work.
  const customId = isLast && page === 0
    ? `staffapp_modal:${panelId}`
    : isLast
      ? `staffapp_modal:${panelId}:${tempId}`
      : `staffapp_modal_p${page}:${panelId}:${tempId}`;

  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

  for (const q of questions) {
    const input = new TextInputBuilder()
      .setCustomId(q.id)
      .setLabel(q.label.slice(0, 45))
      .setStyle(q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required ?? true);
    if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
    if (q.minLength > 0) input.setMinLength(q.minLength);
    if (q.maxLength > 0) input.setMaxLength(Math.min(q.maxLength, 1000));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

module.exports = { Q_PER_PAGE, partialStore, partialKey, prunePartials, buildPageModal };