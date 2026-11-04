'use strict';

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { successContainer, errorContainer, ACCENT } = require('../../Utils/v2helpers');
const StaffAction = require('../../Schemas/staffActionSchema');

const ACTION_LABELS = {
  verbal_warning:  '💬 Verbal Warning',
  written_warning: '⚠️ Written Warning',
  demotion:        '⬇️ Demotion',
  suspension:      '🔇 Suspension',
  removal:         '🚫 Removal',
  promote:         '⬆️ Promotion',
};

const ACTION_COLOURS = {
  verbal_warning:  0xfbbf24,
  written_warning: 0xf97316,
  demotion:        0xa855f7,
  suspension:      0xef4444,
  removal:         0xdc2626,
  promote:         0x22c55e,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stafflog')
    .setDescription('View staff action history for a member.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(o =>
      o.setName('user')
        .setDescription('The staff member to look up.')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('filter')
        .setDescription('Filter by action type (default: all).')
        .setRequired(false)
        .addChoices(
          { name: '⚠️  Warnings only',    value: 'warnings' },
          { name: '⬇️  Infractions only', value: 'infractions' },
          { name: '⬆️  Promotions only',  value: 'promote' },
        ))
    .addIntegerOption(o =>
      o.setName('limit')
        .setDescription('How many entries to show (default: 10, max: 25).')
        .setMinValue(1).setMaxValue(25).setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getMember('user') ?? interaction.options.getUser('user');
    const filter = interaction.options.getString('filter') ?? 'all';
    const limit  = interaction.options.getInteger('limit')  ?? 10;

    const targetId  = target?.id  ?? target?.user?.id;
    const targetTag = target?.user?.tag ?? target?.tag ?? 'Unknown';

    if (!targetId) {
      return interaction.editReply({
        components: [errorContainer('User Not Found', 'Could not resolve that user.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Build query filter
    const query = { guildId: interaction.guild.id, targetId };
    if (filter === 'warnings') {
      query.action = { $in: ['verbal_warning', 'written_warning'] };
    } else if (filter === 'infractions') {
      query.action = { $in: ['verbal_warning', 'written_warning', 'demotion', 'suspension', 'removal'] };
    } else if (filter === 'promote') {
      query.action = 'promote';
    }

    const records = await StaffAction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .catch(() => []);

    if (!records.length) {
      const filterLabel = filter !== 'all' ? ` (filter: ${filter})` : '';
      return interaction.editReply({
        components: [successContainer(
          '📋 Staff Log',
          `No staff actions found for <@${targetId}>${filterLabel}.`,
          { accent: ACCENT.info, clientId: client.user.id },
        )],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // Count totals for summary
    const all = await StaffAction.find({ guildId: interaction.guild.id, targetId }).lean().catch(() => []);
    const summary = {
      warnings:   all.filter(r => ['verbal_warning','written_warning'].includes(r.action)).length,
      infractions:all.filter(r => ['demotion','suspension','removal'].includes(r.action)).length,
      promotions: all.filter(r => r.action === 'promote').length,
    };

    const embed = new EmbedBuilder()
      .setColor(0xFF3333)
      .setTitle(`📋 Staff Log — ${targetTag}`)
      .setThumbnail(
        (target?.user ?? target)?.displayAvatarURL?.({ dynamic: true }) ?? null
      )
      .setDescription(
        `**Summary:** ${summary.warnings} warning${summary.warnings !== 1 ? 's' : ''} · ` +
        `${summary.infractions} infraction${summary.infractions !== 1 ? 's' : ''} · ` +
        `${summary.promotions} promotion${summary.promotions !== 1 ? 's' : ''}\n` +
        `Showing ${records.length} of ${all.length} total entries`
      )
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    for (const r of records) {
      const label   = ACTION_LABELS[r.action]  ?? r.action;
      const ts      = r.createdAt ? `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:d>` : '—';
      const issuer  = r.issuerId ? `<@${r.issuerId}>` : (r.issuerTag || '—');
      const lines   = [
        `**By:** ${issuer}`,
        `**Reason:** ${r.reason || '—'}`,
        r.details    ? `**Details:** ${r.details}`    : null,
        r.duration   ? `**Duration:** ${r.duration}`  : null,
        r.newRank    ? `**Rank:** ${r.newRank}`        : null,
        r.caseNumber ? `**Case:** ${r.caseNumber}`     : null,
      ].filter(Boolean).join('\n');

      embed.addFields({
        name:   `${label}  •  ${ts}`,
        value:  lines,
        inline: false,
      });
    }

    return interaction.editReply({
      embeds: [embed],
      flags:  MessageFlags.Ephemeral,
    });
  },
};