"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Booster.

module.exports = {
  data: new SlashCommandBuilder()
    .setName('booster')
    .setDescription('Manage booster settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the booster notification channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('The channel to send boost notifications')
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Booster", "booster");
  },
};
