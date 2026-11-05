'use strict';
/**
 * /cmd  — Simplified custom command management (SCNX-style)
 * ─────────────────────────────────────────────────────────────────────────────
 * A stripped-back alternative to /custom that lets staff create, edit,
 * enable/disable, and delete custom commands without touching the dashboard.
 *
 * The design is intentionally minimal — one command, no nested option hell.
 * Modals handle multi-field input so the Discord UI stays clean.
 */

const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType,
  REST, Routes,
} = require('discord.js');
const CustomCommand = require('../../Schemas/customCommandSchema');
const { getGuildTier, getLimit } = require('../../Utils/premiumTiers');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Validate a command name (Discord slash command rules) */
function validName(n) {
  return /^[a-z0-9_-]{1,32}$/.test(n);
}

/** Register or delete the slash command in the guild via REST */
async function syncCommand(guildId, cmd, client, remove = false) {
  const rest = new REST({ version: '10' }).setToken(process.env.token ?? process.env.BOT_TOKEN);
  if (remove) {
    // Find and delete the guild application command by name
    const cmds = await rest.get(Routes.applicationGuildCommands(client.user.id, guildId));
    const found = cmds.find(c => c.name === cmd.Name);
    if (found) await rest.delete(Routes.applicationGuildCommand(client.user.id, guildId, found.id));
    return;
  }
  await rest.post(Routes.applicationGuildCommands(client.user.id, guildId), {
    body: {
      name:        cmd.Name,
      description: cmd.Description || 'Custom command',
      type: 1,
    },
  });
}

// ── Confirm button helper ─────────────────────────────────────────────────────
function confirmRow(yesId, noId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(yesId).setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(noId).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('Manage custom commands simply.')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)

    // create — opens a modal for all fields
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Create a new custom command.')
    )

    // edit — pick command then modal
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit an existing custom command.')
      .addStringOption(o => o
        .setName('name')
        .setDescription('Command name to edit.')
        .setRequired(true)
      )
    )

    // delete
    .addSubcommand(sub => sub
      .setName('delete')
      .setDescription('Delete a custom command.')
      .addStringOption(o => o
        .setName('name')
        .setDescription('Command name to delete.')
        .setRequired(true)
      )
    )

    // toggle enable/disable
    .addSubcommand(sub => sub
      .setName('toggle')
      .setDescription('Enable or disable a custom command.')
      .addStringOption(o => o
        .setName('name')
        .setDescription('Command name.')
        .setRequired(true)
      )
    )

    // list
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all custom commands in this server.')
    )

    // info — show full details of one command
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Show details of a specific custom command.')
      .addStringOption(o => o
        .setName('name')
        .setDescription('Command name.')
        .setRequired(true)
      )
    ),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (sub === 'create') {
      // Tier limit check
      const tier  = await getGuildTier(guildId);
      const limit = getLimit(tier, 'customCommands');
      const count = await CustomCommand.countDocuments({ Guild: guildId });
      if (count >= limit) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle('Limit Reached')
            .setDescription(`You've used **${count}/${limit}** custom commands on your **${tier}** plan.\nUpgrade with \`/premium plans\` to unlock more.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('cmd_create_modal')
        .setTitle('Create Custom Command')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_name')
              .setLabel('Command Name (lowercase, no spaces)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g. rules, info, apply')
              .setRequired(true)
              .setMaxLength(32)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_desc')
              .setLabel('Description (shown in /help)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('A short description of what this command does.')
              .setRequired(true)
              .setMaxLength(100)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_response')
              .setLabel('Response Text (supports {user}, {server})')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('The message RankCore will send when this command is used.')
              .setRequired(true)
              .setMaxLength(2000)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_embed')
              .setLabel('Send as embed? (yes / no)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('yes')
              .setRequired(false)
              .setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_plain')
              .setLabel('Plain text above embed (optional)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('e.g. Hey {user}! Here are the server rules:')
              .setRequired(false)
              .setMaxLength(500)
          ),
        );

      return interaction.showModal(modal);
    }

    // ── EDIT ──────────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const name = interaction.options.getString('name').toLowerCase();
      const cmd  = await CustomCommand.findOne({ Guild: guildId, Name: name });
      if (!cmd) {
        return interaction.reply({
          content: `<:crossy:1555544390221562048> No custom command named \`${name}\` found.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`cmd_edit_modal:${name}`)
        .setTitle(`Edit /${name}`)
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_desc')
              .setLabel('Description')
              .setStyle(TextInputStyle.Short)
              .setValue(cmd.Description || '')
              .setRequired(true)
              .setMaxLength(100)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_response')
              .setLabel('Response Text')
              .setStyle(TextInputStyle.Paragraph)
              .setValue(cmd.Response || '')
              .setRequired(true)
              .setMaxLength(2000)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_embed')
              .setLabel('Send as embed? (yes / no)')
              .setStyle(TextInputStyle.Short)
              .setValue(cmd.IsEmbed ? 'yes' : 'no')
              .setRequired(false)
              .setMaxLength(3)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_plain')
              .setLabel('Plain text above embed (optional)')
              .setStyle(TextInputStyle.Short)
              .setValue(cmd.PlainTextContent || '')
              .setRequired(false)
              .setMaxLength(500)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('cmd_output_channel')
              .setLabel('Output Channel ID (optional — routes response)')
              .setStyle(TextInputStyle.Short)
              .setValue(cmd.OutputChannelId || '')
              .setRequired(false)
              .setMaxLength(20)
          ),
        );

      return interaction.showModal(modal);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const name = interaction.options.getString('name').toLowerCase();
      const cmd  = await CustomCommand.findOne({ Guild: guildId, Name: name });
      if (!cmd) {
        return interaction.reply({ content: `<:crossy:1555544390221562048> No custom command named \`${name}\` found.`, flags: MessageFlags.Ephemeral });
      }

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xef4444)
          .setDescription(`Are you sure you want to delete \`/${name}\`? This cannot be undone.`)],
        components: [confirmRow(`cmd_del_yes:${name}`, `cmd_del_no:${name}`)],
        flags: MessageFlags.Ephemeral,
      });

      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id && (i.customId === `cmd_del_yes:${name}` || i.customId === `cmd_del_no:${name}`),
        time: 30_000,
        max: 1,
      });

      collector.on('collect', async btn => {
        if (btn.customId === `cmd_del_yes:${name}`) {
          await CustomCommand.deleteOne({ Guild: guildId, Name: name });
          try { await syncCommand(guildId, cmd, client, true); } catch { /* REST fail — swallow */ }
          await btn.update({
            embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`<a:tickyy:1555544712687915008> \`/${name}\` has been deleted.`)],
            components: [],
          });
        } else {
          await btn.update({ embeds: [new EmbedBuilder().setColor(0x6b7280).setDescription('Cancelled.')], components: [] });
        }
      });

      collector.on('end', (_, reason) => {
        if (reason === 'time') interaction.editReply({ components: [] }).catch(() => {});
      });
      return;
    }

    // ── TOGGLE ────────────────────────────────────────────────────────────────
    if (sub === 'toggle') {
      const name = interaction.options.getString('name').toLowerCase();
      const cmd  = await CustomCommand.findOne({ Guild: guildId, Name: name });
      if (!cmd) {
        return interaction.reply({ content: `<:crossy:1555544390221562048> No custom command named \`${name}\` found.`, flags: MessageFlags.Ephemeral });
      }

      cmd.Enabled = !cmd.Enabled;
      await cmd.save();

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(cmd.Enabled ? 0x22c55e : 0xf59e0b)
          .setDescription(`${cmd.Enabled ? '<a:tickyy:1555544712687915008> Enabled' : '<:n_music:1555544516746940416> Disabled'} \`/${name}\`.`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const cmds = await CustomCommand.find({ Guild: guildId }).lean();
      if (!cmds.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x6b7280).setDescription('No custom commands yet. Create one with `/cmd create`.')],
          flags: MessageFlags.Ephemeral,
        });
      }

      const tier  = await getGuildTier(guildId);
      const limit = getLimit(tier, 'customCommands');

      const lines = cmds.map(c =>
        `${c.Enabled !== false ? '<:LEgreen:1555544256356159600>' : '<:LEred:1555544262123323422>'} \`/${c.Name}\` — ${c.Description || '*no description*'}`
      );

      // Chunk if over 4096
      const pages = [];
      let page = '';
      for (const line of lines) {
        if ((page + '\n' + line).length > 3800) { pages.push(page); page = line; }
        else page = page ? page + '\n' + line : line;
      }
      if (page) pages.push(page);

      const embeds = pages.map((p, i) => new EmbedBuilder()
        .setColor(client.config?.embedColor ?? 0x6C53FF)
        .setTitle(i === 0 ? `<:files:1555544445565407352> Custom Commands (${cmds.length}/${limit})` : `<:files:1555544445565407352> Custom Commands (cont.)`)
        .setDescription(p)
        .setFooter(i === 0 ? { text: `<:LEgreen:1555544256356159600> = enabled  <:LEred:1555544262123323422> = disabled  •  Tier: ${tier}` } : null)
      );

      return interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
    }

    // ── INFO ──────────────────────────────────────────────────────────────────
    if (sub === 'info') {
      const name = interaction.options.getString('name').toLowerCase();
      const cmd  = await CustomCommand.findOne({ Guild: guildId, Name: name }).lean();
      if (!cmd) {
        return interaction.reply({ content: `<:crossy:1555544390221562048> No custom command named \`${name}\` found.`, flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(client.config?.embedColor ?? 0x6C53FF)
        .setTitle(`/${cmd.Name}`)
        .addFields(
          { name: 'Description',  value: cmd.Description || '*none*',             inline: true  },
          { name: 'Status',       value: cmd.Enabled !== false ? '<:LEgreen:1555544256356159600> Enabled' : '<:LEred:1555544262123323422> Disabled', inline: true },
          { name: 'Embed',        value: cmd.IsEmbed ? 'Yes' : 'No',              inline: true  },
          { name: 'Response',     value: (cmd.Response || '*empty*').slice(0, 512) },
          ...(cmd.PlainTextContent ? [{ name: 'Plain Text Prefix', value: cmd.PlainTextContent.slice(0, 200) }] : []),
          ...(cmd.OutputChannelId  ? [{ name: 'Output Channel', value: `<#${cmd.OutputChannelId}>`, inline: true }] : []),
          { name: 'Uses',         value: String(cmd.UsageCount ?? 0),             inline: true  },
        )
        .setFooter({ text: `Created ${cmd.createdAt ? new Date(cmd.createdAt).toDateString() : 'unknown'}` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
