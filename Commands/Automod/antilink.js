const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
} = require("discord.js");
const { successContainer, errorContainer, configContainer, statusLine, configLine, ACCENT } = require("../../Utils/v2helpers");
const Affix  = require("../../Schemas/LinkAffixSchema");
const Config = require("../../Schemas/LinkConfigSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("antilink").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDescription("Manage the anti-link system.")
    .addSubcommand(s => s.setName("toggle").setDescription("Enable or disable the anti-link system."))
    .addSubcommand(s => s.setName("affixadd").setDescription("Add a link affix to block (e.g. .xyz, .tk).")
      .addStringOption(o => o.setName("affix").setDescription("The affix to block.").setRequired(true)))
    .addSubcommand(s => s.setName("affixremove").setDescription("Remove a link affix from the block list.")
      .addStringOption(o => o.setName("affix").setDescription("The affix to remove.").setRequired(true)))
    .addSubcommand(s => s.setName("affixlist").setDescription("View all blocked link affixes.")),

  category: "Automod",
  usage: "/antilink <subcommand>",
  examples: ["/antilink toggle", "/antilink affixadd .xyz", "/antilink affixremove .tk", "/antilink affixlist"],
  permissions: ["Administrator"],

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    const ephErr = (t, b) => interaction.reply({
      components: [errorContainer(t, b, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (sub === "toggle") {
      let config = await Config.findOne({ guildId: interaction.guild.id });
      if (!config) config = new Config({ guildId: interaction.guild.id, guildName: interaction.guild.name, isEnabled: false });
      config.isEnabled = !config.isEnabled;
      await config.save();

      return interaction.reply({
        components: [successContainer(
          `<:1430986227909263442:1555544212756242532>  Anti-Link — ${config.isEnabled ? "Enabled" : "Disabled"}`,
          `${statusLine(config.isEnabled, "Anti-Link System")}\n\nThe anti-link system has been **${config.isEnabled ? "enabled" : "disabled"}** on this server.`,
          { accent: config.isEnabled ? ACCENT.success : ACCENT.error, clientId: client.user.id }
        )],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "affixadd") {
      const affix = interaction.options.getString("affix");
      try {
        await new Affix({ guildId: interaction.guild.id, affix }).save();
        return interaction.reply({
          components: [successContainer("<:1430986227909263442:1555544212756242532>  Affix Added",
            `The affix \`${affix}\` has been added to the block list.\nAll links ending with this affix will now be blocked.`,
            { accent, clientId: client.user.id })],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        if (err.code === 11000) return ephErr("Already Exists", `The affix \`${affix}\` is already on the block list.`);
        return ephErr("Error", "An error occurred while adding the affix.");
      }
    }

    if (sub === "affixremove") {
      const affix = interaction.options.getString("affix");
      const result = await Affix.findOneAndDelete({ guildId: interaction.guild.id, affix });
      if (!result) return ephErr("Not Found", `The affix \`${affix}\` was not found on the block list.`);
      return interaction.reply({
        components: [successContainer("<:1430986227909263442:1555544212756242532>  Affix Removed",
          `The affix \`${affix}\` has been removed from the block list.`,
          { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "affixlist") {
      const affixes = await Affix.find({ guildId: interaction.guild.id });
      const list = affixes.length ? affixes.map(a => `\`${a.affix}\``).join("  •  ") : "*No affixes added yet.*";
      return interaction.reply({
        components: [successContainer("<:1430986227909263442:1555544212756242532>  Blocked Affixes",
          `**${affixes.length}** affix(es) currently blocked:\n\n${list}`,
          { accent, clientId: client.user.id,
            footer: "Use /antilink affixadd or /antilink affixremove to manage this list." })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
