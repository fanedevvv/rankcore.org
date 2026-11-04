const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getUser("child");

    const adoptionData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
    if (!adoptionData)
      return interaction.reply({ content: `${child} is not your adopted child!`, flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setColor("DarkVividPink")
      .setTitle("Unadopt Confirmation")
      .setDescription(`Are you sure you want to unadopt ${child}?`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("yesUnadopt").setLabel("Yes").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("noUnadopt").setLabel("No").setStyle(ButtonStyle.Success)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = msg.createMessageComponentCollector({ time: 30000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== parent.id) return i.deferUpdate();
      collector.stop();

      if (i.customId === "yesUnadopt") {
        await adoptionSchema.findOneAndDelete({ parent: parent.id, child: child.id });
        embed.setColor("Green").setTitle("Child Unadopted").setDescription(`${child} has been successfully unadopted. You monster.`);
      }

      if (i.customId === "noUnadopt") {
        embed.setColor("Blurple").setTitle("Action Cancelled").setDescription(`You decided not to unadopt ${child}.`);
      }

      await i.update({ embeds: [embed], components: [] });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        embed.setColor("Grey").setTitle("Timeout").setDescription("Unadopt confirmation timed out. Action cancelled.");
        await interaction.editReply({ embeds: [embed], components: [] });
      }
    });
  },
};