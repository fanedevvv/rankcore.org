const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT, divider, helpRow } = require("../../Utils/v2helpers");
const lockdownschema = require("../../Schemas/lockdownblacklist");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lockdown").setDMPermission(false)
    .setDescription("Server lockdown management.")
    .addSubcommand(s => s.setName("commit").setDescription("<:lockk:1555544494441635860> Lock all channels in the server. Use with caution!"))
    .addSubcommand(s => s.setName("unlock").setDescription("<:lockk:1555544494441635860> Unlock all channels in the server."))
    .addSubcommand(s => s.setName("blacklist-add").setDescription("Add a channel to the lockdown blacklist.")
      .addChannelOption(o => o.setName("channel").setDescription("Channel to protect from lockdowns.").setRequired(true)))
    .addSubcommand(s => s.setName("blacklist-remove").setDescription("Remove a channel from the lockdown blacklist.")
      .addChannelOption(o => o.setName("channel").setDescription("Channel to remove from the blacklist.").setRequired(true)))
    .addSubcommand(s => s.setName("blacklist-view").setDescription("View all channels in the lockdown blacklist.")),

  ServerOnly: true,

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    const ephErr = (t, b) => interaction.reply({
      components: [errorContainer(t, b, { clientId: client.user.id })], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && interaction.user.id !== client.config?.developerid)
      return ephErr("Permission Denied", "You need **Manage Channels** permission to use lockdown commands.");

    // ── BLACKLIST ADD ──────────────────────────────────────────────────────────
    if (sub === "blacklist-add") {
      const ch = interaction.options.getChannel("channel");
      let data = await lockdownschema.findOne({ Guild: interaction.guild.id });
      if (!data) {
        await lockdownschema.create({ Guild: interaction.guild.id, Channel: [ch.id] });
      } else {
        if (data.Channel.includes(ch.id))
          return ephErr("Already Blacklisted", `${ch} is already in the lockdown blacklist.`);
        data.Channel.push(ch.id);
        await data.save();
      }
      return interaction.reply({
        components: [successContainer("<:restrict:1555544549105999962>  Channel Blacklisted",
          `${ch} will no longer be affected by server lockdowns.`, { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── BLACKLIST REMOVE ───────────────────────────────────────────────────────
    if (sub === "blacklist-remove") {
      const ch = interaction.options.getChannel("channel");
      const data = await lockdownschema.findOne({ Guild: interaction.guild.id });
      if (!data || !data.Channel.includes(ch.id))
        return ephErr("Not Blacklisted", `${ch} is not in the lockdown blacklist.`);
      data.Channel = data.Channel.filter(id => id !== ch.id);
      await data.save();
      return interaction.reply({
        components: [successContainer("<:restrict:1555544549105999962>  Channel Removed",
          `${ch} has been removed from the lockdown blacklist.`, { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── BLACKLIST VIEW ─────────────────────────────────────────────────────────
    if (sub === "blacklist-view") {
      const data = await lockdownschema.findOne({ Guild: interaction.guild.id });
      const channels = data?.Channel?.map(id => `<#${id}>`).join(", ") || "None";
      return interaction.reply({
        components: [successContainer("<:restrict:1555544549105999962>  Lockdown Blacklist",
          `The following channels are protected from lockdowns:\n${channels}`, { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ── COMMIT LOCKDOWN ────────────────────────────────────────────────────────
    if (sub === "commit") {
      await interaction.deferReply();
      const data = await lockdownschema.findOne({ Guild: interaction.guild.id });
      const blacklisted = data?.Channel || [];
      const textChannels = interaction.guild.channels.cache.filter(
        c => c.type === ChannelType.GuildText && !blacklisted.includes(c.id)
      );

      let locked = 0;
      for (const [, channel] of textChannels) {
        try {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
          locked++;
        } catch {}
      }

      const container = new ContainerBuilder().setAccentColor(ACCENT.error)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:lockk:1555544494441635860>  Server Locked Down"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**${locked}** channel(s) have been locked.\n**Blacklisted** — ${blacklisted.length} channel(s) protected.\n**Initiated by** — ${interaction.user.tag}`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Use `/lockdown unlock` to restore access."))
        .addActionRowComponents(helpRow(client.user.id, { invite: false }));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    // ── UNLOCK ─────────────────────────────────────────────────────────────────
    if (sub === "unlock") {
      await interaction.deferReply();
      const data = await lockdownschema.findOne({ Guild: interaction.guild.id });
      const blacklisted = data?.Channel || [];
      const textChannels = interaction.guild.channels.cache.filter(
        c => c.type === ChannelType.GuildText && !blacklisted.includes(c.id)
      );

      let unlocked = 0;
      for (const [, channel] of textChannels) {
        try {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
          unlocked++;
        } catch {}
      }

      const container = new ContainerBuilder().setAccentColor(ACCENT.success)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:lockk:1555544494441635860>  Server Unlocked"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**${unlocked}** channel(s) have been unlocked.\n**Restored by** — ${interaction.user.tag}`
        ))
        .addActionRowComponents(helpRow(client.user.id, { invite: false }));

      return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
  },
};
