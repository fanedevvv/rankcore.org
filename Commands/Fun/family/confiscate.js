const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
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

    let childData = await Items.findOne({ userId: child.id });
    if (!childData) childData = await Items.create({ userId: child.id, items: [] });

    if (!childData.items.length)
      return interaction.reply({ content: `${child} has no items left to confiscate!`, flags: MessageFlags.Ephemeral });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("confiscate_item")
      .setPlaceholder("Select an item to confiscate")
      .addOptions(childData.items.map((item) => new StringSelectMenuOptionBuilder().setLabel(item).setValue(item)));

    const msg = await interaction.reply({
      content: `Choose an item to confiscate from ${child}:`,
      components: [new ActionRowBuilder().addComponents(selectMenu)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (i) => {
      if (!i.isStringSelectMenu() || i.customId !== "confiscate_item") return;
      if (i.user.id !== parent.id)
        return i.reply({ content: "Only the parent can choose an item!", flags: MessageFlags.Ephemeral });

      const chosenItem = i.values[0];
      collector.stop();

      // Remove from child's inventory
      childData.items = childData.items.filter((it) => it !== chosenItem);
      await childData.save();

      // Add to parent's confiscated list
      let parentData = await Items.findOne({ userId: parent.id });
      if (!parentData) parentData = await Items.create({ userId: parent.id, items: [], confiscated: [] });
      if (!parentData.confiscated) parentData.confiscated = [];
      parentData.confiscated.push({ item: chosenItem, childId: child.id, timestamp: new Date() });
      await parentData.save();

      const safeItemId = chosenItem.replace(/\s/g, "_");
      const giveBackBtn = new ButtonBuilder()
        .setCustomId(`giveback_${child.id}_${safeItemId}`)
        .setLabel("Give Back")
        .setStyle(ButtonStyle.Success);

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("Item Confiscated 😠")
        .setDescription(`${parent} has confiscated **${chosenItem}** from ${child}! It is now in time-out.`);

      await i.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(giveBackBtn)] });

      // Collector for the "Give Back" button
      const buttonCollector = msg.createMessageComponentCollector({ time: 3600000, persistent: true });

      buttonCollector.on("collect", async (btn) => {
        if (btn.user.id !== parent.id)
          return btn.reply({ content: "Only the parent can give the item back!", flags: MessageFlags.Ephemeral });

        if (btn.customId !== `giveback_${child.id}_${safeItemId}`) return;

        let cData = await Items.findOne({ userId: child.id });
        let pData = await Items.findOne({ userId: parent.id });

        const confiscatedIndex = pData.confiscated.findIndex(
          (entry) => entry.item === chosenItem && entry.childId === child.id
        );

        if (confiscatedIndex === -1)
          return btn.reply({ content: "This item is no longer in your confiscated list.", flags: MessageFlags.Ephemeral });

        pData.confiscated.splice(confiscatedIndex, 1);
        cData.items.push(chosenItem);
        await cData.save();
        await pData.save();

        const embedBack = new EmbedBuilder()
          .setColor("Green")
          .setTitle("Item Returned <:boost:1555544362455146576>")
          .setDescription(`${parent} has given back **${chosenItem}** to ${child}.`);

        await btn.update({ embeds: [embedBack], components: [] });
        buttonCollector.stop();
      });
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && collected.size === 0)
        await interaction.editReply({ content: "Item selection timed out. Action cancelled.", components: [] });
    });
  },
};