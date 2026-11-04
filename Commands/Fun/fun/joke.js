const { EmbedBuilder } = require("discord.js");

module.exports = {
  async execute(interaction, client) {
    const joke = require("one-liner-joke");
    const { member } = interaction;

    const embed = new EmbedBuilder()
      .setDescription(joke.getRandomJoke().body)
      .setColor(client.config.embedColor)
      .setTimestamp()
      .setFooter({
        text: `Requested by ${member.user.tag}`,
        iconURL: member.displayAvatarURL(),
      });

    return interaction.reply({ embeds: [embed] });
  },
};