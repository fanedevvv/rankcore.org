const { EmbedBuilder, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getUser("child");

    const adoptionData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
    if (!adoptionData)
      return interaction.reply({ content: `${child} is not your adopted child!`, flags: MessageFlags.Ephemeral });
    if (!adoptionData.grounded)
      return interaction.reply({ content: `${child} is not currently grounded!`, flags: MessageFlags.Ephemeral });

    adoptionData.grounded = false;
    adoptionData.groundedUntil = null;
    adoptionData.groundedBy = null;
    await adoptionData.save();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("Ungrounded! <:boost:1567796953599836280>")
      .setDescription(`${child} has been ungrounded by ${parent}.`);

    return interaction.reply({ embeds: [embed] });
  },
};