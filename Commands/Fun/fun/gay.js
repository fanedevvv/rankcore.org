const { EmbedBuilder } = require("discord.js");

module.exports = {
  async execute(interaction, client) {
    const user = interaction.options.getUser("user") || interaction.user;
    const percent = Math.floor(Math.random() * 101);

    const embed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setTitle("🏳️‍<:eco:1555544429253890050> Gay Meter")
      .setDescription(`${user} is **${percent}%** gay!`);

    return interaction.reply({ embeds: [embed] });
  },
};