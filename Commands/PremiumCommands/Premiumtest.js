const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
    .setName('premium-test')
    .setDescription('Test to see if you or your guild has premium!'),
    premium: true,
    premiumTier: "basic",
    async execute(interaction) {
            await interaction.reply('If you can see this, you or your guild has premium!')
    }
}