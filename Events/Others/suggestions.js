"use strict";

/**
 * Events/Others/suggestions.js
 *
 * Handles all suggestion-system interactions:
 *   • /suggestion send        — submit a new suggestion
 *   • /suggestion edit        — author edits their own suggestion
 *   • /suggestion delete      — author deletes their own suggestion
 *   • /suggestion info        — view vote breakdown
 *   • /suggestion approve     — staff approve
 *   • /suggestion reject      — staff reject
 *   • /suggestion implement   — staff mark as implemented
 *   • /suggestion stats       — server-wide stats
 *   • Button interactions     — upvote / downvote buttons on suggestion embeds
 *   • Auto-actions            — auto-approve / auto-reject when thresholds are hit
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { parseEmoji } = require('../../Utils/emojis');
const SuggestionConfig   = require("../../Schemas/suggestionSchema");
const { SuggestionEntry, SuggestionCooldown } = require("../../Schemas/suggestionSchema");

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLOURS = {
  pending:      0x5865f2,
  under_review: 0xfbbf24,
  approved:     0x22c55e,
  rejected:     0xef4444,
  implemented:  0x06b6d4,
  duplicate:    0x94a3b8,
};

const STATUS_LABELS = {
  pending:      "Pending",
  under_review: "Under Review",
  approved:     "<a:tickyy:1567797045253644368> Approved",
  rejected:     "<:crossy:1567796959648030831> Rejected",
  implemented:  "<:boost:1567796953599836280> Implemented",
  duplicate:    "<:n_music:1567796993403658261> Duplicate",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the suggestion embed for the public channel. */
function buildSuggestionEmbed(entry, config, authorTag, authorAvatar) {
  const upPct = entry.upvotes + entry.downvotes > 0
    ? Math.round((entry.upvotes / (entry.upvotes + entry.downvotes)) * 100)
    : 0;

  const bar = buildVoteBar(entry.upvotes, entry.downvotes);

  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOURS[entry.status] ?? 0x5865f2)
    .setDescription(`> ${entry.content}`)
    .addFields(
      { name: "Status",  value: STATUS_LABELS[entry.status] ?? entry.status, inline: true },
      { name: "Votes",   value: `<:like:1567796976542814269> **${entry.upvotes}**  ·  <:dislike:1567796962416132136> **${entry.downvotes}**  ·  ${upPct}% approval`, inline: true },
      { name: "\u200B",  value: bar },
    )
    .setFooter({ text: `Suggestion #${entry.number}${config.anonymousMode ? "" : `  ·  ${authorTag}`}` })
    .setTimestamp(entry.createdAt);

  if (!config.anonymousMode && authorAvatar) {
    embed.setAuthor({ name: authorTag, iconURL: authorAvatar });
  }

  if (entry.rejectReason) {
    embed.addFields({ name: "Rejection Reason", value: entry.rejectReason });
  }
  if (entry.implementedNote) {
    embed.addFields({ name: "Implementation Note", value: entry.implementedNote });
  }

  return embed;
}

/** Build the up/down vote action row. */
function buildVoteRow(entry) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest_up_${entry.messageId}`)
      .setLabel(`${entry.upvotes}`)
      .setEmoji(parseEmoji("<:like:1567796976542814269>"))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggest_down_${entry.messageId}`)
      .setLabel(`${entry.downvotes}`)
      .setEmoji(parseEmoji("<:dislike:1567796962416132136>"))
      .setStyle(ButtonStyle.Danger),
  );
}

/** Build the staff approve/reject row for the review channel. */
function buildReviewRow(messageId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggest_approve_${messageId}`)
      .setLabel("Approve")
      .setEmoji(parseEmoji("<a:tickyy:1567797045253644368>"))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggest_reject_${messageId}`)
      .setLabel("Reject")
      .setEmoji(parseEmoji("<:crossy:1567796959648030831>"))
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`suggest_implement_${messageId}`)
      .setLabel("Implemented")
      .setEmoji(parseEmoji("<:boost:1567796953599836280>"))
      .setStyle(ButtonStyle.Primary),
  );
}

/** Simple ASCII vote bar. */
function buildVoteBar(up, down) {
  const total = up + down;
  if (total === 0) return "`░░░░░░░░░░` No votes yet";
  const filled = Math.round((up / total) * 10);
  return `\`${"█".repeat(filled)}${"░".repeat(10 - filled)}\` ${Math.round((up / total) * 100)}%`;
}

/** Check if a member has the required staff roles. */
function isStaff(member, staffRoleIds) {
  if (!staffRoleIds?.length) return member.permissions.has("ManageMessages");
  return staffRoleIds.some(id => member.roles.cache.has(id));
}

/** Send a DM to the suggestion author about the outcome. */
async function dmAuthor(client, authorId, embed) {
  try {
    const user = await client.users.fetch(authorId);
    await user.send({ embeds: [embed] });
  } catch {
    // DMs disabled — silently ignore
  }
}

/** Resolve a suggestion message in the public channel and edit it. */
async function updatePublicMessage(client, entry, config, authorTag, authorAvatar) {
  try {
    const channel = client.channels.cache.get(entry.channelId) ?? await client.channels.fetch(entry.channelId);
    if (!channel) return;
    const msg = channel.messages.cache.get(entry.messageId) ?? await channel.messages.fetch(entry.messageId);
    if (!msg) return;

    const embed = buildSuggestionEmbed(entry, config, authorTag, authorAvatar);
    const components = entry.status === "pending" ? [buildVoteRow(entry)] : [];
    await msg.edit({ embeds: [embed], components });
  } catch {
    // Message may have been deleted
  }
}

/** Apply an auto-action (approve or reject) if thresholds are met. */
async function checkAutoActions(client, entry, config) {
  if (entry.status !== "pending") return;

  const shouldAutoApprove = config.autoApproveUpvotes > 0 && entry.upvotes >= config.autoApproveUpvotes;
  const shouldAutoReject  = config.autoRejectDownvotes > 0 && entry.downvotes >= config.autoRejectDownvotes;

  if (!shouldAutoApprove && !shouldAutoReject) return;

  const newStatus = shouldAutoApprove ? "approved" : "rejected";

  await SuggestionEntry.findByIdAndUpdate(entry._id, {
    $set: {
      status:       newStatus,
      resolvedBy:   client.user.id,
      resolvedAt:   new Date(),
      rejectReason: shouldAutoReject ? "Auto-rejected: downvote threshold reached" : null,
    },
  });

  entry.status = newStatus;
  await updatePublicMessage(client, entry, config, "Auto-Action", null);

  // Forward to approved / rejected channel
  const targetChannelId = newStatus === "approved" ? config.approvedChannelId : config.rejectedChannelId;
  if (targetChannelId) {
    try {
      const ch = await client.channels.fetch(targetChannelId);
      if (ch) {
        const label = newStatus === "approved" ? "<a:tickyy:1567797045253644368> Auto-approved" : "<:crossy:1567796959648030831> Auto-rejected";
        await ch.send({
          embeds: [new EmbedBuilder()
            .setColor(STATUS_COLOURS[newStatus])
            .setTitle(`${label}: Suggestion #${entry.number}`)
            .setDescription(entry.content)
            .setTimestamp()],
        });
      }
    } catch {}
  }
}

// ── Exported suggestion button handler (called directly by CB worker) ─────────
// Extracted so cb-worker.js can call handleSuggestionButton(interaction, cbClient)
// without needing to load the full event module or route through handelEvents.js.
async function handleSuggestionButton(interaction, client) {
  const id      = interaction.customId;
  const guildId = interaction.guildId;

  // ── Upvote / Downvote ────────────────────────────────────────────────────────
  if (id.startsWith("suggest_up_") || id.startsWith("suggest_down_")) {
    const isUp  = id.startsWith("suggest_up_");
    const msgId = isUp ? id.slice(11) : id.slice(13);

    // Claim the interaction token immediately before any async work.
    // This prevents the double-fire 40060 error that occurs when this function
    // is called from two concurrent listeners for the same interaction.
    await interaction.deferUpdate();

    const [config, entry] = await Promise.all([
      SuggestionConfig.findOne({ guildId }).lean(),
      SuggestionEntry.findOne({ guildId, messageId: msgId }),
    ]);

    if (!entry || entry.status !== "pending") {
      return interaction.followUp({ content: "<:crossy:1567796959648030831> This suggestion is no longer accepting votes.", flags: MessageFlags.Ephemeral });
    }

    if (!config?.selfVoteAllowed && entry.authorId === interaction.user.id) {
      return interaction.followUp({ content: "<:crossy:1567796959648030831> You cannot vote on your own suggestion.", flags: MessageFlags.Ephemeral });
    }

    const userId      = interaction.user.id;
    const alreadyUp   = entry.upvoterIds.includes(userId);
    const alreadyDown = entry.downvoterIds.includes(userId);
    const sameVote    = (isUp && alreadyUp) || (!isUp && alreadyDown);

    if (sameVote) {
      if (isUp) { entry.upvotes   = Math.max(0, entry.upvotes - 1);   entry.upvoterIds.pull(userId); }
      else       { entry.downvotes = Math.max(0, entry.downvotes - 1); entry.downvoterIds.pull(userId); }
    } else {
      if (alreadyUp   && !config?.allowVoteChange && !isUp) return interaction.followUp({ content: "<:crossy:1567796959648030831> You cannot change your vote.", flags: MessageFlags.Ephemeral });
      if (alreadyDown && !config?.allowVoteChange && isUp)  return interaction.followUp({ content: "<:crossy:1567796959648030831> You cannot change your vote.", flags: MessageFlags.Ephemeral });
      if (alreadyUp)   { entry.upvotes   = Math.max(0, entry.upvotes - 1);   entry.upvoterIds.pull(userId); }
      if (alreadyDown) { entry.downvotes = Math.max(0, entry.downvotes - 1); entry.downvoterIds.pull(userId); }
      if (isUp)  { entry.upvotes++;   entry.upvoterIds.push(userId); }
      else        { entry.downvotes++; entry.downvoterIds.push(userId); }
    }

    await entry.save();

    const embed = buildSuggestionEmbed(entry, config, interaction.user.tag, null);
    await interaction.editReply({ embeds: [embed], components: [buildVoteRow(entry)] });
    await checkAutoActions(client, entry.toObject ? entry.toObject() : entry, config);
    return;
  }

  // ── Staff review buttons ─────────────────────────────────────────────────────
  if (id.startsWith("suggest_approve_") || id.startsWith("suggest_reject_") || id.startsWith("suggest_implement_")) {
    // Claim the token before async work for the same reason as above.
    await interaction.deferUpdate();

    const config = await SuggestionConfig.findOne({ guildId }).lean();
    if (!isStaff(interaction.member, config?.staffRoleIds)) {
      return interaction.followUp({ content: "<:crossy:1567796959648030831> You don't have permission to review suggestions.", flags: MessageFlags.Ephemeral });
    }

    let action, msgId;
    if      (id.startsWith("suggest_approve_"))   { action = "approved";    msgId = id.slice(16); }
    else if (id.startsWith("suggest_implement_")) { action = "implemented"; msgId = id.slice(19); }
    else                                           { action = "rejected";    msgId = id.slice(15); }

    const entry = await SuggestionEntry.findOne({ guildId, messageId: msgId });
    if (!entry) return interaction.followUp({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
    if (entry.status !== "pending" && entry.status !== "under_review") {
      return interaction.followUp({ content: `<:crossy:1567796959648030831> This suggestion is already **${entry.status}**.`, flags: MessageFlags.Ephemeral });
    }

    entry.status     = action;
    entry.resolvedBy = interaction.user.id;
    entry.resolvedAt = new Date();
    await entry.save();

    // If review mode, post publicly on approval
    if (action === "approved" && config?.reviewMode && config.channelId) {
      try {
        const publicCh = await client.channels.fetch(config.channelId);
        if (publicCh) {
          const authorTag = config.anonymousMode ? "Anonymous"
            : (await client.users.fetch(entry.authorId).catch(() => ({ tag: "Unknown" }))).tag;
          const publicEmbed = buildSuggestionEmbed({ ...entry.toObject(), status: "pending" }, config, authorTag, null);
          const posted = await publicCh.send({ embeds: [publicEmbed], components: [buildVoteRow({ ...entry.toObject(), status: "pending" })] });
          entry.messageId = posted.id;
          entry.status    = "pending";
          await entry.save();
        }
      } catch {}
    }

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(STATUS_COLOURS[action])
        .setTitle(`${STATUS_LABELS[action]}: Suggestion #${entry.number}`)
        .setDescription(entry.content)
        .addFields({ name: "Actioned by", value: `<@${interaction.user.id}>` })
        .setTimestamp()],
      components: [],
    });

    if (config?.dmOnResult) {
      await dmAuthor(client, entry.authorId, new EmbedBuilder()
        .setColor(STATUS_COLOURS[action])
        .setTitle(`${STATUS_LABELS[action]}: Your suggestion`)
        .setDescription(`> ${entry.content}`)
        .setFooter({ text: `Suggestion #${entry.number} · ${interaction.guild.name}` })
        .setTimestamp());
    }

    return;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {

    // ── Slash commands ─────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand() && interaction.commandName === "suggestion") {
      const sub     = interaction.options.getSubcommand();
      const guildId = interaction.guildId;

      const config = await SuggestionConfig.findOne({ guildId }).lean();
      if (!config || !config.channelId) {
        return interaction.reply({
          content: "<:crossy:1567796959648030831> The suggestion system has not been configured in this server yet.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // ── /suggestion send ───────────────────────────────────────────────────
      if (sub === "send") {
        const text = interaction.options.getString("suggestion", true);

        if (config.minLength > 0 && text.length < config.minLength) {
          return interaction.reply({
            content: `<:crossy:1567796959648030831> Your suggestion must be at least **${config.minLength}** characters.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (config.requiredRoleIds?.length) {
          const hasRole = config.requiredRoleIds.some(id => interaction.member.roles.cache.has(id));
          if (!hasRole) return interaction.reply({ content: "<:crossy:1567796959648030831> You don't have the required role to submit suggestions.", flags: MessageFlags.Ephemeral });
        }

        if (config.blockedRoleIds?.length) {
          const blocked = config.blockedRoleIds.some(id => interaction.member.roles.cache.has(id));
          if (blocked) return interaction.reply({ content: "<:crossy:1567796959648030831> You are not allowed to submit suggestions in this server.", flags: MessageFlags.Ephemeral });
        }

        if (config.cooldownSeconds > 0) {
          const cooldown = await SuggestionCooldown.findOne({ guildId, userId: interaction.user.id }).lean();
          if (cooldown) {
            const elapsed = (Date.now() - new Date(cooldown.lastSentAt).getTime()) / 1000;
            if (elapsed < config.cooldownSeconds) {
              const remaining = Math.ceil(config.cooldownSeconds - elapsed);
              return interaction.reply({ content: `<:n_loading:1567796992556666982> Please wait **${remaining}s** before submitting another suggestion.`, flags: MessageFlags.Ephemeral });
            }
          }
        }

        if (config.maxActiveSuggestions > 0) {
          const activeCount = await SuggestionEntry.countDocuments({ guildId, authorId: interaction.user.id, status: "pending" });
          if (activeCount >= config.maxActiveSuggestions) {
            return interaction.reply({ content: `<:crossy:1567796959648030831> You already have **${activeCount}** active suggestion(s). Wait for them to be resolved first.`, flags: MessageFlags.Ephemeral });
          }
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = await client.channels.fetch(config.channelId).catch(() => null);
        if (!channel) return interaction.editReply("<:crossy:1567796959648030831> The suggestion channel no longer exists. Please contact a server admin.");

        const count  = await SuggestionEntry.countDocuments({ guildId });
        const number = count + 1;

        const postChannel = config.reviewMode && config.reviewChannelId
          ? (await client.channels.fetch(config.reviewChannelId).catch(() => null)) ?? channel
          : channel;

        const authorTag    = interaction.user.tag;
        const authorAvatar = interaction.user.displayAvatarURL();

        const entry = new SuggestionEntry({
          guildId,
          channelId: channel.id,
          messageId: "pending",
          authorId:  interaction.user.id,
          content:   text,
          number,
          status:    config.reviewMode ? "under_review" : "pending",
        });

        const embed      = buildSuggestionEmbed(entry, config, authorTag, authorAvatar);
        const pingContent = config.pingRoleId ? `<@&${config.pingRoleId}>` : null;
        const components  = config.reviewMode
          ? [buildReviewRow("PENDING")]
          : [buildVoteRow({ ...entry, messageId: "PENDING", upvotes: 0, downvotes: 0 })];

        const posted = await postChannel.send({ content: pingContent, embeds: [embed], components });

        entry.messageId = posted.id;
        if (config.reviewMode) entry.reviewMessageId = posted.id;
        await entry.save();

        const fixedComponents = config.reviewMode
          ? [buildReviewRow(posted.id)]
          : [buildVoteRow(entry)];
        await posted.edit({ components: fixedComponents });

        if (config.threadOnSuggest && posted.channel.isTextBased() && posted.channel.threads) {
          try { await posted.startThread({ name: `Suggestion #${number} — Discussion`, autoArchiveDuration: 1440 }); } catch {}
        }

        await SuggestionCooldown.findOneAndUpdate(
          { guildId, userId: interaction.user.id },
          { $set: { lastSentAt: new Date() } },
          { upsert: true }
        );

        await SuggestionConfig.findOneAndUpdate({ guildId }, { $inc: { totalSuggestions: 1 } });

        return interaction.editReply(
          config.reviewMode
            ? "<a:tickyy:1567797045253644368> Your suggestion has been submitted for review!"
            : `<a:tickyy:1567797045253644368> Your suggestion has been posted as **#${number}**!`
        );
      }

      // ── /suggestion edit ───────────────────────────────────────────────────
      if (sub === "edit") {
        if (!config.allowEdit) return interaction.reply({ content: "<:crossy:1567796959648030831> Editing suggestions is disabled in this server.", flags: MessageFlags.Ephemeral });
        const msgId   = interaction.options.getString("message_id", true).trim();
        const newText = interaction.options.getString("new_text", true);
        const entry   = await SuggestionEntry.findOne({ guildId, messageId: msgId });
        if (!entry) return interaction.reply({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
        if (entry.authorId !== interaction.user.id) return interaction.reply({ content: "<:crossy:1567796959648030831> You can only edit your own suggestions.", flags: MessageFlags.Ephemeral });
        if (entry.upvotes > 0 || entry.downvotes > 0) return interaction.reply({ content: "<:crossy:1567796959648030831> You cannot edit a suggestion that has already received votes.", flags: MessageFlags.Ephemeral });
        entry.content = newText;
        await entry.save();
        await updatePublicMessage(client, entry, config, interaction.user.tag, interaction.user.displayAvatarURL());
        return interaction.reply({ content: "<a:tickyy:1567797045253644368> Your suggestion has been updated.", flags: MessageFlags.Ephemeral });
      }

      // ── /suggestion delete ─────────────────────────────────────────────────
      if (sub === "delete") {
        const msgId = interaction.options.getString("message_id", true).trim();
        const entry = await SuggestionEntry.findOne({ guildId, messageId: msgId });
        if (!entry) return interaction.reply({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
        const canDelete = entry.authorId === interaction.user.id || isStaff(interaction.member, config.staffRoleIds);
        if (!canDelete) return interaction.reply({ content: "<:crossy:1567796959648030831> You can only delete your own suggestions.", flags: MessageFlags.Ephemeral });
        try {
          const ch  = client.channels.cache.get(entry.channelId) ?? await client.channels.fetch(entry.channelId);
          const msg = ch?.messages.cache.get(entry.messageId) ?? await ch?.messages.fetch(entry.messageId);
          await msg?.delete();
        } catch {}
        await SuggestionEntry.deleteOne({ _id: entry._id });
        return interaction.reply({ content: "<a:tickyy:1567797045253644368> Suggestion deleted.", flags: MessageFlags.Ephemeral });
      }

      // ── /suggestion info ───────────────────────────────────────────────────
      if (sub === "info") {
        const msgId = interaction.options.getString("message_id", true).trim();
        const entry = await SuggestionEntry.findOne({ guildId, messageId: msgId }).lean();
        if (!entry) return interaction.reply({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
        const total = entry.upvotes + entry.downvotes;
        const embed = new EmbedBuilder()
          .setColor(STATUS_COLOURS[entry.status] ?? 0x5865f2)
          .setTitle(`Suggestion #${entry.number} — Info`)
          .setDescription(`> ${entry.content}`)
          .addFields(
            { name: "Status",      value: STATUS_LABELS[entry.status] ?? entry.status, inline: true },
            { name: "<:like:1567796976542814269> Upvotes",  value: String(entry.upvotes),   inline: true },
            { name: "<:dislike:1567796962416132136> Downvotes",value: String(entry.downvotes), inline: true },
            { name: "Total Votes", value: String(total),           inline: true },
            { name: "Approval",    value: total > 0 ? `${Math.round((entry.upvotes / total) * 100)}%` : "N/A", inline: true },
            { name: "Submitted",   value: `<t:${Math.floor(new Date(entry.createdAt).getTime() / 1000)}:R>`, inline: true },
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      // ── /suggestion approve ────────────────────────────────────────────────
      if (sub === "approve") {
        if (!isStaff(interaction.member, config.staffRoleIds)) return interaction.reply({ content: "<:crossy:1567796959648030831> You don't have permission to approve suggestions.", flags: MessageFlags.Ephemeral });
        const msgId = interaction.options.getString("message_id", true).trim();
        const note  = interaction.options.getString("note") ?? null;
        const entry = await SuggestionEntry.findOne({ guildId, messageId: msgId });
        if (!entry) return interaction.reply({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
        if (entry.status === "approved") return interaction.reply({ content: "<:crossy:1567796959648030831> Already approved.", flags: MessageFlags.Ephemeral });
        entry.status = "approved"; entry.resolvedBy = interaction.user.id; entry.resolvedAt = new Date();
        if (note) entry.implementedNote = note;
        await entry.save();
        await updatePublicMessage(client, entry, config, interaction.user.tag, null);
        if (config.dmOnResult) await dmAuthor(client, entry.authorId, new EmbedBuilder().setColor(0x22c55e).setTitle("<a:tickyy:1567797045253644368> Your suggestion was approved!").setDescription(`> ${entry.content}`).setFooter({ text: `Suggestion #${entry.number} · ${interaction.guild.name}` }).setTimestamp());
        if (config.approvedChannelId) { try { const ch = await client.channels.fetch(config.approvedChannelId); await ch?.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle(`<a:tickyy:1567797045253644368> Approved: Suggestion #${entry.number}`).setDescription(entry.content).addFields({ name: "Approved by", value: `<@${interaction.user.id}>` }).setTimestamp()] }); } catch {} }
        await SuggestionConfig.findOneAndUpdate({ guildId }, { $inc: { totalApproved: 1 } });
        return interaction.reply({ content: `<a:tickyy:1567797045253644368> Suggestion #${entry.number} approved.`, flags: MessageFlags.Ephemeral });
      }

      // ── /suggestion reject ─────────────────────────────────────────────────
      if (sub === "reject") {
        if (!isStaff(interaction.member, config.staffRoleIds)) return interaction.reply({ content: "<:crossy:1567796959648030831> You don't have permission to reject suggestions.", flags: MessageFlags.Ephemeral });
        const msgId  = interaction.options.getString("message_id", true).trim();
        const reason = interaction.options.getString("reason") ?? null;
        if (config.requireReason && !reason) return interaction.reply({ content: "<:crossy:1567796959648030831> A rejection reason is required in this server.", flags: MessageFlags.Ephemeral });
        const entry = await SuggestionEntry.findOne({ guildId, messageId: msgId });
        if (!entry) return interaction.reply({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
        if (entry.status === "rejected") return interaction.reply({ content: "<:crossy:1567796959648030831> Already rejected.", flags: MessageFlags.Ephemeral });
        entry.status = "rejected"; entry.resolvedBy = interaction.user.id; entry.resolvedAt = new Date(); entry.rejectReason = reason;
        await entry.save();
        await updatePublicMessage(client, entry, config, interaction.user.tag, null);
        if (config.dmOnResult) await dmAuthor(client, entry.authorId, new EmbedBuilder().setColor(0xef4444).setTitle("<:crossy:1567796959648030831> Your suggestion was rejected").setDescription(`> ${entry.content}`).addFields(reason ? { name: "Reason", value: reason } : { name: "\u200B", value: "\u200B" }).setFooter({ text: `Suggestion #${entry.number} · ${interaction.guild.name}` }).setTimestamp());
        if (config.rejectedChannelId) { try { const ch = await client.channels.fetch(config.rejectedChannelId); await ch?.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle(`<:crossy:1567796959648030831> Rejected: Suggestion #${entry.number}`).setDescription(entry.content).addFields({ name: "Rejected by", value: `<@${interaction.user.id}>`, inline: true }, reason ? { name: "Reason", value: reason, inline: true } : { name: "\u200B", value: "\u200B", inline: true }).setTimestamp()] }); } catch {} }
        await SuggestionConfig.findOneAndUpdate({ guildId }, { $inc: { totalRejected: 1 } });
        return interaction.reply({ content: `<a:tickyy:1567797045253644368> Suggestion #${entry.number} rejected.`, flags: MessageFlags.Ephemeral });
      }

      // ── /suggestion implement ──────────────────────────────────────────────
      if (sub === "implement") {
        if (!isStaff(interaction.member, config.staffRoleIds)) return interaction.reply({ content: "<:crossy:1567796959648030831> You don't have permission to mark suggestions as implemented.", flags: MessageFlags.Ephemeral });
        const msgId = interaction.options.getString("message_id", true).trim();
        const note  = interaction.options.getString("note") ?? null;
        const entry = await SuggestionEntry.findOne({ guildId, messageId: msgId });
        if (!entry) return interaction.reply({ content: "<:crossy:1567796959648030831> Suggestion not found.", flags: MessageFlags.Ephemeral });
        entry.status = "implemented"; entry.resolvedBy = interaction.user.id; entry.resolvedAt = new Date(); entry.implementedNote = note;
        await entry.save();
        await updatePublicMessage(client, entry, config, interaction.user.tag, null);
        if (config.dmOnResult) await dmAuthor(client, entry.authorId, new EmbedBuilder().setColor(0x06b6d4).setTitle("<:boost:1567796953599836280> Your suggestion was implemented!").setDescription(`> ${entry.content}`).addFields(note ? { name: "Note", value: note } : { name: "\u200B", value: "\u200B" }).setFooter({ text: `Suggestion #${entry.number} · ${interaction.guild.name}` }).setTimestamp());
        await SuggestionConfig.findOneAndUpdate({ guildId }, { $inc: { totalApproved: 1 } });
        return interaction.reply({ content: `<a:tickyy:1567797045253644368> Suggestion #${entry.number} marked as implemented.`, flags: MessageFlags.Ephemeral });
      }

      // ── /suggestion stats ──────────────────────────────────────────────────
      if (sub === "stats") {
        const [total, pending, approved, rejected, impl] = await Promise.all([
          SuggestionEntry.countDocuments({ guildId }),
          SuggestionEntry.countDocuments({ guildId, status: "pending" }),
          SuggestionEntry.countDocuments({ guildId, status: "approved" }),
          SuggestionEntry.countDocuments({ guildId, status: "rejected" }),
          SuggestionEntry.countDocuments({ guildId, status: "implemented" }),
        ]);
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`<:n_utils:1567796996830658573> Suggestion Stats — ${interaction.guild.name}`)
          .addFields(
            { name: "Total",       value: String(total),    inline: true },
            { name: "Pending",     value: String(pending),  inline: true },
            { name: "Approved",    value: String(approved), inline: true },
            { name: "Rejected",    value: String(rejected), inline: true },
            { name: "Implemented", value: String(impl),     inline: true },
          )
          .setTimestamp();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      return;
    }

    // ── Button interactions ────────────────────────────────────────────────────
    if (!interaction.isButton()) return;

    const id = interaction.customId;
    if (
      id.startsWith("suggest_up_") || id.startsWith("suggest_down_") ||
      id.startsWith("suggest_approve_") || id.startsWith("suggest_reject_") ||
      id.startsWith("suggest_implement_")
    ) {
      await handleSuggestionButton(interaction, client);
    }
  },
};

// Export for direct use by cb-worker.js
module.exports.handleSuggestionButton = handleSuggestionButton;