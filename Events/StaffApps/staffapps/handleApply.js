"use strict";
/**
 * staffapps/handleApply.js
 *
 * Handles the initial "Apply" interaction — either a button (staffapp_apply:)
 * or a dropdown select (staffapp_menu:) — and routes to the correct flow:
 *   - DM mode  → handleDMApplication
 *   - Modal mode → shows first modal page
 */

const { MessageFlags } = require("discord.js");
const { isDead }       = require("../../../Events/Client/interaction/safeInteraction");

const StaffApplication          = require("../../../Schemas/staffApplicationSchema");
const StaffApplicationSubmission = require("../../../Schemas/staffApplicationSubmission");

const { nanoid }                             = require("./utils");
const { Q_PER_PAGE, partialStore, partialKey, prunePartials, buildPageModal } = require("./modalStore");
const handleDMApplication                    = require("./handleDMApplication");

async function handleApplyButton(interaction, panelId) {
  // Helper: send an ephemeral message whether we're fresh (button) or
  // already deferUpdate()'d (dropdown — which disables showModal too).
  const isDeferred    = interaction.deferred || interaction.replied;
  const ephemeralReply = (content) => {
    if (isDeferred) return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  };

  try {
    const panel = await StaffApplication.findOne({ panelId, guildId: interaction.guildId });
    if (!panel || !panel.enabled) {
      return ephemeralReply("This application panel is no longer active.");
    }

    // Required role check — fetch fresh member data to ensure roles are up-to-date
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (panel.requiredRoleId && !member.roles.cache.has(panel.requiredRoleId)) {
      return ephemeralReply(`You need the <@&${panel.requiredRoleId}> role to apply for ${panel.name}.`);
    }

    // Cooldown check
    if (panel.cooldownHours > 0) {
      const cutoff = new Date(Date.now() - panel.cooldownHours * 3_600_000);
      const recent = await StaffApplicationSubmission.findOne({
        panelId,
        userId:    interaction.user.id,
        createdAt: { $gt: cutoff },
      });
      if (recent) {
        const remaining = Math.ceil(
          (new Date(recent.createdAt).getTime() + panel.cooldownHours * 3_600_000 - Date.now()) / 3_600_000
        );
        return ephemeralReply(`You already applied recently. Please wait **${remaining}h** before applying again.`);
      }
    }

    if (!panel.questions?.length) {
      return ephemeralReply("This application has no questions configured yet.");
    }

    // ── DM Mode — questions sent 1-by-1 via DM ───────────────────────────────
    if (panel.dmMode !== false) {
      return handleDMApplication(interaction, panel, panelId);
    }

    // ── Modal mode ────────────────────────────────────────────────────────────
    // showModal() is only valid on un-deferred button/slash interactions.
    // If the interaction was already deferUpdate()'d (dropdown), we cannot
    // show a modal — send an ephemeral prompt to use the direct button instead.
    if (isDeferred) {
      return interaction.followUp({
        content: `<:announcement:1555544345740967956> Please use the **Apply Now** button on the **${panel.name}** panel message to start the application form. Modals can't be opened from a dropdown.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const questions  = panel.questions;
    const totalPages = Math.ceil(questions.length / Q_PER_PAGE);
    const tempId     = nanoid(8);

    if (totalPages > 1) {
      prunePartials();
      partialStore.set(partialKey(interaction.guildId, interaction.user.id, tempId), {
        panelId,
        answers:   [],
        expiresAt: Date.now() + 30 * 60_000,
      });
    }

    const firstPage = questions.slice(0, Q_PER_PAGE);
    return interaction.showModal(buildPageModal(panel, firstPage, 0, totalPages, panelId, tempId));

  } catch (err) {
    if (isDead(err)) return;
    console.error("[StaffApps Apply]", err);
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({ content: "Something went wrong. Please try again.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

module.exports = handleApplyButton;