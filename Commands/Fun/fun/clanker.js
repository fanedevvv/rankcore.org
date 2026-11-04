const { EmbedBuilder } = require("discord.js");

module.exports = {
  async execute(interaction, client) {
    const user = interaction.options.getUser("user") || interaction.user;
    const percent = Math.floor(Math.random() * 101);

    const embed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setTitle("<:n_bot:1555544367886770176> Clanker Meter")
      .setDescription(`${user} is **${percent}%** a clanker!`);

    return interaction.reply({ embeds: [embed] });
  },
};