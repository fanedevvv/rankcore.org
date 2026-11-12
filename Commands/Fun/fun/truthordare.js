const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags,
} = require("discord.js");

const TRUTHS = [
  "What's the most embarrassing thing that has happened to you in public?",
  "Have you ever lied to get out of trouble? What was it?",
  "What's the weirdest dream you've ever had?",
  "What's your biggest pet peeve about someone in this server?",
  "Have you ever accidentally sent a text to the wrong person? What did it say?",
  "What's one thing you'd never want your parents to find out about?",
  "What's the longest you've ever gone without showering?",
  "Have you ever cheated at a game? Which one?",
  "What's the most childish thing you still do?",
  "What's a secret talent or skill that nobody knows about?",
  "What's your most irrational fear?",
  "What's the most embarrassing thing on your search history?",
  "Have you ever ghosted someone? Why?",
  "What's the worst gift you've ever received?",
  "Have you ever pretended to be busy to avoid someone?",
];

const DARES = [
  "Type a message using only your elbows.",
  "Write a love poem about the next person who speaks.",
  "Change your server nickname to 'NotACoolPerson' for the next hour.",
  "Write 'I am a potato' in the next 5 messages you send.",
  "Speak in rhymes for the next 2 minutes.",
  "Say something nice about everyone currently online.",
  "Use only emojis to describe what you had for dinner last night.",
  "Set your status to 'having an existential crisis' for 30 minutes.",
  "Tell a joke. It has to be funny.",
  "Describe your day as if you were a pirate.",
  "Write a haiku about your favourite food right now.",
  "Speak in CAPS LOCK for the next 5 messages.",
  "Confess the last weird thing you Googled.",
  "Reply to the next 3 messages with a GIF only.",
  "Change your avatar temporarily to the most random image on your device.",
];

module.exports = {
  async execute(interaction, client) {
    const target = interaction.options.getUser("user") || null;
    const targetLine = target ? `${target} — it's your turn!` : null;

    function buildPicker() {
      const container = new ContainerBuilder().setAccentColor(0xE91E63)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## <:minigames:1567796978929238076> Truth or Dare`),
          new TextDisplayBuilder().setContent(
            (targetLine ? `${targetLine}\n\n` : "") +
            `Pick your poison!`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("truth").setLabel("🤔 Truth").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("dare").setLabel("😈 Dare").setStyle(ButtonStyle.Danger)
          )
        );
      return container;
    }

    await interaction.reply({
      content: target ? `${target}` : undefined,
      allowedMentions: { parse: ["users"] },
      flags: MessageFlags.IsComponentsV2,
      components: [buildPicker()]
    });
    const msg = await interaction.fetchReply();

    const allowedId = target?.id || interaction.user.id;
    const collector = msg.createMessageComponentCollector({
      filter: (i) => {
        if (i.user.id !== allowedId) {
          i.reply({ content: "This isn't yours to pick!", flags: MessageFlags.Ephemeral });
          return false;
        }
        return true;
      },
      max: 1,
      time: 30000,
    });

    collector.on("collect", async (i) => {
      const isTruth = i.customId === "truth";
      const pool    = isTruth ? TRUTHS : DARES;
      const pick    = pool[Math.floor(Math.random() * pool.length)];
      const color   = isTruth ? 0x3498DB : 0xED4245;
      const label   = isTruth ? "🤔 Truth" : "😈 Dare";

      const result = new ContainerBuilder().setAccentColor(color)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## ${label}`),
          new TextDisplayBuilder().setContent(
            (targetLine ? `*For ${target}:*\n\n` : "") + `> ${pick}`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Chosen by ${i.user.username} • Use \`/fun truth-or-dare\` to play again!`
          )
        );

      await i.update({ components: [result] });
    });

    collector.on("end", async (collected) => {
      if (!collected.size) {
        const expired = new ContainerBuilder().setAccentColor(0x95A5A6)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:minigames:1567796978929238076> Truth or Dare\n*Nobody picked in time! Too scared? 😏*`)
          );
        await interaction.editReply({ components: [expired] });
      }
    });
  },
};
