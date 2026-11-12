const { parseEmoji } = require('discord.js');
const {
  ContainerBuilder, SectionBuilder, TextDisplayBuilder,
  SeparatorBuilder, ThumbnailBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, MessageFlags,
} = require("discord.js");

const CHOICES = { rock: "<:dot:1567796963624226826>", paper: "<:files:1567796970964394044>", scissors: "<:1430986239036625017:1567796926689185822>" };
const BEATS   = { rock: "scissors", scissors: "paper", paper: "rock" };

function getOutcome(a, b) {
  if (a === b) return "tie";
  return BEATS[a] === b ? "win" : "lose";
}

function buildWaitContainer(challenger, opponent, challengerPicked) {
  return new ContainerBuilder().setAccentColor(0x5865F2)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## <:1430986239036625017:1567796926689185822> Rock Paper Scissors`),
          new TextDisplayBuilder().setContent(
            `**${challenger.username}** challenged **${opponent.username}**!\n\n` +
            (challengerPicked
              ? `<a:tickyy:1567797045253644368> ${challenger.username} has locked in their choice!\n<:n_loading:1567796992556666982> Waiting for ${opponent.username}...`
              : `Both players pick below — your choice is hidden from your opponent!`)
          )
        )
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(opponent.displayAvatarURL({ size: 256 })))
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("rps_rock").setLabel("Rock").setEmoji(parseEmoji('<:dot:1567796963624226826>')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rps_paper").setLabel("Paper").setEmoji(parseEmoji('<:files:1567796970964394044>')).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("rps_scissors").setLabel("Scissors").setEmoji(parseEmoji('<:1430986239036625017:1567796926689185822>')).setStyle(ButtonStyle.Secondary)
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Both players must pick. Expires in 30s.`)
    );
}

module.exports = {
  async execute(interaction, client) {
    const challenger = interaction.user;
    const opponent   = interaction.options.getUser("user");

    if (opponent.id === challenger.id)
      return interaction.reply({ content: "You can't challenge yourself!", flags: MessageFlags.Ephemeral });

    // ─── VS Bot ───────────────────────────────────────────────────────────
    if (opponent.bot) {
      const botChoice = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];

      const pickRow = new ContainerBuilder().setAccentColor(0x5865F2)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## <:1430986239036625017:1567796926689185822> Rock Paper Scissors vs Bot`),
          new TextDisplayBuilder().setContent(`Pick your weapon!`)
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("rps_rock").setLabel("Rock").setEmoji(parseEmoji('<:dot:1567796963624226826>')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("rps_paper").setLabel("Paper").setEmoji(parseEmoji('<:files:1567796970964394044>')).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("rps_scissors").setLabel("Scissors").setEmoji(parseEmoji('<:1430986239036625017:1567796926689185822>')).setStyle(ButtonStyle.Secondary)
          )
        );

      await interaction.reply({ flags: MessageFlags.IsComponentsV2, components: [pickRow]});
      const msg = await interaction.fetchReply();
      const col = msg.createMessageComponentCollector({
        filter: (i) => i.user.id === challenger.id,
        max: 1,
        time: 30000,
      });

      col.on("collect", async (i) => {
        const userChoice = i.customId.replace("rps_", "");
        const outcome    = getOutcome(userChoice, botChoice);
        const color = outcome === "win" ? 0x57F287 : outcome === "tie" ? 0xFEE75C : 0xED4245;
        const headline = outcome === "win" ? "<:boost:1567796953599836280> You Win!" : outcome === "tie" ? "🤝 It's a Tie!" : "<:error:1567796968758050868> You Lose!";

        const result = new ContainerBuilder().setAccentColor(color)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## <:1430986239036625017:1567796926689185822> Rock Paper Scissors\n## ${headline}`),
            new TextDisplayBuilder().setContent(
              `**You:** ${CHOICES[userChoice]} ${userChoice}\n` +
              `**Bot:** ${CHOICES[botChoice]} ${botChoice}`
            )
          )
          .addSeparatorComponents(new SeparatorBuilder())
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Play again with \`/fun rps\`!`)
          );

        await i.update({ components: [result] });
      });

      col.on("end", async (c) => {
        if (!c.size) {
          await interaction.editReply({
            components: [
              new ContainerBuilder().setAccentColor(0x95A5A6)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:1430986239036625017:1567796926689185822> RPS\n*You didn't pick in time!*`)),
            ],
          });
        }
      });
      return;
    }

    // ─── VS User ──────────────────────────────────────────────────────────
    const picks = {};

    await interaction.reply({
      content: `${opponent}`,
      allowedMentions: { parse: ["users"] },
      flags: MessageFlags.IsComponentsV2,
      components: [buildWaitContainer(challenger, opponent, false)]
    });
    const msg = await interaction.fetchReply();

    const col = msg.createMessageComponentCollector({
      filter: (i) => {
        if (i.user.id !== challenger.id && i.user.id !== opponent.id) {
          i.reply({ content: "This isn't your game!", flags: MessageFlags.Ephemeral });
          return false;
        }
        return true;
      },
      time: 30000,
    });

    col.on("collect", async (i) => {
      const choice = i.customId.replace("rps_", "");
      picks[i.user.id] = choice;

      if (Object.keys(picks).length < 2) {
        const challengerPicked = !!picks[challenger.id];
        await i.update({ components: [buildWaitContainer(challenger, opponent, challengerPicked)] });
        await i.followUp({ content: `<a:tickyy:1567797045253644368> You picked **${CHOICES[choice]} ${choice}** — locked in!`, flags: MessageFlags.Ephemeral });
      } else {
        col.stop("both_picked");
      }
    });

    col.on("end", async (_, reason) => {
      if (reason !== "both_picked") {
        const didntPick = !picks[challenger.id] ? challenger.username : opponent.username;
        await interaction.editReply({
          components: [
            new ContainerBuilder().setAccentColor(0x95A5A6)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:1430986239036625017:1567796926689185822> RPS\n*${didntPick} didn't pick in time! Game cancelled.*`)),
          ],
        });
        return;
      }

      const cChoice = picks[challenger.id];
      const oChoice = picks[opponent.id];
      const outcome = getOutcome(cChoice, oChoice);
      const color   = outcome === "win" ? 0x57F287 : outcome === "tie" ? 0xFEE75C : 0xED4245;

      let headline;
      if (outcome === "win")  headline = `<:boost:1567796953599836280> ${challenger.username} Wins!`;
      if (outcome === "lose") headline = `<:boost:1567796953599836280> ${opponent.username} Wins!`;
      if (outcome === "tie")  headline = `🤝 It's a Tie!`;

      const result = new ContainerBuilder().setAccentColor(color)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## <:1430986239036625017:1567796926689185822> Rock Paper Scissors\n## ${headline}`),
          new TextDisplayBuilder().setContent(
            `**${challenger.username}:** ${CHOICES[cChoice]} ${cChoice}\n` +
            `**${opponent.username}:** ${CHOICES[oChoice]} ${oChoice}`
          )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`-# Play again with \`/fun rps\`!`)
        );

      await interaction.editReply({ components: [result] });
    });
  },
};
