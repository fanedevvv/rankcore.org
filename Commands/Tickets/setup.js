const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketsetup')
        .setDescription('Setup the ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.reply({
            content: `This system isn't configurable via commands! Use the dashboard: ${process.env.DASHBOARD_URL || "https://dash.rankcore.org"}/guild/${interaction.guild.id}/ticket`,
            ephemeral: true,
        });
    },
};
