"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the RankCore Dashboard.
// This command now redirects users to the dashboard to configure Welcome & Goodbye.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("welcome-message").setDMPermission(false)
    .setDescription("Configure the welcome and goodbye message system.")
    .addSubcommand(s => s.setName("welcome").setDescription("Configure the welcome message."))
    .addSubcommand(s => s.setName("goodbye").setDescription("Configure the goodbye message.")),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Welcome & Goodbye", "welcome");
  },
};
