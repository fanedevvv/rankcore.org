'use strict';

/**
 * Events/Client/guildMemberRemove_tickets.js
 *
 * When a member leaves the guild:
 *  1. Auto-closes any open tickets they own
 *  2. Auto-denies any pending application submissions
 */

const {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const TicketSchema               = require('../../Schemas/Ticket');
const TicketSetup                = require('../../Schemas/TicketSetup');
const StaffApplicationSubmission = require('../../Schemas/staffApplicationSubmission');
const StaffApplication           = require('../../Schemas/staffApplicationSchema');
const TranscriptSchema           = require('../../Schemas/transcript');

// -- Helpers -------------------------------------------------------------------

function fullTs(date) {
  return `<t:${Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000)}:f>`;
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// -- Ticket auto-close ---------------------------------------------------------

async function closeTicketsForMember(member, client) {
  const { guild, id: userId } = member;

  const docs = await TicketSetup.findOne({ GuildID: guild.id });
  if (!docs) return;

  // Find all open tickets owned by this user in this guild
  const openTickets = await TicketSchema.find({
    GuildID: guild.id,
    OwnerID: userId,
    Closed:  false,
  });

  if (!openTickets.length) return;

  for (const data of openTickets) {
    try {
      const ticketChannel = await guild.channels.fetch(data.ChannelID).catch(() => null);

      const reason   = `${member.user.tag} left the server.`;
      const duration = data.CreatedAt ? formatDuration(Date.now() - new Date(data.CreatedAt).getTime()) : 'Unknown';

      // -- Web transcript ------------------------------------------------------
      let webTranscriptLink = null;
      if (docs.SaveWebTranscript !== false && ticketChannel) {
        try {
          const msgs = await ticketChannel.messages.fetch({ limit: -1 });
          await TranscriptSchema.create({
            TicketID:    data.TicketID,
            GuildID:     guild.id,
            ChannelName: ticketChannel.name,
            OpenedBy:    { id: userId, username: member.user.username, avatar: null },
            ClosedBy:    { id: client.user.id, username: client.user.username, avatar: client.user.displayAvatarURL() },
            Messages:    msgs.reverse().map(m => ({
              authorId:    m.author.id,
              authorName:  m.author.username,
              authorAvatar: m.author.displayAvatarURL(),
              content:     m.content,
              timestamp:   m.createdTimestamp,
              isBot:       m.author.bot,
              attachments: m.attachments.map(a => ({ url: a.url, name: a.name, contentType: a.contentType })),
            })),
            Rating: data.Rating ?? null,
          });
          if (client.config?.dashboard?.enabled && client.config?.dashboard?.domain) {
            webTranscriptLink = `${client.config.dashboard.domain}/guild/${guild.id}/transcripts/${data.TicketID}`;
          }
        } catch (e) {
          console.error('[MemberLeave] Web transcript error:', e);
        }
      }

      // -- Post closed message in ticket channel -------------------------------
      if (ticketChannel) {
        const closedEmbed = new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('<:lockk:1555544494441635860> Ticket Auto-Closed')
          .setDescription(`This ticket was automatically closed because **${member.user.tag}** left the server.`)
          .addFields(
            { name: '<:user:1555544664155889668> Owner',      value: `<@${userId}>`,        inline: true },
            { name: '<:gw:1555544456873119875> Ticket',       value: `#${data.TicketID}`,   inline: true },
            { name: '<:1430986244921495654:1555544239792980044> Duration',   value: duration,               inline: true },
            { name: '<:files:1555544445565407352> Reason',    value: reason,                 inline: false },
          )
          .setTimestamp();

        const closeButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket-delete').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji('<:del:1555544395720302643>'),
          new ButtonBuilder().setCustomId('ticket-transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji('<:files:1555544445565407352>'),
        );
        if (webTranscriptLink) {
          closeButtons.addComponents(
            new ButtonBuilder().setLabel('View Online').setStyle(ButtonStyle.Link).setURL(webTranscriptLink),
          );
        }

        // Lock the channel for everyone since owner left
        await ticketChannel.permissionOverwrites.edit(userId, {
          [PermissionFlagsBits.ViewChannel]:       false,
          [PermissionFlagsBits.SendMessages]:      false,
          [PermissionFlagsBits.ReadMessageHistory]:false,
        }).catch(() => {});

        await ticketChannel.send({ embeds: [closedEmbed], components: [closeButtons] }).catch(() => {});
      }

      // -- Update DB -----------------------------------------------------------
      await TicketSchema.updateOne(
        { ChannelID: data.ChannelID },
        { Closed: true, ClosedAt: new Date() },
      );

      // -- Log channel ---------------------------------------------------------
      const logChannelId = data.Category
        ? docs.Categories?.find(c => c.value === data.Category)?.submissionChannelId || docs.Transcripts
        : docs.Transcripts;

      if (logChannelId) {
        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`<:files:1555544445565407352> Auto-Closed � ${docs.TicketPrefix || 'ticket'}-${data.TicketID}`)
            .addFields(
              { name: '<:user:1555544664155889668> Owner',    value: `<@${userId}>`,      inline: true },
              { name: '<:gw:1555544456873119875> Ticket',     value: `#${data.TicketID}`, inline: true },
              { name: '<:1430986244921495654:1555544239792980044> Duration', value: duration,             inline: true },
              { name: '<:files:1555544445565407352> Reason',  value: reason,               inline: false },
            )
            .setTimestamp()
            .setFooter({ text: 'Roco Ticket System � Member Left' });

          if (webTranscriptLink) {
            logEmbed.addFields({ name: '<:1430986225493479485:1555544207652032633> Transcript', value: `[View Online](${webTranscriptLink})` });
          }

          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`[MemberLeave] Failed to close ticket ${data.TicketID}:`, err);
    }
  }
}

// -- Application auto-deny -----------------------------------------------------

async function denyApplicationsForMember(member, client) {
  const { guild, id: userId } = member;

  const pendingSubmissions = await StaffApplicationSubmission.find({
    guildId: guild.id,
    userId,
    status:  'pending',
  });

  if (!pendingSubmissions.length) return;

  for (const submission of pendingSubmissions) {
    try {
      // Update status to denied
      await StaffApplicationSubmission.updateOne(
        { submissionId: submission.submissionId },
        {
          status:     'denied',
          reviewedBy: client.user.id,
          reviewNote: 'Applicant left the server.',
        },
      );

      const panel = await StaffApplication.findOne({ panelId: submission.panelId });
      if (!panel) continue;

      // -- Update the log channel message --------------------------------------
      if (submission.logMessageId && submission.logChannelId) {
        const logChannel = await guild.channels.fetch(submission.logChannelId).catch(() => null);
        if (logChannel) {
          const updatedEmbed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`${panel.emoji || '<:files:1555544445565407352>'} ${panel.name} Application`)
            .setDescription(
              `**Applicant:** <@${userId}> (${submission.userTag})\n` +
              `**Status:** <:crossy:1555544390221562048> Auto-Denied\n` +
              `**Reason:** Applicant left the server.`
            )
            .setFooter({ text: `Submission ID: ${submission.submissionId}` })
            .setTimestamp();

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`staffapp_accept:${submission.submissionId}`).setLabel('Accept').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId(`staffapp_deny:${submission.submissionId}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setDisabled(true),
          );

          try {
            const logMsg = await logChannel.messages.fetch(submission.logMessageId);
            await logMsg.edit({ embeds: [updatedEmbed], components: [disabledRow] });
          } catch { /* message may have been deleted */ }
        }
      }
    } catch (err) {
      console.error(`[MemberLeave] Failed to deny application ${submission.submissionId}:`, err);
    }
  }
}

// -- Export --------------------------------------------------------------------

module.exports = {
  name: Events.GuildMemberRemove,

  async execute(member, client) {
    if (member.user?.bot) return;

    // Run both in parallel � failures in one won't block the other
    await Promise.allSettled([
      closeTicketsForMember(member, client),
      denyApplicationsForMember(member, client),
    ]);
  },
};