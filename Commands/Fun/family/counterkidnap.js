const { EmbedBuilder, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");

const COUNTER_KIDNAP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const COUNTER_KIDNAP_CHANCE = 0.6;                    // 60%

module.exports = {
  async execute(interaction, client) {
    const counterKidnapper = interaction.user;
    const parentUser = interaction.options.getUser("parent");

    const recentlyKidnapped = await adoptionSchema.findOne({
      parent: parentUser.id,
      isKidnapped: true,
      adoptionDate: { $gte: new Date(Date.now() - COUNTER_KIDNAP_WINDOW_MS) },
    });

    if (!recentlyKidnapped)
      return interaction.reply({
        content: `${parentUser} does not have a child who was recently kidnapped.`,
        flags: MessageFlags.Ephemeral,
      });

    const child = await client.users.fetch(recentlyKidnapped.child);
    const originalKidnapper = await client.users.fetch(recentlyKidnapped.kidnapperId);
    const success = Math.random() < COUNTER_KIDNAP_CHANCE;

    if (success) {
      recentlyKidnapped.parent = counterKidnapper.id;
      recentlyKidnapped.isKidnapped = false;
      recentlyKidnapped.kidnapperId = null;
      await recentlyKidnapped.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor("Yellow")
            .setTitle("Counter-Kidnap Success! 🦸")
            .setDescription(`${counterKidnapper} successfully rescued ${child} from ${originalKidnapper} and has now adopted them!`),
        ],
      });
    }

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor("DarkRed")
          .setTitle("Counter-Kidnap Failed!")
          .setDescription(`${counterKidnapper} failed to rescue ${child}! ${originalKidnapper} managed to keep their new child.`),
      ],
    });
  },
};