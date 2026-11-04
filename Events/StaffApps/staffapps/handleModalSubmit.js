"use strict";
/**
 * staffapps/handleModalSubmit.js
 *
 * Handles modal submit interactions for the Staff Applications system:
 *   - handlePagedModalSubmit — collects answers for an intermediate page and
 *     shows the next modal page (customId: staffapp_modal_p{n}:{panelId}:{tempId})
 *   - handleModalSubmit      — final page (or only page for ≤5 questions);
 *     saves the submission and posts it to the log channel
 *     (customId: staffapp_modal:{panelId}  or  staffapp_modal:{panelId}:{tempId})
 *
 * Double-submission protection:
 *   - processingModalSubmit Set: in-memory guard for concurrent Discord retries
 *   - DB-level 60-second duplicate check before StaffApplicationSubmission.create()
 */

const { MessageFlags } = require("discord.js");
const { isDead }       = require("../../../Events/Client/interaction/safeInteraction");

const StaffApplication           = require("../../../Schemas/staffApplicationSchema");
const StaffApplicationSubmission = require("../../../Schemas/staffApplicationSubmission");

const { nanoid, cbChannelSend }                              = require("./utils");
const { Q_PER_PAGE, partialStore, partialKey, buildPageModal } = require("./modalStore");
const {
  isOversizedSubmission,
  buildOversizedNoticeEmbed,
  buildReviewEmbeds,
  buildReviewRow,
} = require("./embeds");

// ── In-flight guard ───────────────────────────────────────────────────────────
// Key: `${guildId}:${userId}:${panelId}`
// Prevents duplicate DB writes when Discord retries a modal-submit interaction
// before the first one completes.
const processingModalSubmit = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// handlePagedModalSubmit — intermediate pages (0..N-2)
// ─────────────────────────────────────────────────────────────────────────────
async function handlePagedModalSubmit(interaction, panelId, tempId, page) {
  // ── Check partial store BEFORE any async work ─────────────────────────────
  // The Discord interaction token expires in 3 seconds. We must either:
  //   a) call showModal() for the next page (no deferral needed), or
  //   b) deferReply() then editReply() for error cases.
  const key     = partialKey(interaction.guildId, interaction.user.id, tempId);
  const partial = partialStore.get(key);

  if (!partial) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    return interaction.editReply({
      content: "Your application session expired (30 min limit). Please click the Apply button again.",
    });
  }

  try {
    const panel = await StaffApplication.findOne({ panelId, guildId: interaction.guildId });
    if (!panel) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      return interaction.editReply({ content: "Application panel not found." });
    }

    // Collect this page's answers into the partial store
    const pageStart = page * Q_PER_PAGE;
    const pageQs    = panel.questions.slice(pageStart, pageStart + Q_PER_PAGE);
    for (const q of pageQs) {
      partial.answers.push({
        questionId: q.id,
        label:      q.label,
        answer:     interaction.fields.getTextInputValue(q.id) ?? "",
      });
    }
    partial.expiresAt = Date.now() + 30 * 60_000; // refresh window
    partialStore.set(key, partial);

    // Show next page
    const questions  = panel.questions;
    const totalPages = Math.ceil(questions.length / Q_PER_PAGE);
    const nextPage   = page + 1;
    const nextQs     = questions.slice(nextPage * Q_PER_PAGE, (nextPage + 1) * Q_PER_PAGE);

    return interaction.showModal(buildPageModal(panel, nextQs, nextPage, totalPages, panelId, tempId));

  } catch (err) {
    if (isDead(err)) return;
    console.error("[StaffApps PagedModal]", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    if (interaction.deferred) {
      interaction.editReply({ content: "Something went wrong. Please try again." }).catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// handleModalSubmit — final page (or only page for ≤5 questions)
// ─────────────────────────────────────────────────────────────────────────────
async function handleModalSubmit(interaction, panelId, tempId = null) {
  await interaction.deferReply({ ephemeral: true });

  // ── In-flight duplicate guard ─────────────────────────────────────────────
  const inflightKey = `${interaction.guildId}:${interaction.user.id}:${panelId}`;
  if (processingModalSubmit.has(inflightKey)) {
    return interaction.editReply({
      content: "Your application is already being submitted. Please wait a moment.",
    });
  }
  processingModalSubmit.add(inflightKey);

  try {
    const panel = await StaffApplication.findOne({ panelId, guildId: interaction.guildId });
    if (!panel) return interaction.editReply({ content: "Application panel not found." });

    // ── DB-level duplicate check (60-second window) ───────────────────────────
    const recentCutoff    = new Date(Date.now() - 60_000);
    const recentDuplicate = await StaffApplicationSubmission.findOne({
      guildId:   interaction.guildId,
      panelId,
      userId:    interaction.user.id,
      createdAt: { $gte: recentCutoff },
    }).lean();
    if (recentDuplicate) {
      return interaction.editReply({
        content: "Your application was already submitted. Please wait before trying again.",
      });
    }

    // ── Per-panel cooldown ────────────────────────────────────────────────────
    if (panel.cooldownHours > 0) {
      const cutoff = new Date(Date.now() - panel.cooldownHours * 3_600_000);
      const recent = await StaffApplicationSubmission.findOne({
        guildId:   interaction.guildId,
        panelId,
        userId:    interaction.user.id,
        createdAt: { $gte: cutoff },
      }).lean();
      if (recent) {
        const remaining = Math.ceil(
          (new Date(recent.createdAt).getTime() + panel.cooldownHours * 3_600_000 - Date.now()) / 3_600_000
        );
        return interaction.editReply({
          content: `You already applied recently. Please wait **${remaining}h** before applying again.`,
        });
      }
    }

    // ── Collect answers ───────────────────────────────────────────────────────
    const questions  = panel.questions;
    const totalPages = Math.ceil(questions.length / Q_PER_PAGE);
    const lastPage   = totalPages - 1;
    const lastQs     = questions.slice(lastPage * Q_PER_PAGE);
    const lastAnswers = lastQs.map(q => ({
      questionId: q.id,
      label:      q.label,
      answer:     interaction.fields.getTextInputValue(q.id) ?? "",
    }));

    // Merge with stored partial answers (multi-page case)
    let allAnswers = lastAnswers;
    if (tempId) {
      const key     = partialKey(interaction.guildId, interaction.user.id, tempId);
      const partial = partialStore.get(key);
      if (!partial) {
        return interaction.editReply({ content: "Your application session expired. Please start again." });
      }
      allAnswers = [...partial.answers, ...lastAnswers];
      partialStore.delete(key);
    }

    // ── Save submission ───────────────────────────────────────────────────────
    const submissionId = nanoid(12);
    const submission   = await StaffApplicationSubmission.create({
      guildId:    interaction.guildId,
      panelId,
      submissionId,
      userId:     interaction.user.id,
      userTag:    interaction.user.tag,
      userAvatar: interaction.user.avatar,
      answers:    allAnswers,
      status:     "pending",
    });

    // ── Post to log channel ───────────────────────────────────────────────────
    if (panel.logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(panel.logChannelId)
        ?? await interaction.guild.channels.fetch(panel.logChannelId).catch(() => null);
      if (logChannel) {
        const row         = buildReviewRow(submissionId);
        const pingContent = panel.pingRoleId ? `<@&${panel.pingRoleId}>` : null;
        let messageId, viaCB;

        if (isOversizedSubmission(submission)) {
          const noticeEmbed = buildOversizedNoticeEmbed(panel, submission);
          const result = await cbChannelSend(interaction.guildId, logChannel, {
            content:    pingContent,
            embeds:     [noticeEmbed],
            components: [row],
          });
          messageId = result.messageId;
          viaCB     = result.viaCB;
        } else {
          const reviewEmbeds = buildReviewEmbeds(panel, submission, "pending");
          const BATCH = 10;
          for (let i = 0; i < reviewEmbeds.length; i += BATCH) {
            const batch  = reviewEmbeds.slice(i, i + BATCH);
            const isLast = i + BATCH >= reviewEmbeds.length;
            const result = await cbChannelSend(interaction.guildId, logChannel, {
              content:    i === 0 ? pingContent : null,
              embeds:     batch,
              components: isLast ? [row] : [],
            });
            if (isLast) { messageId = result.messageId; viaCB = result.viaCB; }
          }
        }

        await StaffApplicationSubmission.updateOne(
          { submissionId },
          { logMessageId: messageId, logChannelId: panel.logChannelId, reviewViaCB: viaCB }
        );
      }
    }

    return interaction.editReply({
      content: `<a:tickyy:1555544712687915008> Your **${panel.name}** application has been submitted! You'll be notified when it's reviewed.`,
    });

  } catch (err) {
    if (isDead(err)) return;
    console.error("[StaffApps Modal]", err);
    return interaction.editReply({ content: "Failed to submit your application. Please try again." });
  } finally {
    processingModalSubmit.delete(inflightKey);
  }
}

module.exports = { handleModalSubmit, handlePagedModalSubmit };