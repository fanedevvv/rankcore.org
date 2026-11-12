const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");
const { parseDuration } = require("./helpers");
const { MAX_GROUNDING_MINUTES } = require("./constants");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getUser("child");
    const durationString = interaction.options.getString("duration");

    const durationMs = parseDuration(durationString);
    if (!durationMs || durationMs <= 0)
      return interaction.reply({ content: "Invalid duration format. Use formats like `1h30m` or `5m`.", flags: MessageFlags.Ephemeral });

    const minutes = Math.floor(durationMs / 60000);
    if (minutes > MAX_GROUNDING_MINUTES)
      return interaction.reply({ content: `The maximum grounding duration is ${MAX_GROUNDING_MINUTES} minutes (12 hours).`, flags: MessageFlags.Ephemeral });

    const adoptionData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
    if (!adoptionData)
      return interaction.reply({ content: `${child} is not your adopted child!`, flags: MessageFlags.Ephemeral });

    if (adoptionData.grounded)
      return interaction.reply({ content: `${child} is already grounded until <t:${Math.floor(adoptionData.groundedUntil.getTime() / 1000)}:R>!`, flags: MessageFlags.Ephemeral });

    const groundedUntil = new Date(Date.now() + durationMs);
    adoptionData.grounded = true;
    adoptionData.groundedUntil = groundedUntil;
    adoptionData.groundedBy = parent.id;
    await adoptionData.save();

    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("Grounded! <:ban:1567796952538554458>")
      .setDescription(`${parent} has grounded ${child} for **${durationString}**! They will be ungrounded <t:${Math.floor(groundedUntil.getTime() / 1000)}:R>.`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`unground_${child.id}`).setLabel("Unground Now").setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [embed], components: [row]});
    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ time: durationMs, persistent: true });

    collector.on("collect", async (i) => {
      if (i.user.id !== parent.id)
        return i.reply({ content: `Only ${parent} can unground this child!`, flags: MessageFlags.Ephemeral });

      if (i.customId === `unground_${child.id}`) {
        const data = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
        if (!data || !data.grounded)
          return i.update({ content: `${child} is no longer grounded.`, embeds: [], components: [] });

        data.grounded = false;
        data.groundedUntil = null;
        data.groundedBy = null;
        await data.save();

        embed.setColor("Green").setTitle("Ungrounded! <:boost:1567796953599836280>").setDescription(`${child} has been ungrounded by ${parent} early.`);
        await i.update({ embeds: [embed], components: [] });
        collector.stop();
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        const updatedData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
        if (updatedData && updatedData.grounded && updatedData.groundedUntil <= new Date()) {
          updatedData.grounded = false;
          updatedData.groundedUntil = null;
          updatedData.groundedBy = null;
          await updatedData.save();

          if (collected.size === 0) {
            const endEmbed = new EmbedBuilder().setColor("Green").setTitle("Grounding Over!").setDescription(`${child} is now ungrounded as the time has ended.`);
            await interaction.editReply({ embeds: [endEmbed], components: [] });
          }
        }
      }
    });
  },
};