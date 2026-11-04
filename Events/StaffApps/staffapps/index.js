"use strict";
/**
 * staffapps/index.js
 *
 * Entry point for the Staff Applications interaction system.
 * Exports a Discord.js event handler object that routes every staffapp_*
 * interaction to the appropriate handler module.
 *
 * Interaction map:
 *   staffapp_apply:{panelId}            Button  → handleApplyButton
 *   staffapp_menu:{guildId}             Select  → handleApplyButton (via deferUpdate)
 *   staffapp_modal_p{n}:{panelId}:{id}  Modal   → handlePagedModalSubmit
 *   staffapp_modal:{panelId}[:{tempId}] Modal   → handleModalSubmit
 *   staffapp_accept:{submissionId}      Button  → handleDecision("accepted")
 *   staffapp_deny:{submissionId}        Button  → handleDecision("denied")
 */

const { Events } = require("discord.js");

const handleApplyButton                          = require("./handleApply");
const { handleModalSubmit, handlePagedModalSubmit } = require("./handleModalSubmit");
const handleDecision                             = require("./handleDecision");

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    const id = interaction.customId ?? "";

    // ── Apply button ──────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith("staffapp_apply:")) {
      const panelId = id.split(":")[1];
      return handleApplyButton(interaction, panelId);
    }

    // ── Paged modal submit (intermediate pages) ───────────────────────────────
    // customId format: staffapp_modal_p{page}:{panelId}:{tempId}
    if (interaction.isModalSubmit() && id.startsWith("staffapp_modal_p")) {
      const parts   = id.split(":");  // ["staffapp_modal_p0", panelId, tempId]
      const tag     = parts[0];       // "staffapp_modal_p0"
      const panelId = parts[1];
      const tempId  = parts[2];
      const page    = parseInt(tag.replace("staffapp_modal_p", ""), 10);
      return handlePagedModalSubmit(interaction, panelId, tempId, page);
    }

    // ── Final modal submit ────────────────────────────────────────────────────
    // customId format: staffapp_modal:{panelId}  or  staffapp_modal:{panelId}:{tempId}
    if (interaction.isModalSubmit() && id.startsWith("staffapp_modal:")) {
      const parts   = id.split(":");  // ["staffapp_modal", panelId, optTempId]
      const panelId = parts[1];
      const tempId  = parts[2] || null;
      return handleModalSubmit(interaction, panelId, tempId);
    }

    // ── Accept button ─────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith("staffapp_accept:")) {
      const submissionId = id.split(":")[1];
      return handleDecision(interaction, submissionId, "accepted");
    }

    // ── Deny button ───────────────────────────────────────────────────────────
    if (interaction.isButton() && id.startsWith("staffapp_deny:")) {
      const submissionId = id.split(":")[1];
      return handleDecision(interaction, submissionId, "denied");
    }

    // ── Combined dropdown select ──────────────────────────────────────────────
    // IMPORTANT: StringSelectMenu interactions cannot call showModal() directly.
    // We must deferUpdate() first to acknowledge the select, then delegate to
    // handleApplyButton which handles the already-deferred state gracefully.
    if (interaction.isStringSelectMenu() && id.startsWith("staffapp_menu:")) {
      const panelId = interaction.values?.[0];
      if (!panelId) return;
      await interaction.deferUpdate().catch(() => {});
      return handleApplyButton(interaction, panelId);
    }
  },
};