"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Christmas Config.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("christmas-config")
    .setDescription("Configure the automatic Christmas countdown system.")
    .setDMPermission(false),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Christmas Config", "christmas");
  },
};
