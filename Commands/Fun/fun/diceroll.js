const { EmbedBuilder, MessageFlags } = require("discord.js");

const DICE_COLORS = ["Green", "Orange", null, "White", "Black", "Purple"];

module.exports = {
  async execute(interaction, client) {
    const roll = Math.floor(Math.random() * 6) + 1;
    const color = DICE_COLORS[roll - 1] ?? client.config.embedColor;

    try {
      const embed = new EmbedBuilder()
        .setTitle("<:minigames:1555544500179439707> | Your dice have been rolled...")
        .setColor(color)
        .setDescription(`Your number is **${roll}**!`);

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.log(err);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("<:ban:1555544356352430202> | Something went wrong...")],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};