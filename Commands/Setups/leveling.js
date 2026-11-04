"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Leveling.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leveling").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDescription("Configure the leveling system."),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Leveling", "leveling");
  },
};
