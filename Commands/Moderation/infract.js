'use strict';

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { modActionContainer, errorContainer, ACCENT } = require('../../Utils/v2helpers');
const { generateCase } = require('./_modUtils');
const StaffCommands  = require('../../Schemas/staffCommandsSchema');
const StaffAction    = require('../../Schemas/staffActionSchema');

const INFRACTION_TYPES = [
  { value: 'verbal_warning',  label: 'Verbal Warning',        icon: '<:error:1555544434601369620>', accent: 0xfbbf24, dm_title: 'Verbal Warning' },
  { value: 'written_warning', label: 'Written Warning',       icon: '<:error:1555544434601369620>', accent: 0xf97316, dm_title: 'Staff Warning' },
  { value: 'demotion',        label: 'Demotion',              icon: '<:down:1555544418407157790>',  accent: 0xa855f7, dm_title: 'Staff Demotion' },
  { value: 'suspension',      label: 'Suspension',            icon: '<:n_music:1555544516746940416>', accent: 0xef4444, dm_title: 'Staff Suspension' },
  { value: 'removal',         label: 'Removal / Termination', icon: '<:LEred:1555544262123323422>', accent: 0xdc2626, dm_title: 'Staff Removal' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infract')
    .setDescription('Issue a staff infraction: warning, demotion, suspension, or removal.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('The staff member receiving the infraction.').setRequired(true))
    .addStringOption(o =>
      o.setName('type').setDescription('Type of infraction.').setRequired(true)
        .addChoices(...INFRACTION_TYPES.map(t => ({ name: `${t.icon}  ${t.label}`, value: t.value }))))
    .addStringOption(o =>
      o.setName('reason').setDescription('Reason for the infraction.').setRequired(true).setMaxLength(1024))
    .addStringOption(o =>
      o.setName('details').setDescription('Additional details or context.').setRequired(false).setMaxLength(1024))
    .addStringOption(o =>
      o.setName('duration').setDescription('Duration (for suspensions, e.g. "3 days", "1 week").').setRequired(false).setMaxLength(64))
    .addRoleOption(o =>
      o.setName('remove_role').setDescription('Override: role to strip (overrides dashboard setting).').setRequired(false))
    .addRoleOption(o =>
      o.setName('give_role').setDescription('Override: role to assign (overrides dashboard setting).').setRequired(false))
    .addBooleanOption(o =>
      o.setName('dm_user').setDescription('Override: DM the user (overrides dashboard setting).').setRequired(false))
    .addChannelOption(o =>
      o.setName('log_channel').setDescription('Override: log channel (overrides dashboard setting).').setRequired(false))
    .addBooleanOption(o =>
      o.setName('silent').setDescription('Only visible to you — do not post publicly.').setRequired(false)),

  async execute(interaction, client) {
    const silent = interaction.options.getBoolean('silent') ?? false;
    await interaction.deferReply({ flags: silent ? MessageFlags.Ephemeral : undefined });

    const target             = interaction.options.getMember('user');
    const typeVal            = interaction.options.getString('type');
    const reason             = interaction.options.getString('reason');
    const details            = interaction.options.getString('details') || null;
    const duration           = interaction.options.getString('duration') || null;
    const removeRoleOverride = interaction.options.getRole('remove_role');
    const giveRoleOverride   = interaction.options.getRole('give_role');
    const dmOverride         = interaction.options.getBoolean('dm_user');
    const logChanOverride    = interaction.options.getChannel('log_channel');

    const meta   = INFRACTION_TYPES.find(t => t.value === typeVal) ?? INFRACTION_TYPES[0];
    const accent = meta.accent;

    if (!target) {
      return interaction.editReply({
        components: [errorContainer('User Not Found', 'That user could not be found in this server.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
    if (target.id === interaction.user.id) {
      return interaction.editReply({
        components: [errorContainer('Invalid Target', 'You cannot infract yourself.', { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── Load dashboard settings ───────────────────────────────────────────────
    const cfg      = await StaffCommands.findOne({ guildId: interaction.guild.id }).lean().catch(() => null);
    const settings = cfg?.infract ?? {};

    const shouldDm = dmOverride !== null ? dmOverride : (settings.dmUser !== false);
    const logChan  = logChanOverride
      ?? (settings.logChannelId ? interaction.guild.channels.cache.get(settings.logChannelId) ?? null : null);

    let removeRole = removeRoleOverride ?? null;
    let giveRole   = giveRoleOverride   ?? null;
    if (!removeRole && !giveRole) {
      if (typeVal === 'demotion' && settings.demoRoleId)
        giveRole = interaction.guild.roles.cache.get(settings.demoRoleId) ?? null;
      else if (typeVal === 'suspension' && settings.suspendRoleId)
        giveRole = interaction.guild.roles.cache.get(settings.suspendRoleId) ?? null;
    }

    const caseNumber = generateCase();
    const errors     = [];

    // ── autoStrip on removal ──────────────────────────────────────────────────
    if (typeVal === 'removal' && settings.autoStrip !== false) {
      const tierRoleIds = (cfg?.promote?.tiers ?? []).map(t => t.roleId).filter(Boolean);
      if (tierRoleIds.length) {
        const toStrip = target.roles.cache.filter(r => tierRoleIds.includes(r.id));
        if (toStrip.size) {
          try { await target.roles.remove([...toStrip.values()], `Staff removal auto-strip by ${interaction.user.tag}`); }
          catch { errors.push('Could not auto-strip promotion-chain roles — check role hierarchy.'); }
        }
      }
    }

    // ── Explicit role changes ─────────────────────────────────────────────────
    if (removeRole) {
      try { await target.roles.remove(removeRole, `Infraction by ${interaction.user.tag}: ${reason}`); }
      catch { errors.push(`Could not remove ${removeRole.name} — check role hierarchy.`); }
    }
    if (giveRole) {
      try { await target.roles.add(giveRole, `Infraction (${meta.label}) by ${interaction.user.tag}`); }
      catch { errors.push(`Could not assign ${giveRole.name} — check role hierarchy.`); }
    }

    // ── DM user ───────────────────────────────────────────────────────────────
    if (shouldDm) {
      try {
        const dmLines = [
          `You have received a **${meta.label}** in **${interaction.guild.name}**.`, '',
          `**Reason:** ${reason}`,
          details    ? `**Details:** ${details}`   : null,
          duration   ? `**Duration:** ${duration}` : null,
          caseNumber ? `**Case:** ${caseNumber}`   : null,
        ].filter(l => l !== null).join('\n');

        const dmEmbed = new EmbedBuilder()
          .setColor(accent)
          .setTitle(`${meta.icon}  ${meta.dm_title}`)
          .setDescription(dmLines)
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `${interaction.guild.name} Staff Team` });

        await target.user.send({ embeds: [dmEmbed] });
      } catch {
        errors.push('Could not DM the user (their DMs may be closed).');
      }
    }

    // ── Log to channel ────────────────────────────────────────────────────────
    if (logChan?.isTextBased()) {
      try {
        const logEmbed = new EmbedBuilder()
          .setColor(accent)
          .setTitle(`${meta.icon}  Staff Infraction — ${meta.label}`)
          .addFields(
            { name: 'Staff Member', value: `${target.toString()} (\`${target.user.tag}\`)`, inline: true },
            { name: 'Issued By',    value: interaction.user.toString(), inline: true },
            { name: 'Case',         value: caseNumber, inline: true },
            { name: 'Reason',       value: reason },
            ...(details    ? [{ name: 'Details',      value: details,         inline: false }] : []),
            ...(duration   ? [{ name: 'Duration',     value: duration,        inline: true  }] : []),
            ...(removeRole ? [{ name: 'Role Removed', value: removeRole.name, inline: true  }] : []),
            ...(giveRole   ? [{ name: 'Role Assigned',value: giveRole.name,   inline: true  }] : []),
          )
          .setThumbnail(target.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `Issued by ${interaction.user.tag}` });

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
      action:      typeVal,
      reason,
      details,
      duration,
      caseNumber,
      roleAdded:   giveRole?.id   ?? null,
      roleRemoved: removeRole?.id ?? null,
    }).catch(() => {}); // non-fatal

    const extra = [
      `**Type** — ${meta.icon}  ${meta.label}`,
      duration   ? `**Duration** — ${duration}`           : null,
      caseNumber ? `**Case** — ${caseNumber}`              : null,
      details    ? `**Details** — ${details}`              : null,
      removeRole ? `**Role Removed** — ${removeRole.name}` : null,
      giveRole   ? `**Role Assigned** — ${giveRole.name}`  : null,
      logChan    ? `**Logged in** — <#${logChan.id}>`      : null,
      errors.length
        ? `\n<:error:1555544434601369620> ${errors.join('\n<:error:1555544434601369620> ')}`
        : null,
    ].filter(Boolean).join('\n');

    return interaction.editReply({
      components: [modActionContainer(
        meta.icon, `Staff Infraction — ${meta.label}`,
        `${target.toString()} (${target.user.tag})`,
        reason,
        { accent, extra, clientId: client.user.id },
      )],
      flags: (silent ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
    });
  },
};
