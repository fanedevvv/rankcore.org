const { EmbedBuilder, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");
const achievementSchema = require("../../../Schemas/achievementSchema");
const { grantAchievement, updateCurrency } = require("./helpers");
const { ACHIEVEMENTS } = require("./constants");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getUser("child");
    const amount = interaction.options.getInteger("amount");

    const adoptionData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
    if (!adoptionData)
      return interaction.reply({ content: `${child} is not your adopted child!`, flags: MessageFlags.Ephemeral });

    const parentHasMoney = await updateCurrency(parent.id, -amount);
    if (!parentHasMoney)
      return interaction.reply({ content: `You don't have enough money to give ${amount} to ${child}!`, flags: MessageFlags.Ephemeral });

    await updateCurrency(child.id, amount);

    let parentData = await achievementSchema.findOne({ userId: parent.id });
    if (!parentData)
      parentData = await achievementSchema.create({ userId: parent.id, achievements: [], guidanceCount: 0 });

    parentData.guidanceCount = (parentData.guidanceCount || 0) + 1;
    await parentData.save();

    if (parentData.guidanceCount >= 10)
      await grantAchievement(parent.id, ACHIEVEMENTS.GUIDING_LIGHT, interaction.channel);

    const embed = new EmbedBuilder()
      .setColor("LuminousVividPink")
      .setTitle("Parental Guidance <:Currency:1567796932041121873>")
      .setDescription(`${parent} gave ${child} **${amount}** in pocket money! What a responsible parent.`);

    return interaction.reply({ embeds: [embed] });
  },
};