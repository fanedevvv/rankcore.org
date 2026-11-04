const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags,
} = require("discord.js");

const STATEMENTS = [
  "Never have I ever stayed awake for more than 24 hours straight.",
  "Never have I ever pretended to be on a call to avoid someone.",
  "Never have I ever sent a risky text to the wrong person.",
  "Never have I ever fallen asleep in class or at work.",
  "Never have I ever eaten an entire family-sized meal by myself.",
  "Never have I ever stalked someone's social media for more than 30 minutes.",
  "Never have I ever called someone by the wrong name to their face.",
  "Never have I ever secretly disliked a gift and pretended to love it.",
  "Never have I ever forgotten an important birthday or anniversary.",
  "Never have I ever lied about reading a book or watching a movie.",
  "Never have I ever gotten lost and refused to ask for directions.",
  "Never have I ever broken something expensive and blamed someone else.",
  "Never have I ever eaten food that fell on the floor.",
  "Never have I ever ignored a 'read receipt' for more than a day.",
  "Never have I ever panic-cleaned before guests arrived.",
  "Never have I ever laughed at something I absolutely shouldn't have.",
  "Never have I ever cried at a commercial or advertisement.",
  "Never have I ever had an argument with a video game NPC.",
  "Never have I ever rewatched a TV show or movie more than 5 times.",
  "Never have I ever pretended to be asleep to avoid a conversation.",
];

module.exports = {
  async execute(interaction, client) {
    const statement = STATEMENTS[Math.floor(Math.random() * STATEMENTS.length)];
    const raised    = new Set(); // "I have"
    const clean     = new Set(); // "Never have I"

    function buildContainer(ended = false) {
      const raisedList = raised.size
        ? [...raised].map((id) => `<@${id}>`).join(", ")
        : "*Nobody yet...*";
      const cleanList  = clean.size
        ? [...clean].map((id) => `<@${id}>`).join(", ")
        : "*Nobody yet...*";

      const container = new ContainerBuilder().setAccentColor(0x9B59B6)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## 🙋 Never Have I Ever...`),
          new TextDisplayBuilder().setContent(`> *${statement}*`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `🙋 **I Have! (${raised.size}):** ${raisedList}\n\n` +
            `🙅 **Never Have I! (${clean.size}):** ${cleanList}`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            ended
              ? `-# Voting closed! • Use \`/fun never-have-i-ever\` for another round.`
              : `-# Vote honestly! Closes in 45 seconds.`
          )
        );

      if (!ended) {
        container.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("nhie_have").setLabel("🙋 I Have!").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("nhie_never").setLabel("🙅 Never Have I").setStyle(ButtonStyle.Success)
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

    const collector = msg.createMessageComponentCollector({ time: 45000 });

    collector.on("collect", async (i) => {
      if (i.customId === "nhie_have") {
        clean.delete(i.user.id);
        raised.add(i.user.id);
      } else {
        raised.delete(i.user.id);
        clean.add(i.user.id);
      }
      await i.update({ components: [buildContainer()] });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [buildContainer(true)] });
    });
  },
};
