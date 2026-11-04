'use strict';

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const RecoveryKey = require('../../Schemas/staffRecoveryKey');
const { successContainer, errorContainer, ACCENT } = require('../../Utils/v2helpers');

const KEY_EXPIRY_DAYS = 90;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recovery-key')
    .setDescription('Manage your server\'s staff recovery key.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(sub => sub
      .setName('generate')
      .setDescription('Generate (or rotate) the server recovery key. The key is DM\'d to you and shown ONCE only.')
      .addIntegerOption(o => o
        .setName('expiry_days')
        .setDescription(`Days until the key expires (default: ${KEY_EXPIRY_DAYS}, 0 = no expiry).`)
        .setMinValue(0).setMaxValue(365).setRequired(false)
      )
    )
    .addSubcommand(sub => sub
      .setName('use')
      .setDescription('Use the recovery key to verify your identity for emergency access.')
      .addStringOption(o => o
        .setName('key')
        .setDescription('The recovery key (format: ROCO-XXXX-XXXX-XXXX).')
        .setRequired(true).setMaxLength(20)
      )
    )
    .addSubcommand(sub => sub
      .setName('revoke')
      .setDescription('Revoke the current recovery key without generating a new one.')
    )
    .addSubcommand(sub => sub
      .setName('status')
      .setDescription('Check whether a recovery key exists and its expiry status.')
    ),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── GENERATE ──────────────────────────────────────────────────────────────
    if (sub === 'generate') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Load dashboard settings to get configured defaultExpiry
      const doc          = await RecoveryKey.findOne({ guildId }).lean().catch(() => null);
      const dashSettings = doc?.settings ?? {};

      // Priority: command arg → dashboard defaultExpiry → hardcoded fallback
      const expiryDaysArg = interaction.options.getInteger('expiry_days');
      const expiryDays    = expiryDaysArg !== null
        ? expiryDaysArg
        : (dashSettings.defaultExpiry != null
            ? Math.round(dashSettings.defaultExpiry / 24)   // stored in hours, convert to days
            : KEY_EXPIRY_DAYS);

      const plain     = RecoveryKey.generatePlainKey();
      const keyHash   = RecoveryKey.hashKey(plain);
      const expiresAt = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 86_400_000)
        : null;

      const existing = await RecoveryKey.findOne({ guildId });
      const action   = existing ? 'rotated' : 'generated';

      await RecoveryKey.findOneAndUpdate(
        { guildId },
        {
          keyHash,
          generatedBy: interaction.user.id,
          generatedAt: new Date(),
          expiresAt,
          used:   false,
          usedBy: null,
          usedAt: null,
          $push: {
            auditLog: {
              action,
              userId:    interaction.user.id,
              timestamp: new Date(),
              note:      existing ? 'Key rotated — previous key invalidated.' : 'Initial key generation.',
            },
          },
        },
        { upsert: true, new: true }
      );

      // DM the plain key (respects dmKey dashboard setting when there's an assignedUser)
      const dmEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('<:restrict:1555544549105999962> Server Recovery Key')
        .setDescription(
          `Your recovery key for **${interaction.guild.name}** has been ${action}.\n\n` +
          `\`\`\`\n${plain}\n\`\`\`\n` +
          `**<:error:1555544434601369620> Store this somewhere safe — it will NOT be shown again.**\n\n` +
          (expiresAt
            ? `This key expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.`
            : 'This key has **no expiry**.')
        )
        .setFooter({ text: `Guild: ${interaction.guild.name} • Use /recovery-key use <key> if locked out` })
        .setTimestamp();

      let dmSent = false;
      try {
        await interaction.user.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // DMs closed — fall through to show inline
      }

      const lines = [
        `**Action:** Key ${action}`,
        `**Expiry:** ${expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Never'}`,
        dmSent
          ? `**Key:** Sent to your DMs <a:tickyy:1555544712687915008>`
          : `**Key:** \`${plain}\`\n> <:error:1555544434601369620> Your DMs are closed — copy this now, it won't be shown again!`,
      ];

      return interaction.editReply({
        components: [successContainer(
          `<:restrict:1555544549105999962> Recovery Key ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          lines.join('\n'),
          { clientId: client.user.id },
        )],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    // ── USE ───────────────────────────────────────────────────────────────────
    if (sub === 'use') {
      const plain = interaction.options.getString('key').trim().toUpperCase();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const record = await RecoveryKey.findOne({ guildId });

      const fail = (reason) => interaction.editReply({
        components: [errorContainer('Recovery Key Failed', reason, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });

      if (!record || !record.keyHash)    return fail('No recovery key has been generated for this server.');
      if (record.used)                   return fail('This recovery key has already been used. Generate a new one with `/recovery-key generate`.');
      if (record.expiresAt && record.expiresAt < new Date()) return fail('This recovery key has expired. Generate a new one with `/recovery-key generate`.');
      if (!record.verifyKey(plain))      return fail('Invalid recovery key. Please check the key and try again.');

      const settings = record.settings ?? {};

      // ── Respect revokeOnUse (dashboard setting, default true) ────────────
      const shouldRevoke = settings.revokeOnUse !== false;

      // ── Respect logUsage (dashboard setting, default true) ───────────────
      const shouldLog = settings.logUsage !== false;

      const updatePayload = { usedBy: interaction.user.id, usedAt: new Date() };
      if (shouldRevoke) updatePayload.used = true;

      const auditEntry = {
        action:    'used',
        userId:    interaction.user.id,
        timestamp: new Date(),
        note:      `Key used via /recovery-key use${shouldRevoke ? ' (auto-revoked)' : ' (revoke disabled)'}`,
      };

      await RecoveryKey.findOneAndUpdate(
        { guildId },
        { $set: updatePayload, ...(shouldLog ? { $push: { auditLog: auditEntry } } : {}) },
      );

      // ── Alert channel ping (dashboard setting) ───────────────────────────
      if (settings.alertChannelId) {
        const alertChan = interaction.guild.channels.cache.get(settings.alertChannelId);
        if (alertChan?.isTextBased()) {
          try {
            const alertEmbed = new EmbedBuilder()
              .setColor(0xef4444)
              .setTitle('<:error:1555544434601369620> Recovery Key Used')
              .setDescription(
                `A staff recovery key for **${interaction.guild.name}** was just consumed.\n\n` +
                `**Used by:** ${interaction.user.toString()} (\`${interaction.user.tag}\`)\n` +
                `**At:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                `**Key revoked:** ${shouldRevoke ? 'Yes' : 'No (disabled in settings)'}\n\n` +
                `If this was not authorised, review your server permissions immediately and generate a new key with \`/recovery-key generate\`.`
              )
              .setTimestamp();
            await alertChan.send({ embeds: [alertEmbed] });
          } catch { /* alert channel send failed — non-fatal */ }
        }
      }

      // ── Owner DM ─────────────────────────────────────────────────────────
      try {
        const owner = await interaction.guild.fetchOwner();
        const ownerDm = new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle('<:error:1555544434601369620> Recovery Key Used')
          .setDescription(
            `A recovery key for **${interaction.guild.name}** was just consumed.\n\n` +
            `**Used by:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
            `**At:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `If this was not you, review your server permissions immediately and generate a new key.`
          )
          .setTimestamp();
        await owner.user.send({ embeds: [ownerDm] });
      } catch { /* owner DMs closed */ }

      return interaction.editReply({
        components: [successContainer('<a:tickyy:1555544712687915008> Recovery Key Accepted',
          `Your identity has been verified.\n\n` +
          `**Next steps:**\n` +
          `• The server owner has been notified.\n` +
          `• This key is now **${shouldRevoke ? 'consumed' : 'still active (auto-revoke disabled)'}** — generate a new one after resolving the issue.\n` +
          `• If you need role restoration, ask the server owner to use \`/role add\`.`,
          { clientId: client.user.id },
        )],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    // ── REVOKE ────────────────────────────────────────────────────────────────
    if (sub === 'revoke') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const record = await RecoveryKey.findOne({ guildId });
      if (!record || !record.keyHash) {
        return interaction.editReply({
          components: [errorContainer('No Key', 'There is no active recovery key to revoke.', { clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      await RecoveryKey.findOneAndUpdate(
        { guildId },
        {
          keyHash: null,
          used:    false,
          $push: {
            auditLog: {
              action:    'revoked',
              userId:    interaction.user.id,
              timestamp: new Date(),
              note:      'Key manually revoked.',
            },
          },
        }
      );

      return interaction.editReply({
        components: [successContainer('<:restrict:1555544549105999962> Recovery Key Revoked',
          'The recovery key has been invalidated. Run `/recovery-key generate` to create a new one.',
          { clientId: client.user.id },
        )],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    // ── STATUS ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const record = await RecoveryKey.findOne({ guildId });

      if (!record || !record.keyHash) {
        return interaction.editReply({
          components: [errorContainer('No Recovery Key',
            'No recovery key exists for this server. Use `/recovery-key generate` to create one.',
            { clientId: client.user.id },
          )],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const expired = record.expiresAt && record.expiresAt < new Date();
      const settings = record.settings ?? {};
      const lines = [
        `**Status:** ${record.used ? '<:LEred:1555544262123323422> Used (consumed)' : expired ? '<:error:1555544434601369620> Expired' : '<:LEgreen:1555544256356159600> Active'}`,
        `**Generated by:** <@${record.generatedBy}>`,
        `**Generated:** <t:${Math.floor(record.generatedAt.getTime() / 1000)}:R>`,
        record.expiresAt
          ? `**Expires:** <t:${Math.floor(record.expiresAt.getTime() / 1000)}:R>`
          : `**Expires:** Never`,
        record.used
          ? `**Used by:** <@${record.usedBy}> at <t:${Math.floor(record.usedAt.getTime() / 1000)}:F>`
          : null,
        '',
        `**Settings:** Log usage: ${settings.logUsage !== false ? 'On' : 'Off'} • Auto-revoke: ${settings.revokeOnUse !== false ? 'On' : 'Off'} • Alert channel: ${settings.alertChannelId ? `<#${settings.alertChannelId}>` : 'None'}`,
        '',
        `Use \`/recovery-key generate\` to rotate the key at any time.`,
      ].filter(l => l !== null).join('\n');

      return interaction.editReply({
        components: [successContainer('<:restrict:1555544549105999962> Recovery Key Status', lines, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
  },
};
