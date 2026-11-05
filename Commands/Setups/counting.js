"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the RankCore Dashboard.
// This command now redirects users to the dashboard to configure Counting.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDescription("Configure the counting game system."),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Counting", "counting");
  },
};
