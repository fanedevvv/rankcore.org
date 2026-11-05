const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder,
} = require("discord.js");
const { errorContainer, ACCENT, helpRow } = require("../../Utils/v2helpers");
const levelSchema = require("../../Schemas/level");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank").setDMPermission(false)
    .setDescription("View your or another member's level rank card.")
    .addUserOption(o => o.setName("user").setDescription("The user to check.").setRequired(false)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const target = interaction.options.getUser("user") || interaction.user;
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.info;

    const data = await levelSchema.findOne({ User: target.id, Guild: interaction.guild.id });

    if (!data)
      return interaction.editReply({
        components: [errorContainer("No Data", `**${target.tag}** hasn't earned any XP in this server yet.`, { clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });

    const xpNeeded = (data.Level ?? 0) * 500 || 500;
    const pct = Math.min(Math.round(((data.XP ?? 0) / xpNeeded) * 100), 100);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));

    // Sort for rank
    const all = await levelSchema.find({ Guild: interaction.guild.id }).sort({ Level: -1, XP: -1 });
    const rank = all.findIndex(d => d.User === target.id) + 1;

    return interaction.editReply({
      components: [new ContainerBuilder().setAccentColor(accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## <:boost:1567796953599836280>  Rank Card — ${target.username}`))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `**Rank** — #${rank}\n**Level** — ${data.Level ?? 0}\n**XP** — ${(data.XP ?? 0).toLocaleString()} / ${xpNeeded.toLocaleString()}\n\n\`${bar}\` ${pct}%`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${xpNeeded - (data.XP ?? 0)} XP needed to reach level ${(data.Level ?? 0) + 1}`))
        .addActionRowComponents(helpRow(client.user.id, { invite: false }))
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
