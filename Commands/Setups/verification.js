"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Verification.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verification").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDescription("Configure the server verification system."),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Verification", "verify");
  },
};
