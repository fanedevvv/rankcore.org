'use strict';

const TicketSchema = require('../../../Schemas/Ticket');
const TicketSetup  = require('../../../Schemas/TicketSetup');
const { PermissionFlagsBits } = require('discord.js');
const { buildStatusV2 }       = require('./builders');
const { relativeTs }          = require('./helpers');

// Stores { closeTimer, warnTimer } per channel id
const autoCloseTimers = new Map();

/**
 * Schedules an auto-close for a ticket channel based on the guild's
 * AutoCloseMinutes setting. Resets the timer whenever a non-bot message is
 * sent, sending a 2-minute inactivity warning before closing.
 */
async function scheduleAutoClose(ticketChannel, docs, data, client) {
  if (!docs.AutoCloseMinutes || docs.AutoCloseMinutes <= 0) return;

  function resetTimer() {
    // Cancel both the pending close timer AND the pending warn timer
    const existing = autoCloseTimers.get(ticketChannel.id);
    if (existing) {
      clearTimeout(existing.closeTimer);
      clearTimeout(existing.warnTimer);
    }

    const warnDelay  = Math.max(0, (docs.AutoCloseMinutes - 2) * 60 * 1000);
    const closeDelay = docs.AutoCloseMinutes * 60 * 1000;

    const warnTimer = setTimeout(async () => {
      // Re-check ticket is still open before sending warning
      const freshData = await TicketSchema.findOne({ ChannelID: ticketChannel.id });
      if (!freshData || freshData.Closed) return;
      const warnMsg = buildStatusV2(0xeab308, '<:1430986244921495654:1567796929587576852>', 'Inactivity Warning', [
        docs.AutoCloseWarningMessage || 'This ticket will be automatically closed in **2 minutes** due to inactivity.',
        `-# <@${data.OwnerID}> — respond to prevent auto-close.`,
      ]);
      await ticketChannel.send({ content: `<@${data.OwnerID}>`, allowedMentions: { users: [data.OwnerID] } }).catch(() => {});
      await ticketChannel.send(warnMsg).catch(() => {});
    }, warnDelay);

    const closeTimer = setTimeout(async () => {
      const freshData = await TicketSchema.findOne({ ChannelID: ticketChannel.id });
      if (!freshData || freshData.Closed) return;
      const freshDocs = await TicketSetup.findOne({ GuildID: ticketChannel.guild.id });
      if (!freshDocs) return;

      if (ticketChannel.permissionOverwrites) {
        await ticketChannel.permissionOverwrites.edit(freshData.OwnerID, {
          [PermissionFlagsBits.SendMessages]: false,
          [PermissionFlagsBits.ReadMessageHistory]: false,
        }).catch(() => {});
      } else if (ticketChannel.isThread?.()) {
        await ticketChannel.members.remove(freshData.OwnerID).catch(() => {});
      }

      const autoMsg = buildStatusV2(0xef4444, '<:lockk:1567796977809367122>', 'Ticket Auto-Closed', [
        'This ticket was automatically closed due to inactivity.',
        `-# Closed ${relativeTs(new Date())}`,
      ]);
      await ticketChannel.send(autoMsg).catch(() => {});
      await TicketSchema.updateOne({ ChannelID: ticketChannel.id }, { Closed: true, ClosedAt: new Date() });
    }, closeDelay);

    autoCloseTimers.set(ticketChannel.id, { closeTimer, warnTimer });
  }

  const collector = ticketChannel.createMessageCollector({ filter: m => !m.author.bot });
  collector.on('collect', () => resetTimer());
  resetTimer();
}

module.exports = { scheduleAutoClose, clearAutoClose: (channelId) => { autoCloseTimers.delete(channelId); } };