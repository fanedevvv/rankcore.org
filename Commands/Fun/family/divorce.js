const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const marriageSchema = require("../../../Schemas/marriageSchema");

module.exports = {
  async execute(interaction, client) {
    const intUser = interaction.user;
    const marriageData = await marriageSchema.findOne({ marriedUser: intUser.id });

    if (!marriageData)
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setTitle("You are not married!")], flags: MessageFlags.Ephemeral });

    const partner = await client.users.fetch(marriageData.marriedTo);

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("Divorce Confirmation")
      .setDescription(`Are you absolutely sure you want to divorce ${partner}? This action is irreversible.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("yesDivorce").setLabel("Yes, Divorce").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("noDivorce").setLabel("No, Cancel").setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = msg.createMessageComponentCollector({ time: 30000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== intUser.id) return i.deferUpdate();
      collector.stop();

      if (i.customId === "yesDivorce") {
        await marriageSchema.deleteMany({ $or: [{ marriedUser: intUser.id }, { marriedUser: marriageData.marriedTo }] });
        embed.setColor("DarkRed").setTitle("Divorce Completed <:Red_Heart:1567796949271191642>").setDescription(`You are now divorced from ${partner}. What a shame.`);
      }

      if (i.customId === "noDivorce") {
        embed.setColor("Green").setTitle("Divorce Cancelled 🕊️").setDescription("You decided not to proceed with the divorce. That's true love!");
      }

      await i.update({ embeds: [embed], components: [] });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        embed.setColor("Grey").setTitle("Timeout").setDescription("Divorce confirmation timed out. Action cancelled.");
        await interaction.editReply({ embeds: [embed], components: [] });
      }
    });
  },
};