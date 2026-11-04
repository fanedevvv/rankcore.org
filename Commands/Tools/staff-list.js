'use strict';
const { parseEmoji } = require('discord.js');

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  EmbedBuilder, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const staffrole = require('../../Schemas/staffrole');
const { StaffRating } = require('../../Schemas/staffRatingSchema');
const { successContainer, errorContainer, ACCENT } = require('../../Utils/v2helpers');

// How many staff to show per page
const PER_PAGE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-list')
    .setDescription('Display the server\'s staff team.')
    .setDMPermission(false)
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('Show the full staff list for this server.')
      .addBooleanOption(o => o.setName('show_ratings').setDescription('Include community ratings next to each staff member (default: true).').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('add-role')
      .setDescription('Add a role to the staff list.')
      .addRoleOption(o => o.setName('role').setDescription('The staff role to register.').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remove-role')
      .setDescription('Remove a role from the staff list.')
      .addRoleOption(o => o.setName('role').setDescription('The staff role to remove.').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('roles')
      .setDescription('List all registered staff roles.')
    ),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── ADD ROLE ──────────────────────────────────────────────────────────────
    if (sub === 'add-role') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
          components: [errorContainer('Missing Permission', 'You need **Manage Server** to modify staff roles.', { clientId: client.user.id })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const role = interaction.options.getRole('role');
      const exists = await staffrole.findOne({ Guild: guildId, Role: role.id });
      if (exists) {
        return interaction.editReply({
          components: [errorContainer('Already Registered', `${role.toString()} is already a staff role.`, { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      await staffrole.create({ Guild: guildId, Role: role.id });
      return interaction.editReply({
        components: [successContainer('Staff Role Added', `${role.toString()} has been added to the staff list.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── REMOVE ROLE ───────────────────────────────────────────────────────────
    if (sub === 'remove-role') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
          components: [errorContainer('Missing Permission', 'You need **Manage Server** to modify staff roles.', { clientId: client.user.id })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const role = interaction.options.getRole('role');
      const deleted = await staffrole.deleteOne({ Guild: guildId, Role: role.id });
      if (!deleted.deletedCount) {
        return interaction.editReply({
          components: [errorContainer('Not Found', `${role.toString()} is not a registered staff role.`, { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      return interaction.editReply({
        components: [successContainer('Staff Role Removed', `${role.toString()} has been removed from the staff list.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── LIST ROLES ────────────────────────────────────────────────────────────
    if (sub === 'roles') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const roles = await staffrole.find({ Guild: guildId });
      if (!roles.length) {
        return interaction.editReply({
          components: [errorContainer('No Staff Roles', 'No staff roles have been registered. Use `/staff-list add-role` to add one.', { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }
      const lines = roles.map(r => `• <@&${r.Role}>`).join('\n');
      return interaction.editReply({
        components: [successContainer('Registered Staff Roles', lines, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── VIEW ──────────────────────────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply();
      const showRatings = interaction.options.getBoolean('show_ratings') ?? true;

      // Fetch all registered staff role IDs for this guild
      const registeredRoles = await staffrole.find({ Guild: guildId }).lean();
      if (!registeredRoles.length) {
        return interaction.editReply({
          components: [errorContainer('No Staff Roles', 'No staff roles have been configured yet. An admin can use `/staff-list add-role` to set them up.', { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // Fetch all guild members (cached or force fetch)
      let members;
      try {
        members = await interaction.guild.members.fetch();
      } catch {
        members = interaction.guild.members.cache;
      }

      const roleIds = new Set(registeredRoles.map(r => r.Role));

      // Group members by role (highest registered role first)
      const grouped = new Map(); // roleId => Member[]
      for (const roleId of roleIds) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) continue;
        const roleMembers = members.filter(m => m.roles.cache.has(roleId) && !m.user.bot);
        if (roleMembers.size) grouped.set(roleId, { role, members: [...roleMembers.values()] });
      }

      if (!grouped.size) {
        return interaction.editReply({
          components: [errorContainer('No Staff Found', 'No members currently hold any registered staff roles.', { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      // Build flat list sorted by role position (highest first)
      const sortedRoles = [...grouped.entries()]
        .sort((a, b) => (b[1].role.position ?? 0) - (a[1].role.position ?? 0));

      // Fetch ratings if requested
      let ratingsMap = new Map(); // userId => averageScore
      if (showRatings) {
        const allStaffIds = sortedRoles.flatMap(([, g]) => g.members.map(m => m.id));
        const ratings = await StaffRating.find({ guildId, staffId: { $in: allStaffIds } }).lean();
        for (const r of ratings) ratingsMap.set(r.staffId, r.averageScore);
      }

      // Build embed pages
      const buildEmbed = (page, totalPages) => {
        const embed = new EmbedBuilder()
          .setColor(ACCENT.default)
          .setTitle(`<:1430986220011524216:1555544196952367134> Staff Team — ${interaction.guild.name}`)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setFooter({ text: `Page ${page + 1} of ${totalPages} • ${members.filter(m => !m.user.bot && [...roleIds].some(id => m.roles.cache.has(id))).size} staff members total` })
          .setTimestamp();

        let itemCount = 0;
        let pageStart = page * 3; // 3 role groups per page
        let pageEnd   = pageStart + 3;
        let idx = 0;

        for (const [roleId, { role, members: rMembers }] of sortedRoles) {
          if (idx < pageStart || idx >= pageEnd) { idx++; continue; }
          idx++;

          const lines = rMembers.slice(0, PER_PAGE).map(m => {
            const rating = ratingsMap.get(m.id);
            const stars  = rating ? ` <:boost:1555544362455146576> ${rating.toFixed(1)}` : '';
            return `• <@${m.id}>${stars}`;
          });

          if (rMembers.length > PER_PAGE) lines.push(`_...and ${rMembers.length - PER_PAGE} more_`);

          embed.addFields({
            name:   `${role.name} (${rMembers.length})`,
            value:  lines.join('\n') || '_None_',
            inline: false,
          });
          itemCount++;
        }

        return embed;
      };

      const totalPages = Math.ceil(sortedRoles.length / 3);
      let currentPage  = 0;

      const buildRow = (page) => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sl_prev').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('sl_next').setLabel('Next').setEmoji(parseEmoji('<:n_music:1555544516746940416>')).setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
      );

      const msg = await interaction.editReply({
        embeds: [buildEmbed(currentPage, totalPages)],
        components: totalPages > 1 ? [buildRow(currentPage)] : [],
      });

      if (totalPages <= 1) return;

      const collector = msg.createMessageComponentCollector({ time: 120_000 });
      collector.on('collect', async (btn) => {
        if (btn.user.id !== interaction.user.id) {
          return btn.reply({ content: 'Only the command user can navigate pages.', flags: MessageFlags.Ephemeral });
        }
        if (btn.customId === 'sl_prev' && currentPage > 0) currentPage--;
        else if (btn.customId === 'sl_next' && currentPage < totalPages - 1) currentPage++;
        await btn.update({ embeds: [buildEmbed(currentPage, totalPages)], components: [buildRow(currentPage)] });
      });
      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => {});
      });
    }
  },
};
