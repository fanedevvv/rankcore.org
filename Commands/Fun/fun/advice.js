const { EmbedBuilder } = require("discord.js");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = {
  async execute(interaction, client) {
    const data = await fetch("https://api.adviceslip.com/advice").then((res) => res.json());

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`**${data.slip.advice}**`)
          .setColor(client.config.embedColor),
      ],
    });
  },
};