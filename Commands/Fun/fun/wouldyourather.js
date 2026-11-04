const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags,
} = require("discord.js");

const QUESTIONS = [
  ["Fight 100 duck-sized horses", "Fight 1 horse-sized duck"],
  ["Never use the internet again", "Never eat your favourite food again"],
  ["Be able to fly but only at walking speed", "Be able to teleport but only to places you've already been"],
  ["Know when you're going to die", "Know how you're going to die"],
  ["Live in a world with no music", "Live in a world with no movies"],
  ["Always have to sing instead of speaking", "Always have to dance instead of walking"],
  ["Be famous for something embarrassing", "Be unknown for something incredible"],
  ["Eat only spicy food forever", "Eat only bland food forever"],
  ["Have unlimited money but no friends", "Have amazing friends but always be broke"],
  ["Be able to speak every language", "Be able to play every instrument"],
  ["Always know when someone is lying", "Be able to lie without anyone ever knowing"],
  ["Live in your favourite TV show", "Live in your favourite video game"],
  ["Have a rewind button for your life", "Have a pause button for your life"],
  ["Be stuck in an elevator with strangers for 12 hours", "Walk home alone for 12 miles"],
  ["Give up social media forever", "Give up watching any video content forever"],
];

module.exports = {
  async execute(interaction, client) {
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const votes = { a: new Set(), b: new Set() };

    function buildContainer(ended = false) {
      const totalVotes = votes.a.size + votes.b.size;
      const pctA = totalVotes ? Math.round((votes.a.size / totalVotes) * 100) : 50;
      const pctB = 100 - pctA;

      const barA = "█".repeat(Math.round(pctA / 10)) + "░".repeat(10 - Math.round(pctA / 10));
      const barB = "█".repeat(Math.round(pctB / 10)) + "░".repeat(10 - Math.round(pctB / 10));

      const container = new ContainerBuilder().setAccentColor(0x5865F2)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## 🤔 Would You Rather...`),
          new TextDisplayBuilder().setContent(
            `**🅰️  ${q[0]}**\n\`${barA}\` ${pctA}% (${votes.a.size} vote${votes.a.size !== 1 ? "s" : ""})\n\n` +
            `**🅱️  ${q[1]}**\n\`${barB}\` ${pctB}% (${votes.b.size} vote${votes.b.size !== 1 ? "s" : ""})`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ended
              ? `-# Voting closed! ${totalVotes} total vote${totalVotes !== 1 ? "s" : ""}.`
              : `-# Vote below — results update live! Open for 60 seconds.`
          )
        );

      if (!ended) {
        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("wyr_a").setLabel("🅰️ Option A").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("wyr_b").setLabel("🅱️ Option B").setStyle(ButtonStyle.Secondary)
          )
        );
      }

      return container;
    }

    const msg = await interaction.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildContainer()],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async (i) => {
      if (i.customId === "wyr_a") {
        votes.b.delete(i.user.id);
        votes.a.add(i.user.id);
      } else {
        votes.a.delete(i.user.id);
        votes.b.add(i.user.id);
      }
      await i.update({ components: [buildContainer()] });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [buildContainer(true)] });
    });
  },
};
