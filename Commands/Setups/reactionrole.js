"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Reaction Roles.

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`reaction-role`)
    .setDescription("Manage your reaction role system")
    .addSubcommand((command) =>
      command
        .setName("add")
        .setDescription("add a reaction role to a message")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message you want to set reaction role on.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji to react with.")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("The role you want to give")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("remove")
        .setDescription("remove a reactionrole from a message")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message you want to remove rr from.")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji you want to remove.")
            .setRequired(true)
        )
    ),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Reaction Roles", "reactionrole");
  },
};
