'use strict';

const {
  EmbedBuilder, PermissionFlagsBits, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

const { parseEmoji }        = require('../../../Utils/emojis');
const { encryptMessages }   = require('../../../Utils/transcriptCrypto');
const { createTranscript }  = require('discord-html-transcripts');
const TicketSetup           = require('../../../Schemas/TicketSetup');
const TicketSchema          = require('../../../Schemas/Ticket');
const TranscriptSchema      = require('../../../Schemas/transcript');
const { PRIORITY_META }     = require('./constants');
const { isDashboardEnabled, hasManagePermission, sanitiseChannelSegment, relativeTs, errEmbed } = require('./helpers');
const { buildStatusV2, buildClosedV2, buildCloseRow, buildCloseDMEmbed, buildLogEmbed } = require('./builders');
const { clearAutoClose } = require('./autoClose');

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all messages helper
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAllMessages(channel) {
  const all = [];
  let lastId;
  while (true) {
    const opts = { limit: 100 };
    if (lastId) opts.before = lastId;
    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    all.push(...batch.values());
    lastId = batch.last().id;
  }
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating DM
// ─────────────────────────────────────────────────────────────────────────────

async function sendRatingDM(owner, docs, ticketId) {
  if (!owner || !docs.EnableRating) return;
  try {
    const embed = new EmbedBuilder()
      .setTitle('<:boost:1567796953599836280> How Was Your Experience?')
      .setDescription(docs.RatingMessage || "We'd love to hear how your support experience went.")
      .setColor(parseInt((docs.Color || '#6C53FF').replace('#', ''), 16) || 0x6C53FF)
      .addFields(
        { name: '<:gw:1567796972872536159> Ticket',    value: `#${ticketId}`, inline: true },
        { name: '<:suggestion:1567797008452812870> Response', value: 'Click a star below to rate', inline: true },
      )
      .setFooter({ text: 'Your rating helps us improve our support.' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket-rate-1-${ticketId}`).setLabel('1').setEmoji(parseEmoji('<:boost:1567796953599836280>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket-rate-2-${ticketId}`).setLabel('2').setEmoji(parseEmoji('<:boost:1567796953599836280>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket-rate-3-${ticketId}`).setLabel('3').setEmoji(parseEmoji('<:boost:1567796953599836280>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket-rate-4-${ticketId}`).setLabel('4').setEmoji(parseEmoji('<:boost:1567796953599836280>')).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket-rate-5-${ticketId}`).setLabel('5').setEmoji(parseEmoji('<:boost:1567796953599836280>')).setStyle(ButtonStyle.Primary),
    );

    await owner.send({ embeds: [embed], components: [row] }).catch(() => {});
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Close
// ─────────────────────────────────────────────────────────────────────────────

async function handleCloseTicket(interaction, member, data, docs, client) {
  let reason = 'No reason provided.';

  if (docs.RequireCloseReason !== false) {
    const modal = new ModalBuilder().setCustomId('close_reason_modal').setTitle('<:lockk:1567796977809367122> Close Ticket');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Reason for closing this ticket')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true).setMaxLength(1000),
    ));
    await interaction.showModal(modal);

    const mi = await interaction.awaitModalSubmit({
      filter: i => i.user.id === member.id && i.customId === 'close_reason_modal',
      time: 60_000,
    }).catch(async () => {
      await interaction.followUp({ content: 'No reason provided. Close cancelled.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return null;
    });
    if (!mi) return;

    await mi.deferReply({ flags: MessageFlags.Ephemeral });
    reason      = mi.fields.getTextInputValue('close_reason');
    interaction = mi;
    await mi.editReply({ content: '<:lockk:1567796977809367122> Closing ticket…' });
  } else {
    await interaction.deferUpdate().catch(() => {});
  }

  if (interaction.channel.permissionOverwrites) {
    await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
      [PermissionFlagsBits.SendMessages]: false,
      [PermissionFlagsBits.ReadMessageHistory]: false,
    }).catch(() => {});
  } else if (interaction.channel.isThread?.()) {
    await interaction.channel.members.remove(data.OwnerID).catch(() => {});
  }

  // Web transcript
  let webTranscriptLink = null;
  if (docs.SaveWebTranscript !== false) {
    try {
      const msgs = await fetchAllMessages(interaction.channel);
      const ownerMember = await interaction.guild.members.fetch(data.OwnerID).catch(() => null);
      const messages = msgs.reverse().map(m => ({
        authorId: m.author.id, authorName: m.author.username,
        authorAvatar: m.author.displayAvatarURL(),
        content: m.content, timestamp: m.createdTimestamp, isBot: m.author.bot,
        attachments: m.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
      }));
      const encryptedData = encryptMessages(messages);
      await TranscriptSchema.create({
        TicketID:    data.TicketID, GuildID: interaction.guild.id,
        ChannelName: interaction.channel.name,
        OpenedBy: { id: data.OwnerID, username: data.OwnerTag || 'Unknown', avatar: ownerMember?.user.displayAvatarURL() || null },
        ClosedBy:  { id: member.id, username: member.user.username, avatar: member.user.displayAvatarURL() },
        Encrypted: true,
        EncryptedData: encryptedData,
        Rating: data.Rating ?? null,
      });
      if (isDashboardEnabled(client))
        webTranscriptLink = `${client.config.dashboard.domain}/guild/${interaction.guild.id}/transcripts/${data.TicketID}`;
    } catch (e) { console.error('[Ticket] Web transcript error:', e); }
  }

  const closedPayload = buildClosedV2(member, data, reason, webTranscriptLink);
  const closeRow      = buildCloseRow(webTranscriptLink);

  // CV2 containers (closedPayload) and V1 ActionRows (closeRow) CANNOT be in the same message.
  // Discord will reject the message with "Invalid Form Body" if mixed.
  // Send the CV2 closed summary first, then the V1 button row separately.
  await interaction.channel.send(closedPayload).catch(() => {});
  await interaction.channel.send({ components: [closeRow] }).catch(() => {});

  await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Closed: true, ClosedAt: new Date() });

  // DM owner
  if (docs.DMOnClose !== false) {
    const owner = await interaction.guild.members.fetch(data.OwnerID).catch(() => null);
    if (owner) {
      const dmEmbed = buildCloseDMEmbed(member, data, reason, docs, webTranscriptLink);
      const dmComps = webTranscriptLink
        ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Transcript').setStyle(ButtonStyle.Link).setURL(webTranscriptLink))]
        : [];
      await owner.send({ embeds: [dmEmbed], components: dmComps })
        .catch(() => interaction.channel.send(`<:error:1567796968758050868> Could not DM <@${data.OwnerID}>.`).catch(() => {}));
      await sendRatingDM(owner, docs, data.TicketID);
    }
  }

  // Log channel — per-category override if set
  const logChannelId = data.Category
    ? docs.Categories?.find(c => c.value === data.Category)?.submissionChannelId || docs.Transcripts
    : docs.Transcripts;

  if (logChannelId) {
    try {
      const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel) {
        const logEmbed = buildLogEmbed(data, member, reason, docs, webTranscriptLink);
        const logComps = webTranscriptLink
          ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Transcript').setStyle(ButtonStyle.Link).setURL(webTranscriptLink))]
          : [];
        await logChannel.send({ embeds: [logEmbed], components: logComps });
      }
    } catch (e) { console.error('[Ticket] Log channel error:', e); }
  }

  if (docs.AutoDeleteOnClose) {
    try {
      await new Promise(r => setTimeout(r, 5000));
      clearAutoClose(interaction.channel.id);
      await interaction.channel.delete().catch(() => {});
    } catch (e) { console.error('[Ticket] Auto-delete error:', e); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Close request: confirm / decline
// ─────────────────────────────────────────────────────────────────────────────

async function handleCloseReqConfirm(interaction, client) {
  const ownerId = interaction.customId.split(':')[1];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      embeds: [errEmbed('Only the ticket owner can confirm this close request.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const { guild, member, channel } = interaction;
  const docs = await TicketSetup.findOne({ GuildID: guild.id });
  const data = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });

  if (!data || data.Closed) {
    return interaction.reply({ embeds: [errEmbed('Ticket not found or already closed.')], flags: MessageFlags.Ephemeral });
  }

  // Remove the confirm/decline buttons from the close-request message.
  // Fire-and-forget: we MUST NOT await this before calling handleCloseTicket,
  // because interaction.showModal() must be the first acknowledgment of the
  // interaction and it must be called within 3 seconds of the button click.
  interaction.message?.edit({ components: [] }).catch(() => {});

  return handleCloseTicket(interaction, member, data, docs, client);
}

async function handleCloseReqDecline(interaction) {
  const ownerId = interaction.customId.split(':')[1];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({
      embeds: [errEmbed('Only the ticket owner can respond to this close request.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  try { await interaction.message.edit({ components: [] }); } catch (_) {}

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setDescription('<:restrict:1567797003638022166> **Close request declined.** The ticket remains open — please describe what else you need help with.')],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reopen
// ─────────────────────────────────────────────────────────────────────────────

async function handleReopenTicket(interaction, member, data) {
  await interaction.deferUpdate();
  await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Closed: false, ClosedAt: null, Claimed: false, ClaimedBy: null, AssignedTo: null });
  await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
    [PermissionFlagsBits.SendMessages]: true,
    [PermissionFlagsBits.ReadMessageHistory]: true,
  }).catch(() => {});

  const msg = buildStatusV2(0x22c55e, '<:lockk:1567796977809367122>', 'Ticket Reopened', [
    `Reopened by <@${member.id}>.`,
    `-# Reopened ${relativeTs(new Date())}`,
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

async function handleDeleteTicket(interaction, data) {
  await interaction.deferUpdate();

  const msg = await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('<:del:1567796961334267974> Deleting Ticket')
      .setDescription('This channel will be **deleted in 10 seconds**.\n\nClick **Cancel** to stop the deletion.')
      .setColor(0xef4444)
      .setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('stop-delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:restrict:1567797003638022166>')),
    )],
  }).catch(() => null);

  if (!msg) return;
  let stopped = false;
  const collector = msg.createMessageComponentCollector({ filter: i => i.customId === 'stop-delete', time: 10_000 });
  collector.on('collect', i => { stopped = true; i.deferUpdate().catch(() => {}); collector.stop(); });
  collector.on('end', async () => {
    if (stopped) {
      await msg.edit({ embeds: [new EmbedBuilder().setDescription('<a:tickyy:1567797045253644368> Deletion cancelled.').setColor(0x22c55e)], components: [] }).catch(() => {});
      return;
    }
    await TicketSchema.findOneAndDelete({ GuildID: interaction.guild.id, ChannelID: interaction.channel.id }).catch(() => {});
    clearAutoClose(interaction.channel.id);
    await interaction.channel.delete().catch(() => {});
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lock / Unlock
// ─────────────────────────────────────────────────────────────────────────────

async function handleLockTicket(interaction, data) {
  await interaction.deferUpdate();
  await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
    [PermissionFlagsBits.SendMessages]: false,
    [PermissionFlagsBits.ReadMessageHistory]: false,
  }).catch(() => {});
  await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Locked: true });

  const msg = buildStatusV2(0xeab308, '<:lockk:1567796977809367122>', 'Ticket Locked', [
    `Locked by <@${interaction.user.id}>.`,
    '-# The ticket owner can no longer send messages.',
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

async function handleUnlockTicket(interaction, data) {
  await interaction.deferUpdate();
  await interaction.channel.permissionOverwrites.edit(data.OwnerID, {
    [PermissionFlagsBits.SendMessages]: true,
    [PermissionFlagsBits.ReadMessageHistory]: true,
  }).catch(() => {});
  await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Locked: false });

  const msg = buildStatusV2(0x22c55e, '<:lockk:1567796977809367122>', 'Ticket Unlocked', [
    `Unlocked by <@${interaction.user.id}>.`,
    '-# The ticket owner can now send messages again.',
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim
// ─────────────────────────────────────────────────────────────────────────────

async function handleClaimTicket(interaction, member, data, docs) {
  await interaction.deferUpdate();
  // Sanitise the prefix — same guard as createTicketChannel
  const rawPrefix = (data.Category
    ? docs.Categories?.find(c => c.value === data.Category)?.channelPrefix?.trim()
    : null) || docs.TicketPrefix || 'ticket';
  const prefix  = sanitiseChannelSegment(rawPrefix) || 'ticket';
  const pmeta   = data.Priority ? PRIORITY_META[data.Priority] : null;
  const newName = pmeta
    ? `${pmeta.slug}-${prefix}-${data.TicketID}`
    : `claimed-${prefix}-${data.TicketID}`;

  await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Claimed: true, ClaimedBy: member.id, AssignedTo: member.id });
  await interaction.channel.setName(newName).catch(() => {});

  const msg = buildStatusV2(0xeab308, '<:restrict:1567797003638022166>', 'Ticket Claimed', [
    `Claimed by <@${member.id}>.`,
    `<@${data.OwnerID}> — your ticket is being handled.`,
    `-# Claimed ${relativeTs(new Date())}`,
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Unclaim
// ─────────────────────────────────────────────────────────────────────────────

async function handleUnclaimTicket(interaction, member, data, docs) {
  await interaction.deferUpdate();

  if (!data.Claimed)
    return interaction.followUp({ embeds: [errEmbed('This ticket is not claimed.')], flags: MessageFlags.Ephemeral });

  // Only the claimer, admins, or manage-role holders can unclaim
  const isStaff = member.permissions.has(PermissionFlagsBits.Administrator)
    || (docs.Handlers && member.roles.cache.has(docs.Handlers))
    || docs.AdditionalManageRoles?.some(r => member.roles.cache.has(r));
  if (data.ClaimedBy !== member.id && !isStaff)
    return interaction.followUp({ embeds: [errEmbed('Only the staff member who claimed this ticket (or an admin) can unclaim it.')], flags: MessageFlags.Ephemeral });

  // Revert the channel name back to the normal prefix-id format
  const rawPrefix = (data.Category
    ? docs.Categories?.find(c => c.value === data.Category)?.channelPrefix?.trim()
    : null) || docs.TicketPrefix || 'ticket';
  const prefix  = sanitiseChannelSegment(rawPrefix) || 'ticket';
  const newName = `${prefix}-${data.TicketID}`;

  await TicketSchema.updateOne({ ChannelID: interaction.channel.id }, { Claimed: false, ClaimedBy: null, AssignedTo: null });
  await interaction.channel.setName(newName).catch(() => {});

  const msg = buildStatusV2(0x6b7280, '<:restrict:1567797003638022166>', 'Ticket Unclaimed', [
    `Unclaimed by <@${member.id}>.`,
    `<@${data.OwnerID}> — your ticket is back in the queue.`,
    `-# Unclaimed ${relativeTs(new Date())}`,
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority
// ─────────────────────────────────────────────────────────────────────────────

async function handleSetPriority(interaction, priority) {
  await interaction.deferUpdate();
  const { guild, channel } = interaction;
  const docs = await TicketSetup.findOne({ GuildID: guild.id });
  const data = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
  if (!docs || !data) return;
  if (!hasManagePermission(interaction.member, docs)) return;

  const pmeta    = PRIORITY_META[priority];
  const catMeta  = data.Category ? docs.Categories?.find(c => c.value === data.Category) : null;
  const rawPrefix = catMeta?.channelPrefix?.trim() || docs.TicketPrefix || 'ticket';
  const prefix    = sanitiseChannelSegment(rawPrefix) || 'ticket';
  const newName   = `${pmeta.slug}-${prefix}-${data.TicketID}`;

  await TicketSchema.updateOne({ ChannelID: channel.id }, { Priority: priority });
  await channel.setName(newName).catch(() => {});

  const statusMsg = buildStatusV2(pmeta.color, pmeta.emoji, `Priority Set — ${pmeta.label}`, [
    `Priority updated to **${pmeta.label}** by <@${interaction.user.id}>.`,
    `-# Changed ${relativeTs(new Date())}`,
  ]);
  await channel.send(statusMsg).catch(() => {});

  if (priority === 'urgent' && docs.UrgentRoleId) {
    await channel.send({
      content: `<@&${docs.UrgentRoleId}> — this ticket has been marked as **urgent**!`,
      allowedMentions: { roles: [docs.UrgentRoleId] },
    }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript on demand
// ─────────────────────────────────────────────────────────────────────────────

async function handleSendTranscript(interaction, data) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const docs = await TicketSetup.findOne({ GuildID: interaction.guild.id });

  const transcript = await createTranscript(interaction.channel, {
    limit: -1, returnType: 'attachment', saveImages: true, poweredBy: false,
    filename: `${docs?.TicketPrefix || 'ticket'}-${data.TicketID}.html`,
  }).catch(() => null);

  if (!transcript) return interaction.editReply({ content: '<:crossy:1567796959648030831> Failed to generate transcript.' });

  const webLink = isDashboardEnabled(interaction.client)
    ? `${interaction.client.config.dashboard.domain}/guild/${interaction.guild.id}/transcripts/${data.TicketID}`
    : null;

  const comps = webLink
    ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Online').setStyle(ButtonStyle.Link).setURL(webLink))]
    : [];

  await interaction.user.send({
    embeds: [new EmbedBuilder()
      .setTitle(`<:files:1567796970964394044> Transcript — Ticket #${data.TicketID}`)
      .setDescription('Your ticket transcript is attached below.')
      .setColor(0x6C53FF)
      .addFields({ name: '<:gw:1567796972872536159> Ticket ID', value: `#${data.TicketID}`, inline: true })
      .setTimestamp()],
    files: [transcript],
    components: comps,
  }).catch(() => {});

  await interaction.editReply({ content: '<:announcement:1567796950265241662> Transcript sent to your DMs.' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rating
// ─────────────────────────────────────────────────────────────────────────────

async function handleRating(interaction) {
  const parts    = interaction.customId.split('-');
  const stars    = parseInt(parts[2]);
  const ticketId = parts[3];
  if (!stars || !ticketId) return;

  const data = await TicketSchema.findOne({ TicketID: ticketId });
  if (!data)       return interaction.reply({ embeds: [errEmbed('Ticket not found.')], flags: MessageFlags.Ephemeral });
  if (data.Rating) return interaction.update({ embeds: [new EmbedBuilder().setDescription(`You already rated this ticket ${data.Rating}<:boost:1567796953599836280>.`).setColor(0xeab308)], components: [] });
  if (interaction.user.id !== data.OwnerID)
    return interaction.reply({ embeds: [errEmbed('Only the ticket owner can rate.')], flags: MessageFlags.Ephemeral });

  await TicketSchema.updateOne({ TicketID: ticketId }, { Rating: stars });

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setTitle('<:boost:1567796953599836280> Thank You for Your Rating!')
      .setDescription(`You gave **${'<:boost:1567796953599836280>'.repeat(stars)}** — ${stars}/5 stars.\n\nYour feedback helps us improve our support team.`)
      .setColor(stars >= 4 ? 0x22c55e : stars >= 3 ? 0xeab308 : 0xef4444)
      .setTimestamp()],
    components: [],
  });
}

module.exports = {
  handleCloseTicket,
  handleCloseReqConfirm,
  handleCloseReqDecline,
  handleReopenTicket,
  handleDeleteTicket,
  handleLockTicket,
  handleUnlockTicket,
  handleClaimTicket,
  handleUnclaimTicket,
  handleSetPriority,
  handleSendTranscript,
  handleRating,
};