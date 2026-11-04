"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Sticky Messages.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sticky-message").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
    .setDescription("Manage sticky messages in channels.")
    .addSubcommand(s => s.setName("set").setDescription("Set a sticky message in a channel.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel.").setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName("message").setDescription("The sticky message content.").setRequired(true).setMaxLength(2000)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove the sticky message from a channel.")
      .addChannelOption(o => o.setName("channel").setDescription("The channel.").setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName("list").setDescription("List all sticky messages in this server.")),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Sticky Messages", "sticky");
  },
};
