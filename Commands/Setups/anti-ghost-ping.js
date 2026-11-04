"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Anti Ghost Ping.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("anti-ghost-ping").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDescription("Configure the anti ghost-ping system."),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Anti Ghost Ping", "ghostping");
  },
};
