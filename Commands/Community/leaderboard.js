const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { errorContainer, ACCENT, helpRow } = require("../../Utils/v2helpers");
const levelSchema = require("../../Schemas/level");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard").setDMPermission(false)
    .setDescription("View the server's XP leaderboard.")
    .addIntegerOption(o => o.setName("page").setDescription("Page number to view.").setMinValue(1).setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.info;

    const PAGE_SIZE = 10;
    let page = (interaction.options.getInteger("page") || 1) - 1;
    const all = await levelSchema.find({ Guild: interaction.guild.id }).sort({ Level: -1, XP: -1 });

    if (!all.length)
      return interaction.editReply({
        components: [errorContainer("No Data", "No one has earned XP in this server yet.", { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

    const totalPages = Math.ceil(all.length / PAGE_SIZE);
    const medals = ["🥇", "🥈", "🥉"];

    const buildContainer = (p) => {
      const slice = all.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
      const lines = slice.map((entry, i) => {
        const globalRank = p * PAGE_SIZE + i + 1;
        const icon = medals[globalRank - 1] || `\`#${globalRank}\``;
        return `${icon}  **<@${entry.User}>** — Level ${entry.Level ?? 0} (${(entry.XP ?? 0).toLocaleString()} XP)`;
      }).join("\n");

      return new ContainerBuilder().setAccentColor(accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:1430986209995526274:1567796911350747206>  XP Leaderboard — ${interaction.guild.name}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Page ${p + 1} / ${totalPages}  •  ${all.length} member(s) ranked`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("lb_prev").setLabel("← Prev").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
            new ButtonBuilder().setCustomId("lb_next").setLabel("Next →").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
          )
        )
        .addActionRowComponents(helpRow(client.user.id, { invite: false }));
    };

    const msg = await interaction.editReply({ components: [buildContainer(page)], flags: MessageFlags.IsComponentsV2 });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 120_000 });
    collector.on("collect", async (i) => {
      if (i.customId === "lb_prev") page = Math.max(0, page - 1);
      else if (i.customId === "lb_next") page = Math.min(totalPages - 1, page + 1);
      return i.update({ components: [buildContainer(page)], flags: MessageFlags.IsComponentsV2 });
    });
  },
};
