const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");
const { grantAchievement } = require("./helpers");
const { ACHIEVEMENTS } = require("./constants");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getUser("child");

    // Can't adopt yourself
    if (child.id === parent.id)
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setTitle("You can't adopt yourself!")], flags: MessageFlags.Ephemeral });

    // Can't adopt a bot
    if (child.bot)
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setTitle("You can't adopt a bot!")], flags: MessageFlags.Ephemeral });

    // Check if child is already adopted
    const existing = await adoptionSchema.findOne({ child: child.id });
    if (existing) {
      const currentParent = await client.users.fetch(existing.parent).catch(() => null);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor("Red").setTitle("Already Adopted").setDescription(`${child} already has a parent${currentParent ? ` (${currentParent})` : ""}.`)],
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if the child is trying to adopt their own parent (circular family check)
    const childIsParent = await adoptionSchema.findOne({ parent: child.id, child: parent.id });
    if (childIsParent)
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setTitle("Circular Family").setDescription("You can't adopt someone who is already your parent!")], flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("Adoption Request")
      .setDescription(`${parent} wants to adopt ${child}!\n\n${child}, do you accept?`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("yesAdopt").setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("noAdopt").setLabel("Decline").setStyle(ButtonStyle.Danger)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = msg.createMessageComponentCollector({ time: 30000 });

    collector.on("collect", async (i) => {
      // Only the child can respond
      if (i.user.id !== child.id) return i.reply({ content: "Only the person being adopted can respond!", flags: MessageFlags.Ephemeral });
      collector.stop();

      if (i.customId === "yesAdopt") {
        // Double-check they haven't been adopted while the prompt was open
        const recheck = await adoptionSchema.findOne({ child: child.id });
        if (recheck) {
          embed.setColor("Red").setTitle("Already Adopted").setDescription(`${child} was adopted by someone else before they could respond!`);
          return i.update({ embeds: [embed], components: [] });
        }

        await adoptionSchema.create({ parent: parent.id, child: child.id });

        // Grant achievements
        const children = await adoptionSchema.find({ parent: parent.id });
        await grantAchievement(parent.id, ACHIEVEMENTS.FIRST_ADOPTION, interaction.channel);
        if (children.length >= 3) await grantAchievement(parent.id, ACHIEVEMENTS.BIG_FAMILY, interaction.channel);

        embed
          .setColor("Green")
          .setTitle("Adoption Successful! 👶")
          .setDescription(`${child} has been adopted by ${parent}! Welcome to the family!`);
      }

      if (i.customId === "noAdopt") {
        embed
          .setColor("Red")
          .setTitle("Adoption Declined")
          .setDescription(`${child} declined the adoption request from ${parent}.`);
      }

      await i.update({ embeds: [embed], components: [] });
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        embed.setColor("Grey").setTitle("Timeout").setDescription(`${child} didn't respond in time. Adoption cancelled.`);
        await interaction.editReply({ embeds: [embed], components: [] });
      }
    });
  },
};