const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");

const FLIP_FRAMES = ["<:Currency:1555544251268595792>", "<:n_loading:1555544489194688623>", "<:boost:1555544362455146576>", "<:Currency:1555544251268595792>"];

module.exports = {
  async execute(interaction, client) {
    // ─── Spinning stage ───────────────────────────────────────────────────
    const spinning = new ContainerBuilder().setAccentColor(0xF1C40F)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Coin Flip`),
        new TextDisplayBuilder().setContent(`*The coin is in the air... <:n_loading:1555544489194688623>*`)
      );

    await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [spinning] });
    await new Promise((r) => setTimeout(r, 1500));

    // ─── Result ───────────────────────────────────────────────────────────
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    const emoji  = result === "Heads" ? "<:1430986209995526274:1555544172302307449>" : "🦅";
    const color  = result === "Heads" ? 0xF1C40F : 0x95A5A6;

    const reveal = new ContainerBuilder().setAccentColor(color)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:Currency:1555544251268595792> Coin Flip`),
        new TextDisplayBuilder().setContent(`The coin has landed!`)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# ${emoji}  ${result}!`)
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Flipped by ${interaction.user.username}`
        )
      );

    return interaction.editReply({ components: [reveal] });
  },
};
