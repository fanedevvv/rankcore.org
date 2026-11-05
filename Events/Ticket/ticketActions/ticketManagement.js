'use strict';

const {
  EmbedBuilder, PermissionFlagsBits, MessageFlags,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

const { parseEmoji }   = require('../../../Utils/emojis');
const TicketSchema     = require('../../../Schemas/Ticket');
const { buildStatusV2 } = require('./builders');
const { errEmbed }      = require('./helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Tag menu
// ─────────────────────────────────────────────────────────────────────────────

async function handleTagMenu(interaction, data, docs) {
  if (!docs.Tags?.length) return interaction.reply({ embeds: [errEmbed('No tags configured.')], flags: MessageFlags.Ephemeral });

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket-tag-select')
    .setPlaceholder('Select tags to apply…')
    .setMinValues(0)
    .setMaxValues(Math.min(docs.Tags.length, 10))
    .addOptions(docs.Tags.map(t => ({
      label:   t.name,
      value:   t.name,
      emoji:   parseEmoji(t.emoji || '<:thread:1567797010692706324>'),
      default: data.Tags?.includes(t.name),
    })));

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('<:thread:1567797010692706324> Apply Tags')
      .setDescription('Select one or more tags to apply to this ticket. Tags help staff categorise and track issues.')
      .setColor(0x6C53FF)],
    components: [new ActionRowBuilder().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

async function handleTagSelect(interaction) {
  await interaction.deferUpdate();
  const selected = interaction.values;
  await TicketSchema.updateOne({ GuildID: interaction.guild.id, ChannelID: interaction.channel.id }, { Tags: selected });

  const msg = buildStatusV2(0x6C53FF, '<:thread:1567797010692706324>', 'Tags Updated', [
    selected.length ? `Applied: ${selected.map(t => `\`${t}\``).join(' ')}` : 'All tags removed.',
    `-# Updated by <@${interaction.user.id}>`,
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff note
// ─────────────────────────────────────────────────────────────────────────────

async function handleNote(interaction, data) {
  const modalId = `ticket_note_modal_${interaction.user.id}`;
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('<:files:1567796970964394044> Add Staff Note');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('note_content')
      .setLabel('Note (only visible in this channel)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Internal notes — only staff can see this…')
      .setRequired(true)
      .setMaxLength(2000),
  ));

  await interaction.showModal(modal);
  const mi = await interaction.awaitModalSubmit({
    filter: i => i.user.id === interaction.user.id && i.customId === modalId,
    time: 60_000,
  }).catch(() => null);
  if (!mi) return;

  const content = mi.fields.getTextInputValue('note_content');
  await TicketSchema.updateOne(
    { ChannelID: interaction.channel.id },
    { $push: { Notes: { authorId: interaction.user.id, authorName: interaction.user.username, content } } },
  );

  await mi.reply({
    embeds: [new EmbedBuilder()
      .setTitle('<:files:1567796970964394044> Staff Note Added')
      .setDescription(content)
      .setColor(0x6b7280)
      .addFields({ name: '<:files:1567796970964394044>️ Added by', value: `<@${interaction.user.id}>`, inline: true })
      .setTimestamp()],
    flags: MessageFlags.Ephemeral,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / remove member
// ─────────────────────────────────────────────────────────────────────────────

async function handleManageMember(interaction) {
  await interaction.deferUpdate();
  const { guild, channel } = interaction;
  const userId = interaction.values[0];
  const data   = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
  if (!data) return;

  // Prevent removing the ticket owner
  if (userId === data.OwnerID) {
    const msg = buildStatusV2(0xeab308, '<:user:1567797032423264261>', 'Cannot Remove Owner', [`<@${userId}> is the ticket owner and cannot be removed.`]);
    return interaction.channel.send(msg).catch(() => {});
  }

  const isInTicket = data.MembersID.includes(userId);
  if (isInTicket) {
    await TicketSchema.updateOne({ ChannelID: channel.id }, { $pull: { MembersID: userId } });
    await channel.permissionOverwrites.delete(userId).catch(() => {});
    const msg = buildStatusV2(0xef4444, '<:user:1567797032423264261>', 'Member Removed', [`<@${userId}> was removed from this ticket.`]);
    await channel.send(msg).catch(() => {});
  } else {
    await TicketSchema.updateOne({ ChannelID: channel.id }, { $push: { MembersID: userId } });
    await channel.permissionOverwrites.edit(userId, {
      [PermissionFlagsBits.ViewChannel]: true,
      [PermissionFlagsBits.SendMessages]: true,
      [PermissionFlagsBits.ReadMessageHistory]: true,
    }).catch(() => {});
    const msg = buildStatusV2(0x22c55e, '<:user:1567797032423264261>', 'Member Added', [`<@${userId}> was added to this ticket.`]);
    await channel.send(msg).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assign
// ─────────────────────────────────────────────────────────────────────────────

async function handleAssignSelect(interaction) {
  await interaction.deferUpdate();
  const userId = interaction.values[0];
  await TicketSchema.updateOne({ GuildID: interaction.guild.id, ChannelID: interaction.channel.id }, { AssignedTo: userId });

  const msg = buildStatusV2(0x6C53FF, '<:minigames:1567796978929238076>', 'Ticket Assigned', [
    `Assigned to <@${userId}> by <@${interaction.user.id}>.`,
  ]);
  await interaction.channel.send(msg).catch(() => {});
}

module.exports = {
  handleTagMenu,
  handleTagSelect,
  handleNote,
  handleManageMember,
  handleAssignSelect,
};