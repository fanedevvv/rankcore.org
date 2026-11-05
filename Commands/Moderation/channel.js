const { parseEmoji } = require('discord.js');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  MessageFlags, PermissionFlagsBits, SlashCommandBuilder,
  PermissionsBitField, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SeparatorSpacingSize, ComponentType,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel")
    .setDescription("Manage channels in the server.")
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(cmd => cmd
      .setName("nuke")
      .setDescription("Delete and re-create a channel, wiping all messages.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to nuke.").setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice))
      .addStringOption(o => o.setName("reason").setDescription("Reason for nuking the channel.").setRequired(true).setMaxLength(512))
      .addBooleanOption(o => o.setName("send_message").setDescription("Post an announcement in the new channel after nuking (default: true).").setRequired(false)))
    .addSubcommand(cmd => cmd
      .setName("lock")
      .setDescription("Prevent @everyone from sending messages in a channel.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to lock.").setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice))
      .addStringOption(o => o.setName("reason").setDescription("Reason for locking the channel.").setRequired(false).setMaxLength(512)))
    .addSubcommand(cmd => cmd
      .setName("unlock")
      .setDescription("Restore @everyone's ability to send messages in a channel.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to unlock.").setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice))
      .addStringOption(o => o.setName("reason").setDescription("Reason for unlocking the channel.").setRequired(false).setMaxLength(512)))
    .addSubcommand(cmd => cmd
      .setName("hide")
      .setDescription("Hide a channel from @everyone.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to hide.").setRequired(true)))
    .addSubcommand(cmd => cmd
      .setName("show")
      .setDescription("Reveal a previously hidden channel to @everyone.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to show.").setRequired(true))),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    // ── NUKE ──────────────────────────────────────────────────────────────────
    if (sub === "nuke") {
      const channel    = interaction.options.getChannel("channel");
      const reason     = interaction.options.getString("reason");
      const sendMsg    = interaction.options.getBoolean("send_message") ?? true;

      if (!channel) return ephErr("Not Found", "That channel does not exist.");

      // Confirmation prompt
      const confirmContainer = new ContainerBuilder().setAccentColor(ACCENT.error)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:fire:1567796972125945888>  Confirm Channel Nuke"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `You are about to **nuke** <#${channel.id}>. This will delete the channel and re-create it, wiping **all messages**.\n\n**Reason** — ${reason}\n**Post Notification** — ${sendMsg ? "Yes" : "No"}`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("nuke_confirm").setLabel("Confirm Nuke").setEmoji(parseEmoji('<a:tickyy:1567797045253644368>')).setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("nuke_cancel").setLabel("Cancel").setEmoji(parseEmoji('<:crossy:1567796959648030831>')).setStyle(ButtonStyle.Secondary),
          )
        );

      const msg = await interaction.reply({
        components: [confirmContainer],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      const col = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: b => b.user.id === interaction.user.id && ["nuke_confirm", "nuke_cancel"].includes(b.customId),
        max: 1, time: 30_000,
      });

      col.on("collect", async b => {
        if (b.customId === "nuke_cancel") {
          return b.update({
            components: [successContainer("<:fire:1567796972125945888> Nuke Cancelled", "The nuke request was cancelled. No changes made.", { accent, clientId: client.user.id })],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        if (b.customId === "nuke_confirm") {
          try {
            const parent   = channel.parentId;
            const position = channel.position;
            const name     = channel.name;
            const topic    = channel.topic;
            const nsfw     = channel.nsfw;
            const type     = channel.type;
            const perms    = channel.permissionOverwrites.cache.map(o => ({
              id: o.id, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString(), type: o.type,
            }));

            await channel.delete(`Nuke by ${interaction.user.tag} | ${reason}`);

            const newChannel = await interaction.guild.channels.create({
              name, type, topic: topic || undefined, nsfw,
              parent: parent || undefined,
              position,
              permissionOverwrites: perms.map(p => ({
                id: p.id, allow: BigInt(p.allow), deny: BigInt(p.deny), type: p.type,
              })),
              reason: `Nuked and re-created by ${interaction.user.tag}`,
            });

            if (sendMsg) {
              await newChannel.send({
                components: [new ContainerBuilder().setAccentColor(ACCENT.error)
                  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:fire:1567796972125945888>  Channel Nuked\nThis channel was nuked by ${interaction.user} with reason: **${reason}**`))],
                flags: MessageFlags.IsComponentsV2,
              }).catch(() => {});
            }

            await b.update({
              components: [successContainer("<:fire:1567796972125945888> Nuke Complete", `**#${name}** has been nuked. New channel: <#${newChannel.id}>`, {
                accent, clientId: client.user.id,
                extra: `**Reason** — ${reason}\n**By** — ${interaction.user.tag}`,
              })],
              flags: MessageFlags.IsComponentsV2,
            });
          } catch (err) {
            await b.update({
              components: [errorContainer("Nuke Failed", `Failed to nuke the channel: \`${err.message}\``, { clientId: client.user.id })],
              flags: MessageFlags.IsComponentsV2,
            });
          }
        }
      });

      col.on("end", collected => {
        if (!collected.size) {
          interaction.editReply({
            components: [errorContainer("Timed Out", "Nuke confirmation timed out.", { clientId: client.user.id })],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => {});
        }
      });
    }

    // ── LOCK ──────────────────────────────────────────────────────────────────
    if (sub === "lock") {
      const channel = interaction.options.getChannel("channel");
      const reason  = interaction.options.getString("reason") || "No reason provided";
      if (!channel) return ephErr("Not Found", "That channel does not exist.");

      try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: false, SendMessagesInThreads: false, AddReactions: false,
        });
        return interaction.reply({
          components: [successContainer("<:lockk:1567796977809367122>  Channel Locked", `<#${channel.id}> has been locked.`, {
            accent, clientId: client.user.id,
            extra: `**Reason** — ${reason}\n**Locked by** — ${interaction.user.tag}`,
          })],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        return ephErr("Lock Failed", `Failed to lock the channel: \`${err.message}\``);
      }
    }

    // ── UNLOCK ────────────────────────────────────────────────────────────────
    if (sub === "unlock") {
      const channel = interaction.options.getChannel("channel");
      const reason  = interaction.options.getString("reason") || "No reason provided";
      if (!channel) return ephErr("Not Found", "That channel does not exist.");

      try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          SendMessages: null, SendMessagesInThreads: null, AddReactions: null,
        });
        return interaction.reply({
          components: [successContainer("<:lockk:1567796977809367122>  Channel Unlocked", `<#${channel.id}> has been unlocked.`, {
            accent, clientId: client.user.id,
            extra: `**Reason** — ${reason}\n**Unlocked by** — ${interaction.user.tag}`,
          })],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        return ephErr("Unlock Failed", `Failed to unlock the channel: \`${err.message}\``);
      }
    }

    // ── HIDE ─────────────────────────────────────────────────────────────────
    if (sub === "hide") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) return ephErr("Not Found", "That channel does not exist.");
      try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
        return interaction.reply({
          components: [successContainer("<:n_search:1567796994792230953>️  Channel Hidden", `<#${channel.id}> is now hidden from @everyone.`, {
            accent, clientId: client.user.id,
            extra: `**Hidden by** — ${interaction.user.tag}`,
          })],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        return ephErr("Hide Failed", `Could not hide the channel: \`${err.message}\``);
      }
    }

    // ── SHOW ─────────────────────────────────────────────────────────────────
    if (sub === "show") {
      const channel = interaction.options.getChannel("channel");
      if (!channel) return ephErr("Not Found", "That channel does not exist.");
      try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: null });
        return interaction.reply({
          components: [successContainer("<:n_search:1567796994792230953>️  Channel Visible", `<#${channel.id}> is now visible to @everyone.`, {
            accent, clientId: client.user.id,
            extra: `**Shown by** — ${interaction.user.tag}`,
          })],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        return ephErr("Show Failed", `Could not show the channel: \`${err.message}\``);
      }
    }
  },
};
