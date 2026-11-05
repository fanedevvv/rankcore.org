'use strict';

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { modActionContainer, errorContainer, ACCENT } = require('../../Utils/v2helpers');
const StaffCommands = require('../../Schemas/staffCommandsSchema');
const StaffAction   = require('../../Schemas/staffActionSchema');

const DEFAULT_RANK_TIERS = [
  { value: 'trial_staff',      label: 'Trial Staff',      color: 0x94a3b8 },
  { value: 'junior_moderator', label: 'Junior Moderator', color: 0x60a5fa },
  { value: 'moderator',        label: 'Moderator',        color: 0x3b82f6 },
  { value: 'senior_moderator', label: 'Senior Moderator', color: 0x6366f1 },
  { value: 'admin',            label: 'Admin',            color: 0xa855f7 },
  { value: 'head_admin',       label: 'Head Admin',       color: 0xec4899 },
  { value: 'management',       label: 'Management',       color: 0xf97316 },
  { value: 'custom',           label: 'Custom / Other',   color: 0x22c55e },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a staff member to a new rank.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('The staff member to promote.').setRequired(true))
    .addStringOption(o =>
      o.setName('new_rank').setDescription('The rank they are being promoted to.').setRequired(true)
        .addChoices(...DEFAULT_RANK_TIERS.map(r => ({ name: r.label, value: r.value }))))
    .addStringOption(o =>
      o.setName('previous_rank').setDescription('The rank they are being promoted from.').setRequired(false))
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the promotion.').setRequired(false).setMaxLength(512))
    .addRoleOption(o =>
      o.setName('give_role').setDescription('Override: role to assign (overrides dashboard tier setting).').setRequired(false))
    .addRoleOption(o =>
      o.setName('remove_role').setDescription('Override: role to remove (overrides dashboard tier setting).').setRequired(false))
    .addBooleanOption(o =>
      o.setName('dm_user').setDescription('DM the user a promotion notice (default: true).').setRequired(false))
    .addChannelOption(o =>
      o.setName('announce_channel').setDescription('Override: announce channel (overrides dashboard setting).').setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target             = interaction.options.getMember('user');
    const newRankVal         = interaction.options.getString('new_rank');
    const prevRankStr        = interaction.options.getString('previous_rank') || 'Previous Rank';
    const reason             = interaction.options.getString('reason') || 'No reason provided.';
    const giveRoleOverride   = interaction.options.getRole('give_role');
    const removeRoleOverride = interaction.options.getRole('remove_role');
    const dmUser             = interaction.options.getBoolean('dm_user') ?? true;
    const annChanOverride    = interaction.options.getChannel('announce_channel');

    if (!target) {
      return interaction.editReply({
        components: [errorContainer('User Not Found', 'That user could not be found in this server.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    if (target.id === interaction.user.id) {
      return interaction.editReply({
        components: [errorContainer('Invalid Target', 'You cannot promote yourself.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── Load dashboard settings ───────────────────────────────────────────────
    const cfg      = await StaffCommands.findOne({ guildId: interaction.guild.id }).lean().catch(() => null);
    const settings = cfg?.promote ?? {};

    const annChan = annChanOverride
      ?? (settings.announceChannelId ? interaction.guild.channels.cache.get(settings.announceChannelId) ?? null : null);
    const logChan = settings.logChannelId
      ? interaction.guild.channels.cache.get(settings.logChannelId) ?? null
      : null;

    // Resolve roles: command args first, then matching dashboard tier by name
    let giveRole   = giveRoleOverride   ?? null;
    let removeRole = removeRoleOverride ?? null;
    if (!giveRole && settings.tiers?.length) {
      const matchedTier = settings.tiers.find(
        t => t.name?.toLowerCase() === newRankVal.replace(/_/g, ' ').toLowerCase()
          || t.name?.toLowerCase() === newRankVal.toLowerCase(),
      );
      if (matchedTier?.roleId)
        giveRole = interaction.guild.roles.cache.get(matchedTier.roleId) ?? null;
    }

    const rankMeta      = DEFAULT_RANK_TIERS.find(r => r.value === newRankVal);
    const newRank       = rankMeta?.label ?? newRankVal;
    const accent        = rankMeta?.color ?? ACCENT.success;
    const promoMessage  = settings.promotionMessage?.trim()
      ? settings.promotionMessage
          .replace('{user}',   target.toString())
          .replace('{rank}',   newRank)
          .replace('{prev}',   prevRankStr)
          .replace('{reason}', reason)
      : null;

    const errors = [];

    if (giveRole) {
      try { await target.roles.add(giveRole, `Promotion by ${interaction.user.tag}: ${reason}`); }
      catch { errors.push(`Could not assign ${giveRole.name} — check my role hierarchy.`); }
    }
    if (removeRole) {
      try { await target.roles.remove(removeRole, `Promotion old-rank removal by ${interaction.user.tag}`); }
      catch { errors.push(`Could not remove ${removeRole.name} — check my role hierarchy.`); }
    }

    if (dmUser) {
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(accent)
          .setTitle('<:boost:1555544362455146576> You\'ve been promoted!')
          .setDescription(
            promoMessage ??
            `Congratulations! You have been promoted in **${interaction.guild.name}**.\n\n` +
            `**From:** ${prevRankStr}\n**To:** ${newRank}\n\n` +
            (reason !== 'No reason provided.' ? `**Note:** ${reason}` : '')
          )
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `Promoted by ${interaction.user.tag}` });

        await target.user.send({ embeds: [dmEmbed] });
      } catch {
        errors.push('Could not DM the user (their DMs may be closed).');
      }
    }

    if (annChan?.isTextBased()) {
      try {
        const annEmbed = new EmbedBuilder()
          .setColor(accent)
          .setTitle('<:boost:1555544362455146576> Staff Promotion')
          .setDescription(
            promoMessage ??
            `Please congratulate ${target.toString()} on their promotion!\n\n` +
            `**${prevRankStr}** → **${newRank}**`
          )
          .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `Promoted by ${interaction.user.tag}` });

        await annChan.send({ embeds: [annEmbed] });
      } catch {
        errors.push(`Could not post announcement in #${annChan.name}.`);
      }
    }

    if (logChan?.isTextBased() && logChan.id !== annChan?.id) {
      try {
        const logEmbed = new EmbedBuilder()
          .setColor(accent)
          .setTitle('<:boost:1555544362455146576> Staff Promotion Log')
          .addFields(
            { name: 'Staff Member', value: `${target.toString()} (\`${target.user.tag}\`)`, inline: true },
            { name: 'Promoted By',  value: interaction.user.toString(), inline: true },
            { name: 'From → To',    value: `${prevRankStr} → ${newRank}`, inline: false },
            { name: 'Reason',       value: reason },
            ...(giveRole   ? [{ name: 'Role Assigned', value: giveRole.name,   inline: true }] : []),
            ...(removeRole ? [{ name: 'Role Removed',  value: removeRole.name, inline: true }] : []),
          )
          .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: 'Logged by RankCore' });

        await logChan.send({ embeds: [logEmbed] });
      } catch {
        errors.push(`Could not log to #${logChan.name}.`);
      }
    }

    // ── Save action record ────────────────────────────────────────────────────
    StaffAction.create({
      guildId:     interaction.guild.id,
      targetId:    target.id,
      targetTag:   target.user.tag,
      issuerId:    interaction.user.id,
      issuerTag:   interaction.user.tag,
      action:      'promote',
      reason,
      newRank,
      roleAdded:   giveRole?.id   ?? null,
      roleRemoved: removeRole?.id ?? null,
    }).catch(() => {});

    const extra = [
      `**New Rank** — ${newRank}`,
      `**From** — ${prevRankStr}`,
      giveRole   ? `**Role Added** — ${giveRole.name}`     : null,
      removeRole ? `**Role Removed** — ${removeRole.name}` : null,
      annChan    ? `**Announced in** — <#${annChan.id}>`   : null,
      logChan && logChan.id !== annChan?.id
                 ? `**Logged in** — <#${logChan.id}>`      : null,
      errors.length
        ? `\n<:error:1555544434601369620> ${errors.join('\n<:error:1555544434601369620> ')}`
        : null,
    ].filter(Boolean).join('\n');

    return interaction.editReply({
      components: [modActionContainer(
        '<:boost:1555544362455146576>', 'Staff Promotion',
        `${target.toString()} (${target.user.tag})`,
        reason,
        { accent, extra, clientId: client.user.id },
      )],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
