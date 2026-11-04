"use strict";
/**
 * staffapps/handleDMApplication.js
 *
 * DM-based application flow: asks questions one-by-one via DM using message
 * collectors, then saves the submission and posts it to the log channel.
 *
 * The activeDMSessions map prevents a user from starting a second DM session
 * while one is already in progress.
 */

const { EmbedBuilder, MessageFlags } = require("discord.js");
const { isDead }                     = require("../../../Events/Client/interaction/safeInteraction");

const StaffApplicationSubmission = require("../../../Schemas/staffApplicationSubmission");

const { nanoid, cbChannelSend }              = require("./utils");
const { isOversizedSubmission, buildOversizedNoticeEmbed, buildReviewEmbeds, buildReviewRow } = require("./embeds");

// ── In-memory guard: prevents a second DM session from starting ───────────────
const activeDMSessions = new Map(); // userId → true

async function handleDMApplication(interaction, panel, panelId) {
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  const isDeferred    = interaction.deferred || interaction.replied;
  const ephemeralReply = (content) => {
    if (isDeferred) return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
  };

  if (activeDMSessions.has(userId)) {
    return ephemeralReply(
      "<:error:1555544434601369620> You already have an active application in your DMs. Please finish or wait for it to time out."
    );
  }

  // Try to open DMs first — fail fast before setting the session lock
  let dmChannel;
  try {
    dmChannel = await interaction.user.createDM();
  } catch {
    return ephemeralReply(
      "<:crossy:1555544390221562048> I couldn't open a DM with you. Please enable DMs from server members and try again."
    );
  }

  const questions = panel.questions;
  const answers   = [];
  const TIMEOUT   = 5 * 60_000; // 5 minutes per question

  try {
    // ── Test DM first — catch disabled DMs before stating DMs were sent ────────
    await dmChannel.send({
      embeds: [new EmbedBuilder()
        .setColor(panel.embedColor || "#6C53FF")
        .setTitle(`${panel.emoji || "<:files:1555544445565407352>"} ${panel.name} Application`)
        .setDescription(
          `Welcome! You're applying for **${panel.name}** in **${interaction.guild.name}**.\n\n` +
          `I'll ask you **${questions.length} question${questions.length !== 1 ? "s" : ""}** one at a time.\n` +
          `You have **5 minutes** to answer each question.\n\n` +
          `Type \`cancel\` at any time to abort the application.`
        )
        .setFooter({ text: `${questions.length} question(s) total` })],
    });

    activeDMSessions.set(userId, true);

    await ephemeralReply(
      `<:announcement:1555544345740967956> I've sent you a DM to start your **${panel.name}** application! Check your DMs.`
    );

    // ── Ask each question sequentially ───────────────────────────────────────
    for (let i = 0; i < questions.length; i++) {
      const q           = questions[i];
      const isMandatory = q.required || q.mandatory;

      const questionEmbed = new EmbedBuilder()
        .setColor(panel.embedColor || "#6C53FF")
        .setTitle(`Question ${i + 1} of ${questions.length}`)
        .setDescription(`**${q.label}**${isMandatory ? " *(required)*" : " *(optional — type `skip` to skip)*"}`)
        .setFooter({ text: `${panel.name} Application` });

      if (q.placeholder) questionEmbed.addFields({ name: "Hint", value: q.placeholder });

      await dmChannel.send({ embeds: [questionEmbed] });

      let answer = null;
      try {
        const collected = await dmChannel.awaitMessages({
          filter: m => m.author.id === userId,
          max:    1,
          time:   TIMEOUT,
          errors: ["time"],
        });

        const response = collected.first().content.trim();

        if (response.toLowerCase() === "cancel") {
          activeDMSessions.delete(userId);
          await dmChannel.send({
            embeds: [new EmbedBuilder()
              .setColor(0xef4444)
              .setDescription("<:crossy:1555544390221562048> Application cancelled. You can restart it anytime from the server.")],
          });
          return;
        }

        if (response.toLowerCase() === "skip" && !isMandatory) {
          answer = "";
        } else if (response.length === 0 && isMandatory) {
          await dmChannel.send("<:error:1555544434601369620> This question is required. Please provide an answer.");
          i--; // re-ask
          continue;
        } else {
          answer = response;
        }
      } catch {
        // Timed out waiting for a response
        activeDMSessions.delete(userId);
        await dmChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xf59e0b)
            .setDescription("<:1430986244921495654:1555544239792980044> Application timed out (5 minutes per question). Please restart from the server.")],
        });
        return;
      }

      answers.push({ questionId: q.id, label: q.label, answer: answer || "" });

      // Progress confirmation between questions
      if (i < questions.length - 1) {
        await dmChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0x22c55e)
            .setDescription(`<a:tickyy:1555544712687915008> Answer recorded! Moving to question **${i + 2}**...`)],
        });
      }
    }

    // ── DB-level duplicate guard ──────────────────────────────────────────────
    // activeDMSessions prevents a second *start*, but guard the write itself
    // against edge-case races (e.g. bot restart mid-session).
    const dmRecentCutoff = new Date(Date.now() - 60_000);
    const dmRecentDuplicate = await StaffApplicationSubmission.findOne({
      guildId,
      panelId,
      userId,
      createdAt: { $gte: dmRecentCutoff },
    }).lean();

    if (dmRecentDuplicate) {
      await dmChannel.send({
        embeds: [new EmbedBuilder()
          .setColor(0xf59e0b)
          .setDescription("<:error:1555544434601369620> Your application was already submitted. Please wait before trying again.")],
      });
      return;
    }

    // ── Save submission ───────────────────────────────────────────────────────
    const submissionId = nanoid(12);
    const submission   = await StaffApplicationSubmission.create({
      guildId,
      panelId,
      submissionId,
      userId,
      userTag:    interaction.user.tag,
      userAvatar: interaction.user.avatar,
      answers,
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
          const result = await cbChannelSend(guildId, logChannel, {
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
            const result = await cbChannelSend(guildId, logChannel, {
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

    // ── Confirm to user ───────────────────────────────────────────────────────
    await dmChannel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("<a:tickyy:1555544712687915008> Application Submitted!")
        .setDescription(
          `Your **${panel.name}** application for **${interaction.guild.name}** has been submitted.\n\n` +
          `You'll receive a DM when your application has been reviewed. Good luck! <:eco:1555544429253890050>`
        )
        .setFooter({ text: `Submission ID: ${submissionId}` })
        .setTimestamp()],
    });

  } catch (err) {
    if (isDead(err)) return;
    const isDmDisabled = err?.code === 50007 || err?.message?.includes("Cannot send messages to this user");
    if (isDmDisabled) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: "<:crossy:1555544390221562048> Your DMs are disabled. Please enable **Allow direct messages from server members** in your privacy settings and try again.", flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: "<:crossy:1555544390221562048> Your DMs are disabled. Please enable **Allow direct messages from server members** in your privacy settings and try again.", flags: MessageFlags.Ephemeral });
        }
      } catch { /* interaction already expired */ }
    } else {
      console.error("[StaffApps DM Flow]", err);
      try {
        await dmChannel.send(
          "<:crossy:1555544390221562048> Something went wrong during your application. Please try again from the server."
        );
      } catch { /* DMs closed mid-session */ }
    }
  } finally {
    activeDMSessions.delete(userId);
  }
}

module.exports = handleDMApplication;