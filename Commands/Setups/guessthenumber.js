"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the RankCore Dashboard.
// This command now redirects users to the dashboard to configure Guess The Number.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("guess")
    .setDescription("Configure the guess the number settings")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

    .addSubcommand((subCommand) =>
      subCommand
        .setName("enable")
        .setDescription("Enable guess the number")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel you want as guess the number channel")
            .setRequired(true)
        )
    )

    .addSubcommand((subCommand) =>
      subCommand.setName("disable").setDescription("Disable guess the number")
    ),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Guess The Number", "guessthenumber");
  },
};
