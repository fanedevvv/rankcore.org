const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const Reputation = require('../../Schemas/Reputation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rep")
    .setDescription("Give a rep to a user")
    .setDMPermission(false)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to rep")
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName("rating")
        .setDescription("Rate the user 1-5 stars")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for repping this user")
        .setMaxLength(1024)
    ),

  async execute(interaction, client) {
    const user = interaction.options.getUser ("user");
    const rating = interaction.options.getNumber("rating");
    const reason = interaction.options.getString("reason") || "No reason.";
    const ratingStars = "<:boost:1567796953599836280>".repeat(rating);

    if (user.id === interaction.user.id) {
      return await interaction.reply({ content: "You cannot give yourself a rep.", ephemeral: true });
    }

    try {
      let reputation = await Reputation.findOne({ userId: user.id });

      if (!reputation) {
        reputation = new Reputation({ userId: user.id });
      }

      if (rating > reputation.highestRating.length) {
        reputation.highestRating = ratingStars;
      }

      reputation.latestReason = reason;
      reputation.reps += 1;

      await reputation.save();

      const embed = new EmbedBuilder()
        .setTitle(`${user.username} | +1 Rep`)
        .setDescription(`**${interaction.user}** gave ${user} +1 rep`)
        .setColor(client.config.embedColor)
        .addFields(
          { name: "Rating", value: ratingStars, inline: true },
          { name: "Reason", value: `**${reason}**`, inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "An error occurred while processing your request.", ephemeral: true });
    }
  },
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */