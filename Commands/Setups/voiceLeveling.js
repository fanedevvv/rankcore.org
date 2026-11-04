"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Voice Leveling.

module.exports = {
  data: new SlashCommandBuilder()
        .setName("voiceleveling")
        .setDMPermission(false)
        .setDescription("Configure the voice leveling system.")
        .addSubcommand((command) =>
            command
                .setName("enable")
                .setDescription("Enables the voice leveling system.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The channel to send level-up messages.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("disable")
                .setDescription("Disables the voice leveling system.")
        )
        .addSubcommand((command) =>
            command
                .setName("add-blacklist")
                .setDescription("Add a voice channel to the blacklist.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The voice channel to blacklist.")
                        .setRequired(true)
                )
        )
        .addSubcommand((command) =>
            command
                .setName("remove-blacklist")
                .setDescription("Remove a voice channel from the blacklist.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("The voice channel to remove from blacklist.")
                        .setRequired(true)
                )
        ),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Voice Leveling", "leveling");
  },
};
