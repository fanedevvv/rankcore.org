const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const Reputation = require('../../Schemas/Reputation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rep-stats")
    .setDescription("Check the reps and highest rating a user has")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to check")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const user = interaction.options.getUser ("user");

    try {
      // Find the reputation document for the user
      const reputation = await Reputation.findOne({ userId: user.id });

      // If no reputation data is found, set default values
      const latest_rep_reason = reputation ? reputation.latestReason : "`None.`";
      const reps = reputation ? reputation.reps : 0;
      const highest_rating = reputation ? reputation.highestRating : "**No stars**";

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Rep Stats`)
        .setDescription(`**Latest reason for rep:**\n${latest_rep_reason}`)
        .setColor(client.config.embedColor) // Placeholder color
        .addFields(
          { name: "Highest Rating", value: highest_rating, inline: true },
          { name: "Rep Count", value: `${reps} reps`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "An error occurred while fetching the stats.", flags: MessageFlags.Ephemeral });
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */