"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Halloween Config.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("halloween-config")
    .setDescription("Configure the automatic Halloween countdown system.")
    .setDMPermission(false),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Halloween Config", "halloween");
  },
};
