"use strict";
/**
 * staffapps/handleDecision.js
 *
 * Handles the Accept and Deny review buttons (staffapp_accept: / staffapp_deny:).
 * Verifies reviewer permissions, updates the submission status, assigns the staff
 * role on accept, DMs the applicant, and edits the original log-channel message.
 */

const { EmbedBuilder } = require("discord.js");
const { isDead }       = require("../../../Events/Client/interaction/safeInteraction");

const StaffApplication           = require("../../../Schemas/staffApplicationSchema");
const StaffApplicationSubmission = require("../../../Schemas/staffApplicationSubmission");

const { cbChannelEdit }                                  = require("./utils");
const { buildReviewEmbeds, buildReviewRow }               = require("./embeds");

async function handleDecision(interaction, submissionId, decision) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const submission = await StaffApplicationSubmission.findOne({ submissionId });
    if (!submission)                                   return interaction.editReply({ content: "Submission not found." });
    if (submission.guildId !== interaction.guildId)    return interaction.editReply({ content: "Submission not found." });
    if (submission.status !== "pending") {
      return interaction.editReply({ content: `This application has already been **${submission.status}**.` });
    }

    const panel = await StaffApplication.findOne({ panelId: submission.panelId });
    if (!panel) return interaction.editReply({ content: "Panel config not found." });

    // ── Permission check ──────────────────────────────────────────────────────
    const member        = interaction.member;
    const hasPermission =
      member.permissions.has("ManageGuild") ||
      member.permissions.has("Administrator") ||
      (panel.staffRoleId && member.roles.cache.has(panel.staffRoleId));

    if (!hasPermission) {
      return interaction.editReply({ content: "You don't have permission to review applications." });
    }

    // ── Persist decision ──────────────────────────────────────────────────────
    await StaffApplicationSubmission.updateOne(
      { submissionId },
      { status: decision, reviewedBy: interaction.user.id }
    );
    submission.status     = decision;
    submission.reviewedBy = interaction.user.id;

    // ── Assign staff role on accept ───────────────────────────────────────────
    if (decision === "accepted" && panel.staffRoleId) {
      try {
        const target = await interaction.guild.members.fetch(submission.userId);
        await target.roles.add(panel.staffRoleId, `Staff application accepted by ${interaction.user.tag}`);
      } catch (err) {
        console.warn("[StaffApps] Could not assign role:", err.message);
      }
    }

    // ── DM the applicant ──────────────────────────────────────────────────────
    const dmEnabled = decision === "accepted" ? panel.dmOnAccept : panel.dmOnDeny;
    if (dmEnabled) {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${panel.emoji || "<:files:1555544445565407352>"} Application Update — ${panel.name}`)
        .setColor(decision === "accepted" ? "#53FF6C" : "#f87171")
        .setDescription(
          decision === "accepted"
            ? `<:boost:1555544362455146576> Congratulations! Your **${panel.name}** application in **${interaction.guild.name}** has been **accepted**.${panel.staffRoleId ? "\nYou've been given the staff role." : ""}`
            : `Your **${panel.name}** application in **${interaction.guild.name}** has been **denied**.`
        )
        .setTimestamp();
      try {
        const user = await interaction.client.users.fetch(submission.userId);
        await user.send({ embeds: [dmEmbed] });
      } catch { /* DMs closed */ }
    }

    // ── Update the log-channel message ────────────────────────────────────────
    if (submission.logMessageId && submission.logChannelId) {
      const updatedEmbeds = buildReviewEmbeds(panel, submission, decision);
      const disabledRow   = buildReviewRow(submissionId, true);
      const editPayload   = {
        embeds:     updatedEmbeds.slice(0, 10),
        components: [disabledRow],
      };

      const edited = await cbChannelEdit(
        interaction.guildId,
        submission.logChannelId,
        submission.logMessageId,
        editPayload,
        submission.reviewViaCB
      );

      if (!edited) {
        // Fallback: edit via Roco bot
        try {
          const logCh = interaction.guild.channels.cache.get(submission.logChannelId);
          if (logCh) {
            const msg = logCh.messages.cache.get(submission.logMessageId)
              ?? await logCh.messages.fetch(submission.logMessageId);
            await msg.edit(editPayload);
          }
        } catch (_) {}
      }
    }

    return interaction.editReply({
      content: `${decision === "accepted"
        ? "<a:tickyy:1555544712687915008> Accepted"
        : "<:crossy:1555544390221562048> Denied"} — <@${submission.userId}> has been notified.`,
    });

  } catch (err) {
    if (isDead(err)) return;
    console.error("[StaffApps Decision]", err);
    return interaction.editReply({ content: "Something went wrong. Please try again." });
  }
}

module.exports = handleDecision;