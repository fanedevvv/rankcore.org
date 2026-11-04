"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Join To Create.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join-to-create")
    .setDescription("Configure your join to create voice channel system.")
    .setDMPermission(false)
    // --- SETUP SUBCOMMAND ---
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("Sets up your join to create voice channel.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Specified channel will be your join to create voice channel.")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("All new channels will be created in specified category.")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addIntegerOption((option) =>
          option
            .setName("voice-limit")
            .setDescription("Set the default limit for the new voice channels (2-10).")
            .setMinValue(2)
            .setMaxValue(10)
        )
        .addBooleanOption((option) =>
          option
            .setName("inherit-permissions")
            .setDescription("Whether the temp channels inherit the category permissions (default: true).")
            .setRequired(false)
        )
    )
    // --- DISABLE SUBCOMMAND ---
    .addSubcommand((command) =>
      command
        .setName("disable")
        .setDescription("Disables your join to create voice channel system.")
    )
    // --- VIEW SUBCOMMAND ---
    .addSubcommand((command) =>
      command
        .setName("view")
        .setDescription("Displays the current join to create configuration for this guild.")
    ),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Join To Create", "jtc");
  },
};
