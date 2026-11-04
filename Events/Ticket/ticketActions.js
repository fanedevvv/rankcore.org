'use strict';

/**
 * ticketActions/index.js — main interaction router for the ticket system.
 *
 * File layout:
 *   index.js            ← this file (router + event export)
 *   constants.js        ← PRIORITY_META, CV2 flag
 *   helpers.js          ← permissions, channel-name sanitisation, timestamps, errEmbed
 *   cbSend.js           ← CB-aware channel sender
 *   builders.js         ← CV2 containers, action rows, embeds
 *   autoClose.js        ← inactivity auto-close scheduler
 *   ticketCreate.js     ← dropdown → modal → createTicketChannel
 *   ticketLifecycle.js  ← close, reopen, delete, lock, unlock, claim, priority, transcript, rating
 *   ticketManagement.js ← tags, notes, member add/remove, assign
 */

const {
  EmbedBuilder, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  UserSelectMenuBuilder,
} = require('discord.js');

const { parseEmoji }          = require('../../Utils/emojis');
const TicketSetup             = require('../../Schemas/TicketSetup');
const TicketSchema            = require('../../Schemas/Ticket');
const { hasManagePermission, errEmbed } = require('./ticketActions/helpers');
const { buildPriorityRow }    = require('./ticketActions/builders');
const { handleDropdown, handleIntakeModal, scheduleAutoClose } = require('./ticketActions/ticketCreate');
const {
  handleCloseTicket, handleCloseReqConfirm, handleCloseReqDecline,
  handleReopenTicket, handleDeleteTicket,
  handleLockTicket, handleUnlockTicket,
  handleClaimTicket, handleUnclaimTicket, handleSetPriority,
  handleSendTranscript, handleRating,
} = require('./ticketActions/ticketLifecycle');
const {
  handleTagMenu, handleTagSelect,
  handleNote, handleManageMember, handleAssignSelect,
} = require('./ticketActions/ticketManagement');

// ─────────────────────────────────────────────────────────────────────────────
// Main interaction handler (public wrapper with error boundary)
// ─────────────────────────────────────────────────────────────────────────────

async function executeTicketInteraction(interaction, client) {
  try {
    return await _handleTicketInteraction(interaction, client);
  } catch (err) {
    console.error('[Ticket] Unhandled interaction error:', err);
    const reply = { embeds: [errEmbed('Something went wrong. Please try again.')], flags: MessageFlags.Ephemeral };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(reply);
      else await interaction.reply(reply);
    } catch {}
  }
}

async function _handleTicketInteraction(interaction, client) {
  const { guild, member, customId, channel } = interaction;

  if (interaction.isStringSelectMenu() && customId === 'ticket-dropdown')
    return handleDropdown(interaction, client);

  if (interaction.isModalSubmit() && customId?.startsWith('ticket_intake_'))
    return handleIntakeModal(interaction, client);

  if (interaction.isButton() && customId?.startsWith('ticket-set-priority-'))
    return handleSetPriority(interaction, customId.replace('ticket-set-priority-', ''));

  if (interaction.isButton() && customId?.startsWith('ticket-close-req-confirm:'))
    return handleCloseReqConfirm(interaction, client);

  if (interaction.isButton() && customId?.startsWith('ticket-close-req-decline:'))
    return handleCloseReqDecline(interaction);

  if (interaction.isButton() && customId?.startsWith('ticket-rate-'))
    return handleRating(interaction);

  if (interaction.isStringSelectMenu() && customId === 'ticket-tag-select')
    return handleTagSelect(interaction);

  if (interaction.isUserSelectMenu() && customId === 'ticket-manage-menu')
    return handleManageMember(interaction);

  if (interaction.isUserSelectMenu() && customId === 'ticket-assign-menu')
    return handleAssignSelect(interaction);

  // Absorb stray modal submits from expired awaitModalSubmit collectors.
  // Without this, Discord marks the interaction as "failed" if the collector
  // already collected the submission internally (via awaitModalSubmit) but the
  // global interactionCreate also fires. We just deferUpdate/reply ephemerally.
  if (interaction.isModalSubmit()) {
    if (
      interaction.customId === 'close_reason_modal' ||
      interaction.customId.startsWith('ticket_note_modal_')
    ) {
      // Already handled by awaitModalSubmit — silently ignore stray fires.
      // Do NOT reply; replying here would cause "already replied" errors.
      return;
    }
    return; // Unknown modal — ignore
  }

  if (!interaction.isButton()) return;

  const docs     = await TicketSetup.findOne({ GuildID: guild.id });
  if (!docs) return;
  const data     = await TicketSchema.findOne({ GuildID: guild.id, ChannelID: channel.id });
  const canManage = hasManagePermission(member, docs);

  switch (customId) {
    case 'ticket-close':
      if (!data)       return interaction.reply({ embeds: [errEmbed('No ticket data found.')],          flags: MessageFlags.Ephemeral });
      if (data.Closed) return interaction.reply({ embeds: [errEmbed('This ticket is already closed.')], flags: MessageFlags.Ephemeral });
      if (member.id !== data.OwnerID && !canManage)
                       return interaction.reply({ embeds: [errEmbed('You cannot close this ticket.')],  flags: MessageFlags.Ephemeral });
      return handleCloseTicket(interaction, member, data, docs, client);

    case 'ticket-lock':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleLockTicket(interaction, data);

    case 'ticket-unlock':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleUnlockTicket(interaction, data);

    case 'ticket-claim':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')],                          flags: MessageFlags.Ephemeral });
      if (data.Claimed)        return interaction.reply({ embeds: [errEmbed(`Already claimed by <@${data.ClaimedBy}>`)], flags: MessageFlags.Ephemeral });
      return handleClaimTicket(interaction, member, data, docs);

    case 'ticket-unclaim':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleUnclaimTicket(interaction, member, data, docs);

    case 'ticket-manage':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return interaction.reply({
        embeds: [new EmbedBuilder().setDescription('Select a member to **add** or **remove** from this ticket.').setColor(0x6C53FF)],
        components: [new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId('ticket-manage-menu').setPlaceholder('Select a member…').setMinValues(1).setMaxValues(1),
        )],
        flags: MessageFlags.Ephemeral,
      });

    case 'ticket-assign':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle('<:minigames:1555544500179439707> Assign Ticket').setDescription('Select a staff member to assign this ticket to.').setColor(0x6C53FF)],
        components: [new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId('ticket-assign-menu').setPlaceholder('Assign to…').setMinValues(1).setMaxValues(1),
        )],
        flags: MessageFlags.Ephemeral,
      });

    case 'ticket-note':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleNote(interaction, data);

    case 'ticket-tag':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleTagMenu(interaction, data, docs);

    case 'ticket-priority':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle('<:thunderr:1555544623735242883> Set Priority').setDescription('Select a priority level for this ticket.').setColor(0x6C53FF)
          .addFields(
            { name: '<:LEgreen:1555544256356159600> Low',    value: 'Routine — no time pressure',         inline: true },
            { name: '<:error:1555544434601369620> Medium',   value: 'Should be addressed soon',           inline: true },
            { name: '<:error:1555544434601369620> High',     value: 'Needs attention quickly',            inline: true },
            { name: '<:LEred:1555544262123323422> Urgent',   value: 'Critical — immediate action needed', inline: true },
          )],
        components: [buildPriorityRow()],
        flags: MessageFlags.Ephemeral,
      });

    case 'ticket-reopen':
      if (!data)        return;
      if (!data.Closed) return interaction.reply({ embeds: [errEmbed('This ticket is not closed.')], flags: MessageFlags.Ephemeral });
      if (member.id !== data.OwnerID && !canManage)
                        return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleReopenTicket(interaction, member, data);

    case 'ticket-delete':
      if (!data)        return interaction.reply({ embeds: [errEmbed('No ticket data found.')],                   flags: MessageFlags.Ephemeral });
      if (!canManage)   return interaction.reply({ embeds: [errEmbed('No permission.')],                          flags: MessageFlags.Ephemeral });
      if (!data.Closed) return interaction.reply({ embeds: [errEmbed('Close the ticket first before deleting.')], flags: MessageFlags.Ephemeral });
      return handleDeleteTicket(interaction, data);

    case 'ticket-transcript':
      if (!data || !canManage) return interaction.reply({ embeds: [errEmbed('No permission.')], flags: MessageFlags.Ephemeral });
      return handleSendTranscript(interaction, data);

    case 'stop-delete':
      return interaction.deferUpdate();
  }
}

module.exports = {
  name: 'interactionCreate',
  execute:                 executeTicketInteraction,
  handleTicketInteraction: executeTicketInteraction, // cb-worker.js uses this alias
};