const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");
const Items = require("../../../Schemas/itemsSchema");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getUser("child");

    const adoptionData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
    if (!adoptionData)
      return interaction.reply({ content: `${child} is not your adopted child!`, flags: MessageFlags.Ephemeral });

    const parentData = await Items.findOne({ userId: parent.id });
    if (!parentData || !parentData.items.length)
      return interaction.reply({ content: `${parent} has no items to give!`, flags: MessageFlags.Ephemeral });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("give_item_to_child")
      .setPlaceholder("Select an item to give")
      .addOptions(parentData.items.map((item) => new StringSelectMenuOptionBuilder().setLabel(item).setValue(item)));

    const msg = await interaction.reply({
      content: `Choose an item to give to ${child}:`,
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (i) => {
      if (!i.isStringSelectMenu() || i.customId !== "give_item_to_child") return;
      if (i.user.id !== parent.id)
        return i.reply({ content: "Only the parent can choose an item to give!", flags: MessageFlags.Ephemeral });

      const chosenItem = i.values[0];
      collector.stop();

      // Remove from parent
      parentData.items = parentData.items.filter((it) => it !== chosenItem);
      await parentData.save();

      // Add to child
      let childData = await Items.findOne({ userId: child.id });
      if (!childData) childData = await Items.create({ userId: child.id, items: [] });
      childData.items.push(chosenItem);
      await childData.save();

      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("Item Gifted <:boost:1555544362455146576>")
        .setDescription(`${parent} has gifted **${chosenItem}** to ${child}!`);

      await i.update({ embeds: [embed], components: [] });
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0)
        await interaction.editReply({ content: "Item selection timed out. Action cancelled.", components: [] });
    });
  },
};