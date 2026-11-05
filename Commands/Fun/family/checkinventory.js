const { EmbedBuilder } = require("discord.js");
const Items = require("../../../Schemas/itemsSchema");

module.exports = {
  async execute(interaction, client) {
    const user = interaction.options.getUser("user") || interaction.user;
    const data = await Items.findOne({ userId: user.id });

    let itemsList = data?.items?.length ? data.items.join("\n") : "None";
    let confiscatedList = data?.confiscated?.length
      ? data.confiscated.map((i) => `${i.item} (from <@${i.childId}>)`).join("\n")
      : "None";

    if (itemsList.length > 1024) itemsList = itemsList.substring(0, 1000) + "...";
    if (confiscatedList.length > 1024) confiscatedList = confiscatedList.substring(0, 1000) + "...";

    const embed = new EmbedBuilder()
      .setColor("DarkButNotBlack")
      .setTitle(`🎒 ${user.username}'s Inventory`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: `<:files:1567796970964394044> Items (${data?.items?.length || 0})`, value: itemsList, inline: false },
        { name: `<:error:1567796968758050868> Confiscated Items (${data?.confiscated?.length || 0})`, value: confiscatedList, inline: false }
      );

    return interaction.reply({ embeds: [embed] });
  },
};