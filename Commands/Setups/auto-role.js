"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Auto Role.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("auto-role").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .setDescription("Auto-assign roles when members join.")
    .addSubcommand(s => s.setName("add").setDescription("Add a role to auto-assign on join.")
      .addRoleOption(o => o.setName("role").setDescription("The role to auto-assign.").setRequired(true))
      .addStringOption(o => o.setName("type").setDescription("Apply to humans, bots, or all.").setRequired(false)
        .addChoices({ name: "All", value: "all" }, { name: "Humans only", value: "human" }, { name: "Bots only", value: "bot" })))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a role from auto-assignment.")
      .addRoleOption(o => o.setName("role").setDescription("The role to remove.").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("View all auto-assigned roles.")),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Auto Role", "autorole");
  },
};
