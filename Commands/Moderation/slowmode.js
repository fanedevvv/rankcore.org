const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slowmode").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDescription("Set or disable slowmode on a channel.")
    .addSubcommand(sub => sub.setName("set").setDescription("Set the slowmode of a channel.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to set slowmode on.").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addIntegerOption(o => o.setName("time").setDescription("The time value.").setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName("timeformat").setDescription("The time unit.").setRequired(true)
        .addChoices(
          { name: "Seconds", value: "seconds" }, { name: "Minutes", value: "minutes" },
          { name: "Hours", value: "hours" }, { name: "Days", value: "days" },
          { name: "Weeks", value: "weeks" }, { name: "Months", value: "months" },
        )))
    .addSubcommand(sub => sub.setName("disable").setDescription("Disable slowmode on a channel.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel to remove slowmode from.").addChannelTypes(ChannelType.GuildText).setRequired(true))),

  async execute(interaction, client) {
    const sub     = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel("channel");
    const accent  = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.info;

    if (sub === "set") {
      const time = interaction.options.getInteger("time");
      const fmt  = interaction.options.getString("timeformat");
      const multipliers = { seconds: 1, minutes: 60, hours: 3600, days: 86400, weeks: 604800, months: 2592000 };
      const seconds = time * (multipliers[fmt] || 1);

      if (seconds > 21600)
        return interaction.reply({
          components: [errorContainer("Invalid Duration", "Discord's maximum slowmode is **6 hours** (21,600 seconds).")],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });

      await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
      return interaction.reply({
        components: [successContainer("<:1430986244921495654:1567796929587576852>  Slowmode Set",
          `Slowmode on ${channel} set to **${time} ${fmt}**.`, {
            accent, clientId: client.user.id,
            extra: `**Channel** — ${channel}\n**Duration** — ${time} ${fmt} (${seconds}s)\n**Set by** — ${interaction.user.tag}`,
          })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "disable") {
      await channel.setRateLimitPerUser(0, `Disabled by ${interaction.user.tag}`);
      return interaction.reply({
        components: [successContainer("<:1430986244921495654:1567796929587576852>  Slowmode Disabled",
          `Slowmode on ${channel} has been **removed**.`, {
            accent, clientId: client.user.id,
            extra: `**Channel** — ${channel}\n**Disabled by** — ${interaction.user.tag}`,
          })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  },
};
