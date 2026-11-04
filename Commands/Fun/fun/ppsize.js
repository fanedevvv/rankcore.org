const { EmbedBuilder } = require("discord.js");

module.exports = {
  async execute(interaction, client) {
    const penisSize = Math.floor(Math.random() * 10) + 1;
    let penismain = "8";
    for (let i = 0; i < penisSize; i++) penismain += "=";

    const embed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setTitle(`${interaction.user.username}'s Penis Size 😶`)
      .setDescription(`Your penis size is  ${penismain}D`);

    return interaction.reply({ embeds: [embed] });
  },
};