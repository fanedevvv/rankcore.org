"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the RankCore Dashboard.
// This command now redirects users to the dashboard to configure Logging.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("logs").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDescription("Configure the server logging system."),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Logging", "logs");
  },
};
