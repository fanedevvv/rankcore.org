'use strict';

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags, EmbedBuilder,
} = require('discord.js');
const { StaffRating, StaffRatingConfig } = require('../../Schemas/staffRatingSchema');
const staffrole = require('../../Schemas/staffrole');
const { successContainer, errorContainer, ACCENT } = require('../../Utils/v2helpers');

const STAR_MAP = { 1: '<:boost:1567796953599836280>', 2: '<:boost:1567796953599836280><:boost:1567796953599836280>', 3: '<:boost:1567796953599836280><:boost:1567796953599836280><:boost:1567796953599836280>', 4: '<:boost:1567796953599836280><:boost:1567796953599836280><:boost:1567796953599836280><:boost:1567796953599836280>', 5: '<:boost:1567796953599836280><:boost:1567796953599836280><:boost:1567796953599836280><:boost:1567796953599836280><:boost:1567796953599836280>' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-rating')
    .setDescription('Rate a staff member or manage the rating system.')
    .setDMPermission(false)
    // User-facing
    .addSubcommand(sub => sub
      .setName('rate')
      .setDescription('Rate a staff member (1–5 stars).')
      .addUserOption(o => o.setName('staff').setDescription('The staff member to rate.').setRequired(true))
      .addIntegerOption(o => o.setName('score').setDescription('Your rating (1 = poor, 5 = excellent).').setRequired(true).setMinValue(1).setMaxValue(5))
      .addStringOption(o => o.setName('comment').setDescription('Optional comment (max 300 chars).').setRequired(false).setMaxLength(300))
      .addBooleanOption(o => o.setName('anonymous').setDescription('Submit your rating anonymously (default: false).').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View ratings for a staff member.')
      .addUserOption(o => o.setName('staff').setDescription('The staff member to look up.').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('leaderboard')
      .setDescription('View the top-rated staff members in this server.')
    )
    // Admin
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Configure the staff rating system.')
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable the rating system.').setRequired(true))
      .addChannelOption(o => o.setName('log_channel').setDescription('Channel to post new rating notifications.').setRequired(false))
      .addRoleOption(o => o.setName('staff_role').setDescription('Role that counts as staff (rateable).').setRequired(false))
      .addBooleanOption(o => o.setName('allow_anonymous').setDescription('Allow anonymous ratings (default: true).').setRequired(false))
      .addIntegerOption(o => o.setName('cooldown_hours').setDescription('Hours between ratings from the same user (default: 24).').setMinValue(0).setMaxValue(168).setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('Reset all ratings for a staff member.')
      .addUserOption(o => o.setName('staff').setDescription('The staff member to reset ratings for.').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild);

    // ── SETUP ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      if (!isAdmin) return interaction.reply({
        components: [errorContainer('No Permission', 'You need **Manage Server** to configure the rating system.', { clientId: client.user.id })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const enabled      = interaction.options.getBoolean('enabled');
      const logChannel   = interaction.options.getChannel('log_channel');
      const staffRole    = interaction.options.getRole('staff_role');
      const allowAnon    = interaction.options.getBoolean('allow_anonymous') ?? true;
      const cooldown     = interaction.options.getInteger('cooldown_hours') ?? 24;

      await StaffRatingConfig.findOneAndUpdate(
        { guildId },
        {
          enabled,
          ...(logChannel  ? { logChannelId:   logChannel.id  } : {}),
          ...(staffRole   ? { staffRoleId:     staffRole.id   } : {}),
          allowAnonymous: allowAnon,
          cooldownHours:  cooldown,
        },
        { upsert: true, new: true }
      );

      return interaction.editReply({
        components: [successContainer('<a:tickyy:1567797045253644368> Rating System Configured', [
          `**Status:** ${enabled ? '<:LEgreen:1567796933307666515> Enabled' : '<:LEred:1567796934545121280> Disabled'}`,
          logChannel ? `**Log Channel:** <#${logChannel.id}>` : null,
          staffRole  ? `**Staff Role:** <@&${staffRole.id}>` : null,
          `**Anonymous Ratings:** ${allowAnon ? 'Yes' : 'No'}`,
          `**Cooldown:** ${cooldown}h`,
        ].filter(Boolean).join('\n'), { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── RATE ──────────────────────────────────────────────────────────────────
    if (sub === 'rate') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const cfg = await StaffRatingConfig.findOne({ guildId }).lean();
      if (!cfg?.enabled) return interaction.editReply({
        components: [errorContainer('System Disabled', 'The staff rating system is not enabled in this server.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      const target    = interaction.options.getMember('staff');
      const score     = interaction.options.getInteger('score');
      const comment   = interaction.options.getString('comment') || '';
      const anonymous = interaction.options.getBoolean('anonymous') ?? false;

      if (!target) return interaction.editReply({
        components: [errorContainer('User Not Found', 'That user could not be found in this server.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
      if (target.id === interaction.user.id) return interaction.editReply({
        components: [errorContainer('Invalid Target', 'You cannot rate yourself.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      // Verify target is a staff member
      const staffRoles = await staffrole.find({ Guild: guildId }).lean();
      const isStaff = staffRoles.some(r => target.roles.cache.has(r.Role));
      if (!isStaff) return interaction.editReply({
        components: [errorContainer('Not Staff', 'That user is not a registered staff member.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      let record = await StaffRating.findOne({ guildId, staffId: target.id });
      if (!record) record = new StaffRating({ guildId, staffId: target.id });

      // Override cooldown with config
      const COOLDOWN_MS = (cfg.cooldownHours ?? 24) * 3_600_000;
      const cutoff = new Date(Date.now() - COOLDOWN_MS);
      const recent = record.ratings.find(r => r.raterId === interaction.user.id && r.ratedAt > cutoff);
      if (recent) return interaction.editReply({
        components: [errorContainer('On Cooldown', `You can only rate this staff member once every **${cfg.cooldownHours}h**.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      const result = record.addRating(interaction.user.id, score, comment, anonymous && cfg.allowAnonymous);
      if (!result.success) return interaction.editReply({
        components: [errorContainer('Rating Failed', result.reason, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      await record.save();

      // Log to channel
      if (cfg.logChannelId) {
        const logCh = interaction.guild.channels.cache.get(cfg.logChannelId);
        if (logCh?.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setColor(ACCENT.default)
            .setTitle('<:boost:1567796953599836280> New Staff Rating')
            .addFields(
              { name: 'Staff Member', value: `<@${target.id}> (${target.user.tag})`, inline: true },
              { name: 'Rating', value: `${STAR_MAP[score]} (${score}/5)`, inline: true },
              { name: 'From', value: anonymous && cfg.allowAnonymous ? '_Anonymous_' : `<@${interaction.user.id}>`, inline: true },
              ...(comment ? [{ name: 'Comment', value: comment }] : []),
              { name: 'New Average', value: `${record.averageScore.toFixed(1)} <:boost:1567796953599836280> (${record.totalRatings} ratings)`, inline: true },
            )
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
            .setTimestamp();
          logCh.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      return interaction.editReply({
        components: [successContainer('<:boost:1567796953599836280> Rating Submitted', [
          `You rated **${target.user.username}** ${STAR_MAP[score]}`,
          comment ? `**Your comment:** ${comment}` : null,
          `**Their new average:** ${record.averageScore.toFixed(1)}/5 (${record.totalRatings} total ratings)`,
        ].filter(Boolean).join('\n'), { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── VIEW ──────────────────────────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply();
      const target = interaction.options.getMember('staff');
      if (!target) return interaction.editReply({
        components: [errorContainer('User Not Found', 'That user could not be found.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      const record = await StaffRating.findOne({ guildId, staffId: target.id }).lean();
      if (!record || !record.totalRatings) return interaction.editReply({
        components: [errorContainer('No Ratings', `${target.user.username} has not received any ratings yet.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      // Distribution
      const dist = [5,4,3,2,1].map(s => {
        const count = record.ratings.filter(r => r.score === s).length;
        const bar = '█'.repeat(Math.round((count / record.totalRatings) * 10)).padEnd(10, '░');
        return `${STAR_MAP[s].slice(0,1)} ${s} ${bar} ${count}`;
      }).join('\n');

      // Recent comments
      const comments = record.ratings
        .filter(r => r.comment)
        .slice(-5)
        .reverse()
        .map(r => `> ${r.anonymous ? '_Anonymous_' : `<@${r.raterId}>`}: ${r.comment}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(ACCENT.default)
        .setTitle(`<:boost:1567796953599836280> Staff Rating — ${target.user.username}`)
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Average Score', value: `**${record.averageScore.toFixed(1)} / 5** <:boost:1567796953599836280>`, inline: true },
          { name: 'Total Ratings', value: `${record.totalRatings}`, inline: true },
          { name: 'Distribution', value: `\`\`\`\n${dist}\n\`\`\`` },
          ...(comments ? [{ name: 'Recent Comments', value: comments }] : []),
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── LEADERBOARD ───────────────────────────────────────────────────────────
    if (sub === 'leaderboard') {
      await interaction.deferReply();
      const records = await StaffRating.find({ guildId, totalRatings: { $gte: 3 } })
        .sort({ averageScore: -1, totalRatings: -1 })
        .limit(10).lean();

      if (!records.length) return interaction.editReply({
        components: [errorContainer('No Data', 'No staff members have enough ratings yet (minimum 3).', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

      const medals = ['<:1430986209995526274:1567796911350747206>','<:1430986209995526274:1567796911350747206>','<:1430986209995526274:1567796911350747206>'];
      const lines = records.map((r, i) => {
        const medal = medals[i] ?? `**${i+1}.**`;
        return `${medal} <@${r.staffId}> — ${r.averageScore.toFixed(1)} <:boost:1567796953599836280> (${r.totalRatings} ratings)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(ACCENT.default)
        .setTitle(`<:1430986209995526274:1567796911350747206> Top Rated Staff — ${interaction.guild.name}`)
        .setDescription(lines)
        .setFooter({ text: 'Minimum 3 ratings required to appear • Use /staff-rating rate to submit your rating' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── RESET ─────────────────────────────────────────────────────────────────
    if (sub === 'reset') {
      if (!isAdmin) return interaction.reply({
        components: [errorContainer('No Permission', 'You need **Manage Server** to reset ratings.', { clientId: client.user.id })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const target = interaction.options.getMember('staff');
      await StaffRating.deleteOne({ guildId, staffId: target?.id });
      return interaction.editReply({
        components: [successContainer('Ratings Reset', `All ratings for ${target?.user.username ?? 'that user'} have been cleared.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
