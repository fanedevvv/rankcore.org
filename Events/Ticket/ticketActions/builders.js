'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SectionBuilder, ThumbnailBuilder,
  SeparatorSpacingSize,
} = require('discord.js');

const { parseEmoji }                   = require('../../../Utils/emojis');
const { PRIORITY_META, CV2 }           = require('./constants');
const { hexToInt, fullTs, formatDuration, relativeTs } = require('./helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Welcome embed
// ─────────────────────────────────────────────────────────────────────────────

function buildWelcomeV2(docs, category, member, reason, priority, ticketId, intakeAnswers = []) {
  const pmeta      = priority ? PRIORITY_META[priority] : null;
  const accentInt  = pmeta ? pmeta.color : hexToInt(docs.Color);
  const catName    = category?.name || 'General';
  const welcomeMsg = category?.welcomeMessage || docs.WelcomeMessage || 'A staff member will be with you shortly.';
  const titleText  = docs.WelcomeTitle || 'Support Ticket';

  const embed = new EmbedBuilder()
    .setColor(accentInt)
    .setAuthor({ name: titleText, iconURL: member.user.displayAvatarURL({ size: 64, extension: 'png' }) })
    .setTitle(`<:gw:1555544456873119875> Ticket Opened`)
    .setDescription(`Ticket \`#${ticketId}\` · **${catName}**`)
    .addFields(
      { name: '<:user:1555544664155889668> Opened by', value: `${member.toString()}`, inline: true },
      { name: '<:files:1555544445565407352> Category', value: catName, inline: true },
      { name: '<:1430986244921495654:1555544239792980044> Created', value: fullTs(new Date()), inline: true },
    );

  if (pmeta) embed.addFields({ name: `${pmeta.emoji} Priority`, value: pmeta.label, inline: true });
  if (docs.EnableRating) embed.addFields({ name: '<:boost:1555544362455146576> Rating', value: 'enabled', inline: true });

  if (Array.isArray(intakeAnswers) && intakeAnswers.length > 0) {
    const answersText = intakeAnswers
      .filter(a => a.answer)
      .map(a => `**${a.question}**\n> ${a.answer.replace(/\n/g, '\n> ')}`)
      .join('\n\n');
    if (answersText) {
      embed.addFields({ name: '<:files:1555544445565407352> Responses', value: answersText });
    }
  } else if (reason) {
    embed.addFields({ name: '<:files:1555544445565407352> Reason', value: `> ${reason.replace(/\n/g, '\n> ')}` });
  }

  embed.setFooter({ text: `${welcomeMsg}${docs.FooterText ? ` · ${docs.FooterText}` : ''}` });

  if (docs.BannerURL) embed.setImage(docs.BannerURL);

  return { embeds: [embed] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Components V2 — Closed message
// ─────────────────────────────────────────────────────────────────────────────

function buildClosedV2(closer, data, reason, webTranscriptLink) {
  const pmeta    = data.Priority ? PRIORITY_META[data.Priority] : null;
  const duration = data.CreatedAt ? formatDuration(Date.now() - new Date(data.CreatedAt).getTime()) : 'Unknown';

  const headerText = new TextDisplayBuilder().setContent(
    `## <:lockk:1555544494441635860> Ticket Closed\n-# Ticket \`#${data.TicketID}\` · Duration: **${duration}**`
  );
  const closerThumb = new ThumbnailBuilder()
    .setURL(closer.user.displayAvatarURL({ size: 64, extension: 'png' }));
  const headerSection = new SectionBuilder()
    .addTextDisplayComponents(headerText)
    .setThumbnailAccessory(closerThumb);

  const sep1 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

  const summaryLines = [
    `<:lockk:1555544494441635860> **Closed by** ${closer.toString()}`,
    `<:user:1555544664155889668> **Opened by** <@${data.OwnerID}>`,
    `<:1430986244921495654:1555544239792980044> **Closed** ${fullTs(new Date())}`,
  ];
  if (data.CreatedAt) summaryLines.push(`<:1430986244921495654:1555544239792980044> **Open for** ${duration}`);
  if (pmeta)          summaryLines.push(`${pmeta.emoji} **Priority** ${pmeta.label}`);
  if (data.AssignedTo) summaryLines.push(`<:minigames:1555544500179439707> **Assigned to** <@${data.AssignedTo}>`);
  if (data.ClaimedBy && data.ClaimedBy !== data.AssignedTo)
    summaryLines.push(`<:restrict:1555544549105999962> **Claimed by** <@${data.ClaimedBy}>`);
  if (data.Tags?.length)
    summaryLines.push(`<:thread:1555544613035708426> **Tags** ${data.Tags.map(t => `\`${t}\``).join(' ')}`);
  if (data.Rating)
    summaryLines.push(`<:boost:1555544362455146576> **Rating** ${'<:boost:1555544362455146576>'.repeat(data.Rating)} (${data.Rating}/5)`);

  const summaryText = new TextDisplayBuilder().setContent(summaryLines.join('\n'));

  const sep2      = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);
  const reasonText = new TextDisplayBuilder().setContent(
    `### <:files:1555544445565407352> Close Reason\n> ${reason.replace(/\n/g, '\n> ')}`
  );

  const container = new ContainerBuilder()
    .setAccentColor(0xef4444)
    .addSectionComponents(headerSection)
    .addSeparatorComponents(sep1)
    .addTextDisplayComponents(summaryText)
    .addSeparatorComponents(sep2)
    .addTextDisplayComponents(reasonText);

  if (webTranscriptLink) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(false))
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# <:files:1555544445565407352> [View transcript online](${webTranscriptLink})`)
      );
  }

  return { components: [container], flags: CV2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Components V2 — Status card (claim, reopen, lock, priority etc.)
// ─────────────────────────────────────────────────────────────────────────────

function buildStatusV2(accentColor, icon, title, lines) {
  const headerText = new TextDisplayBuilder().setContent(`## ${icon} ${title}`);
  const bodyText   = new TextDisplayBuilder().setContent(lines.join('\n'));
  const sep        = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true);

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(headerText)
    .addSeparatorComponents(sep)
    .addTextDisplayComponents(bodyText);

  return { components: [container], flags: CV2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action button rows (V1 ActionRows — still required for interactions)
// ─────────────────────────────────────────────────────────────────────────────

function buildActionRows(docs) {
  const rows = [];

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji(parseEmoji('<:lockk:1555544494441635860>')),
    new ButtonBuilder().setCustomId('ticket-lock').setLabel('Lock').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:lockk:1555544494441635860>')),
    new ButtonBuilder().setCustomId('ticket-unlock').setLabel('Unlock').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:lockk:1555544494441635860>')),
    new ButtonBuilder().setCustomId('ticket-claim').setLabel('Claim').setStyle(ButtonStyle.Primary).setEmoji(parseEmoji('<:restrict:1555544549105999962>')),
    new ButtonBuilder().setCustomId('ticket-unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:restrict:1555544549105999962>')),
  ));

  const tools = [
    new ButtonBuilder().setCustomId('ticket-manage').setLabel('Add/Remove').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:user:1555544664155889668>')),
    new ButtonBuilder().setCustomId('ticket-note').setLabel('Note').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:files:1555544445565407352>')),
    new ButtonBuilder().setCustomId('ticket-assign').setLabel('Assign').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:minigames:1555544500179439707>')),
  ];
  if (docs.Tags?.length > 0)  tools.push(new ButtonBuilder().setCustomId('ticket-tag').setLabel('Tag').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:thread:1555544613035708426>')));
  if (docs.EnablePriority)    tools.push(new ButtonBuilder().setCustomId('ticket-priority').setLabel('Priority').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:thunderr:1555544623735242883>')));

  rows.push(new ActionRowBuilder().addComponents(tools.slice(0, 5)));
  return rows;
}

function buildPriorityRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-set-priority-low').setLabel('Low').setStyle(ButtonStyle.Success).setEmoji(parseEmoji('<:LEgreen:1555544256356159600>')),
    new ButtonBuilder().setCustomId('ticket-set-priority-medium').setLabel('Medium').setStyle(ButtonStyle.Primary).setEmoji(parseEmoji('<:error:1555544434601369620>')),
    new ButtonBuilder().setCustomId('ticket-set-priority-high').setLabel('High').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:error:1555544434601369620>')),
    new ButtonBuilder().setCustomId('ticket-set-priority-urgent').setLabel('Urgent').setStyle(ButtonStyle.Danger).setEmoji(parseEmoji('<:LEred:1555544262123323422>')),
  );
}

function buildCloseRow(webTranscriptLink) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket-reopen').setLabel('Reopen').setStyle(ButtonStyle.Primary).setEmoji(parseEmoji('<:lockk:1555544494441635860>')),
    new ButtonBuilder().setCustomId('ticket-delete').setLabel('Delete').setStyle(ButtonStyle.Danger).setEmoji(parseEmoji('<:del:1555544395720302643>')),
    new ButtonBuilder().setCustomId('ticket-transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:files:1555544445565407352>')),
  );
  if (webTranscriptLink) {
    row.addComponents(new ButtonBuilder().setLabel('View Online').setStyle(ButtonStyle.Link).setURL(webTranscriptLink).setEmoji(parseEmoji('<:1430986225493479485:1555544207652032633>')));
  }
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich embeds (for DMs and log channels — DMs don't support CV2)
// ─────────────────────────────────────────────────────────────────────────────

function buildCloseDMEmbed(member, data, reason, docs, webTranscriptLink) {
  const pmeta    = data.Priority ? PRIORITY_META[data.Priority] : null;
  const duration = data.CreatedAt ? formatDuration(Date.now() - new Date(data.CreatedAt).getTime()) : 'Unknown';

  const embed = new EmbedBuilder()
    .setTitle('<:lockk:1555544494441635860> Your Ticket Was Closed')
    .setColor(0xef4444)
    .setDescription(docs.CloseMessage || 'Your support ticket has been closed. Thank you for reaching out!')
    .addFields(
      { name: '<:gw:1555544456873119875> Ticket',    value: `#${data.TicketID}`, inline: true },
      { name: '<:1430986244921495654:1555544239792980044> Duration',  value: duration,            inline: true },
      { name: '<:lockk:1555544494441635860> Closed By', value: `<@${member.id}>`,   inline: true },
      { name: '<:1430986244921495654:1555544239792980044> Closed At', value: fullTs(new Date()),   inline: true },
    );

  if (data.CreatedAt)  embed.addFields({ name: '<:calendar:1555544372953616426> Opened At', value: fullTs(data.CreatedAt), inline: true });
  if (pmeta)           embed.addFields({ name: `${pmeta.emoji} Priority`, value: pmeta.label, inline: true });
  if (data.AssignedTo) embed.addFields({ name: '<:minigames:1555544500179439707> Assigned To', value: `<@${data.AssignedTo}>`, inline: true });
  if (data.Tags?.length) embed.addFields({ name: '<:thread:1555544613035708426> Tags', value: data.Tags.map(t => `\`${t}\``).join(' ') });

  embed.addFields({ name: '<:files:1555544445565407352> Reason', value: reason });
  if (webTranscriptLink) embed.addFields({ name: '<:files:1555544445565407352> Transcript', value: `[View Online](${webTranscriptLink})` });

  embed
    .setFooter({ text: 'We hope your issue was resolved. You can rate your experience below.' })
    .setTimestamp();
  return embed;
}

function buildLogEmbed(data, closer, reason, docs, webTranscriptLink) {
  const pmeta    = data.Priority ? PRIORITY_META[data.Priority] : null;
  const duration = data.CreatedAt ? formatDuration(Date.now() - new Date(data.CreatedAt).getTime()) : 'Unknown';

  const embed = new EmbedBuilder()
    .setTitle(`<:files:1555544445565407352> Transcript — ${docs.TicketPrefix || 'ticket'}-${data.TicketID}`)
    .setColor(0x6C53FF)
    .setThumbnail(closer.user.displayAvatarURL({ size: 64 }))
    .addFields(
      { name: '<:user:1555544664155889668> Owner',      value: `<@${data.OwnerID}>`, inline: true },
      { name: '<:lockk:1555544494441635860> Closed By',  value: `<@${closer.id}>`,   inline: true },
      { name: '<:gw:1555544456873119875> Ticket ID',   value: `#${data.TicketID}`,  inline: true },
      { name: '<:calendar:1555544372953616426> Opened',     value: data.CreatedAt ? fullTs(data.CreatedAt) : 'Unknown', inline: true },
      { name: '<:1430986244921495654:1555544239792980044> Closed',     value: fullTs(new Date()), inline: true },
      { name: '<:1430986244921495654:1555544239792980044> Duration',   value: duration, inline: true },
    );

  if (data.Category)   embed.addFields({ name: '<:files:1555544445565407352> Category', value: data.Category, inline: true });
  if (pmeta)           embed.addFields({ name: `${pmeta.emoji} Priority`, value: pmeta.label, inline: true });
  if (data.AssignedTo) embed.addFields({ name: '<:minigames:1555544500179439707> Assigned To', value: `<@${data.AssignedTo}>`, inline: true });
  if (data.ClaimedBy)  embed.addFields({ name: '<:restrict:1555544549105999962> Claimed By', value: `<@${data.ClaimedBy}>`, inline: true });
  if (data.Tags?.length) embed.addFields({ name: '<:thread:1555544613035708426> Tags', value: data.Tags.join(', '), inline: true });
  if (data.Rating)       embed.addFields({ name: '<:boost:1555544362455146576> Rating', value: `${'<:boost:1555544362455146576>'.repeat(data.Rating)} (${data.Rating}/5)`, inline: true });

  embed.addFields({ name: '<:files:1555544445565407352> Close Reason', value: reason });
  if (webTranscriptLink) embed.addFields({ name: '<:1430986225493479485:1555544207652032633> Online Transcript', value: `[View Transcript](${webTranscriptLink})` });

  embed.setTimestamp().setFooter({ text: 'Roco Ticket System' });
  return embed;
}

module.exports = {
  buildWelcomeV2,
  buildClosedV2,
  buildStatusV2,
  buildActionRows,
  buildPriorityRow,
  buildCloseRow,
  buildCloseDMEmbed,
  buildLogEmbed,
};