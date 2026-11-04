const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");

const RESPONSES = [
  // Positive
  { text: "It is certain.",         color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "It is decidedly so.",    color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "Without a doubt.",       color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "Yes — definitely.",      color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "You may rely on it.",    color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "As I see it, yes.",      color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "Most likely.",           color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "Outlook good.",          color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  { text: "Signs point to yes.",    color: 0x57F287, mood: "<:LEgreen:1555544256356159600> Positive" },
  // Neutral
  { text: "Reply hazy, try again.",        color: 0xFEE75C, mood: "<:error:1555544434601369620> Unclear" },
  { text: "Ask again later.",              color: 0xFEE75C, mood: "<:error:1555544434601369620> Unclear" },
  { text: "Better not tell you now.",      color: 0xFEE75C, mood: "<:error:1555544434601369620> Unclear" },
  { text: "Cannot predict now.",           color: 0xFEE75C, mood: "<:error:1555544434601369620> Unclear" },
  { text: "Concentrate and ask again.",    color: 0xFEE75C, mood: "<:error:1555544434601369620> Unclear" },
  // Negative
  { text: "Don't count on it.",     color: 0xED4245, mood: "<:LEred:1555544262123323422> Negative" },
  { text: "My reply is no.",        color: 0xED4245, mood: "<:LEred:1555544262123323422> Negative" },
  { text: "My sources say no.",     color: 0xED4245, mood: "<:LEred:1555544262123323422> Negative" },
  { text: "Outlook not so good.",   color: 0xED4245, mood: "<:LEred:1555544262123323422> Negative" },
  { text: "Very doubtful.",         color: 0xED4245, mood: "<:LEred:1555544262123323422> Negative" },
];

module.exports = {
  async execute(interaction, client) {
    const question = interaction.options.getString("question");

    if (!question.endsWith("?")) {
      return interaction.reply({
        content: "<:question:1555544543741476917> Please ask a question ending with a `?`",
        ephemeral: true,
      });
    }

    // ─── Thinking stage ───────────────────────────────────────────────────
    const thinking = new ContainerBuilder().setAccentColor(0x5865F2)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Magic 8-Ball`),
        new TextDisplayBuilder().setContent(`> *"${question}"*\n\n*The 8-Ball swirls... <:n_loading:1555544489194688623>*`)
      );

    await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [thinking] });
    await new Promise((r) => setTimeout(r, 1800));

    // ─── Reveal ───────────────────────────────────────────────────────────
    const pick = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

    const result = new ContainerBuilder().setAccentColor(pick.color)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:minigames:1555544500179439707> Magic 8-Ball`),
        new TextDisplayBuilder().setContent(`> *"${question}"*`)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`### The 8-Ball speaks...\n# ${pick.text}`),
        new TextDisplayBuilder().setContent(`**Vibe:** ${pick.mood}`)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Asked by ${interaction.user.username} • <t:${Math.floor(Date.now() / 1000)}:t>`
        )
      );

    return interaction.editReply({ components: [result] });
  },
};
