"use strict";
/**
 * staffapps/embeds.js
 *
 * Builds every embed and component used by the Staff Applications system:
 *   - buildReviewEmbeds       — multi-embed answer display (pending/accepted/denied)
 *   - buildReviewEmbed        — backwards-compat shim (header embed only)
 *   - buildOversizedNoticeEmbed — compact notice for submissions too large to post inline
 *   - buildReviewRow          — Accept / Deny button row
 *   - isOversizedSubmission   — size check helper
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { parseEmoji }       = require("../../../Utils/emojis");
const { getDashboardDomain } = require("./utils");

// ── Size guard ────────────────────────────────────────────────────────────────
/**
 * Returns true when the answers are too large to post inline in Discord
 * without risking embed-char / message-count limits.
 * Threshold: total answer chars > 3 500 OR embed count would exceed 4.
 */
function isOversizedSubmission(submission) {
  const totalChars = submission.answers.reduce(
    (n, a) => n + (a.label?.length || 0) + (a.answer?.length || 0), 0
  );
  const embedCount = Math.ceil(submission.answers.length / 25);
  return totalChars > 3500 || embedCount > 4;
}

// ── Oversized notice embed ────────────────────────────────────────────────────
/**
 * Build the compact "too long — view on dashboard" embed that is posted to the
 * log channel instead of dumping all answers inline.
 */
function buildOversizedNoticeEmbed(panel, submission) {
  const dashUrl  = `${getDashboardDomain()}/guild/${submission.guildId}/staffapps`;
  const avatarUrl = submission.userAvatar
    ? `https://cdn.discordapp.com/avatars/${submission.userId}/${submission.userAvatar}.png`
    : null;

  const embed = new EmbedBuilder()
    .setColor(panel.embedColor || "#6C53FF")
    .setTitle(`${panel.emoji || "<:files:1555544445565407352>"} ${panel.name} Application`)
    .setDescription(
      `**Applicant:** <@${submission.userId}> (${submission.userTag})\n` +
      `**Status:** <:n_loading:1555544489194688623> Pending Review\n\n` +
      `<:announcement:1555544345740967956> **This application exceeds Discord's message limits.**\n` +
      `Kindly view and review it from the dashboard:\n` +
      `[**View Application →**](${dashUrl})`
    )
    .setFooter({ text: `Submission ID: ${submission.submissionId}` })
    .setTimestamp();

  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

// ── Review embeds ─────────────────────────────────────────────────────────────
/**
 * Build review embeds for a submission.
 * Returns an ARRAY of EmbedBuilder objects. The header embed is always first,
 * followed by continuation embeds when answers overflow Discord's field limits.
 */
function buildReviewEmbeds(panel, submission, status = "pending") {
  const MAX_FIELDS      = 25;
  const MAX_EMBED_CHARS = 5800; // conservative; Discord limit is 6000

  const statusMeta = {
    pending:  { color: "#6C53FF", label: "<:n_loading:1555544489194688623> Pending Review" },
    accepted: { color: "#53FF6C", label: "<a:tickyy:1555544712687915008> Accepted" },
    denied:   { color: "#f87171", label: "<:crossy:1555544390221562048> Denied" },
  };
  const meta = statusMeta[status] ?? statusMeta.pending;

  const avatarUrl = submission.userAvatar
    ? `https://cdn.discordapp.com/avatars/${submission.userId}/${submission.userAvatar}.png`
    : null;

  const headerEmbed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${panel.emoji || "<:files:1555544445565407352>"} ${panel.name} Application`)
    .setDescription(
      `**Applicant:** <@${submission.userId}> (${submission.userTag})\n` +
      `**Status:** ${meta.label}`
    )
    .setFooter({ text: `Submission ID: ${submission.submissionId}` })
    .setTimestamp();

  if (avatarUrl) headerEmbed.setThumbnail(avatarUrl);

  const embeds = [headerEmbed];
  let currentEmbed    = headerEmbed;
  let currentCharCount = (headerEmbed.data.description || "").length;
  let fieldsInCurrent  = 0;

  for (const ans of submission.answers) {
    const name  = (ans.label  || "Question").slice(0, 256);
    const value = (ans.answer?.trim() || "*No answer provided*").slice(0, 1024);
    const addedChars = name.length + value.length;

    if (fieldsInCurrent >= MAX_FIELDS || currentCharCount + addedChars > MAX_EMBED_CHARS) {
      currentEmbed     = new EmbedBuilder().setColor(meta.color);
      embeds.push(currentEmbed);
      currentCharCount = 0;
      fieldsInCurrent  = 0;
    }

    currentEmbed.addFields({ name, value, inline: false });
    currentCharCount += addedChars;
    fieldsInCurrent++;
  }

  if (status !== "pending" && submission.reviewedBy) {
    const reviewerName  = status === "accepted" ? "Accepted by" : "Denied by";
    const reviewerValue = `<@${submission.reviewedBy}>${submission.reviewNote ? `\n> ${submission.reviewNote}` : ""}`;
    const addedChars    = reviewerName.length + reviewerValue.length;

    if (fieldsInCurrent >= MAX_FIELDS || currentCharCount + addedChars > MAX_EMBED_CHARS) {
      currentEmbed = new EmbedBuilder().setColor(meta.color);
      embeds.push(currentEmbed);
    }
    currentEmbed.addFields({ name: reviewerName, value: reviewerValue, inline: false });
  }

  return embeds;
}

/**
 * Backwards-compat shim — returns only the first (header) embed.
 * Used for edits that only need the status line updated on the original message.
 */
function buildReviewEmbed(panel, submission, status = "pending") {
  return buildReviewEmbeds(panel, submission, status)[0];
}

// ── Accept / Deny action row ──────────────────────────────────────────────────
function buildReviewRow(submissionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`staffapp_accept:${submissionId}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success)
      .setEmoji(parseEmoji("<a:tickyy:1555544712687915008>"))
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`staffapp_deny:${submissionId}`)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(parseEmoji("<:crossy:1555544390221562048>"))
      .setDisabled(disabled),
  );
}

module.exports = {
  isOversizedSubmission,
  buildOversizedNoticeEmbed,
  buildReviewEmbeds,
  buildReviewEmbed,
  buildReviewRow,
};