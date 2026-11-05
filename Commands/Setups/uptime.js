"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the RankCore Dashboard.
// This command now redirects users to the dashboard to configure Uptime Monitor.

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Advanced uptime monitor')
    .addSubcommand(s => s.setName('add').setDescription('Add a URL to monitor')
      .addStringOption(o => o.setName('url').setDescription('URL to monitor').setRequired(true))
      .addIntegerOption(o => o.setName('interval').setDescription('Interval in minutes (1-60)'))
      .addStringOption(o => o.setName('name').setDescription('Friendly name')))
    .addSubcommand(s => s.setName('delete').setDescription('Remove a monitored URL')
      .addStringOption(o => o.setName('url').setDescription('URL to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List monitored URLs'))
    .addSubcommand(s => s.setName('info').setDescription('Get detailed info for a URL')
      .addStringOption(o => o.setName('url').setDescription('URL to inspect').setRequired(true)))
    .addSubcommand(s => s.setName('resetstats').setDescription('Reset stats for a URL')
      .addStringOption(o => o.setName('url').setDescription('URL to reset').setRequired(true)))
      .addSubcommand(s =>
  s.setName('setchannel')
   .setDescription('Set or clear alert channel (admin only)')
   .addStringOption(o =>
     o.setName('url').setDescription('URL').setRequired(true)
   )
   .addChannelOption(o =>
     o.setName('channel').setDescription('Channel for alerts (omit to disable)')
   )
)
    .addSubcommand(s => s.setName('setalert').setDescription('Toggle DM alerts for a URL')
      .addStringOption(o => o.setName('url').setDescription('URL to toggle alerts').setRequired(true))),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Uptime Monitor", "uptime");
  },
};
