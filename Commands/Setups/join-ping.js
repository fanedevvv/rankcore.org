"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the RankCore Dashboard.
// This command now redirects users to the dashboard to configure Join Ping.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join-ping").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDescription("Configure join-ping — ping a user when someone joins."),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Join Ping", "joinping");
  },
};
