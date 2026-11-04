"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");

// All setup logic has been moved to the Roco Dashboard.
// This command now redirects users to the dashboard to configure Level Roles.

module.exports = {
  data: new SlashCommandBuilder()
        .setName(`level-roles`)
        .setDescription(`Give roles to people after reaching a certain level`)
        .addSubcommand(command => 
            command.setName(`set`)
                .setDescription(`Setup the level role system`)
                .addRoleOption(option => option.setName(`role1`).setDescription(`The first milestone role to give`).setRequired(true))
                .addNumberOption(option => option.setName('level1').setDescription("The level to reach to get the reward for role1").setRequired(true))
                .addRoleOption(option => option.setName(`role2`).setDescription(`The 2nd milestone role to give`).setRequired(false))
                .addNumberOption(option => option.setName('level2').setDescription("The level to reach to get the reward for role2").setRequired(false))
                .addRoleOption(option => option.setName(`role3`).setDescription(`The 3rd milestone role to give`).setRequired(false))
                .addNumberOption(option => option.setName('level3').setDescription("The level to reach to get the reward for role3").setRequired(false))
                .addRoleOption(option => option.setName(`role4`).setDescription(`The 4th milestone role to give`).setRequired(false))
                .addNumberOption(option => option.setName('level4').setDescription("The level to reach to get the reward for role4").setRequired(false))
                .addRoleOption(option => option.setName(`role5`).setDescription(`The 5th milestone role to give`).setRequired(false))
                .addNumberOption(option => option.setName('level5').setDescription("The level to reach to get the reward for role5").setRequired(false))
        )
        .addSubcommand(command => command.setName(`remove`).setDescription(`Remove the level role system`))
        .addSubcommand(command => command.setName(`view`).setDescription(`View the server's level role(s)`)),

  async execute(interaction, client) {
    return dashboardRedirect(interaction, "Level Roles", "leveling");
  },
};
