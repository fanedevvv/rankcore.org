const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, MessageFlags,
} = require("discord.js");

const FLIP_FRAMES = ["<:Currency:1567796932041121873>", "<:n_loading:1567796992556666982>", "<:boost:1567796953599836280>", "<:Currency:1567796932041121873>"];

module.exports = {
  async execute(interaction, client) {
    // ─── Spinning stage ───────────────────────────────────────────────────
    const spinning = new ContainerBuilder().setAccentColor(0xF1C40F)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:Currency:1567796932041121873> Coin Flip`),
        new TextDisplayBuilder().setContent(`*The coin is in the air... <:n_loading:1567796992556666982>*`)
      );

    await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [spinning] });
    await new Promise((r) => setTimeout(r, 1500));

    // ─── Result ───────────────────────────────────────────────────────────
    const result = Math.random() < 0.5 ? "Heads" : "Tails";
    const emoji  = result === "Heads" ? "<:1430986209995526274:1567796911350747206>" : "🦅";
    const color  = result === "Heads" ? 0xF1C40F : 0x95A5A6;

    const reveal = new ContainerBuilder().setAccentColor(color)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## <:Currency:1567796932041121873> Coin Flip`),
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
