const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { ACCENT, helpRow } = require("../../Utils/v2helpers");
const { parseEmoji } = require("../../Utils/emojis");
const antiscamSchema = require("../../Schemas/antiscam");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("antiscam").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDescription("Configure the anti-scam link detection system."),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: "You need **Administrator** permission.", flags: MessageFlags.Ephemeral });

    let data = await antiscamSchema.findOne({ guildId: interaction.guild.id });
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.error;

    const detStatus = (key) => {
      const d = data?.[key];
      return d?.enabled === false ? "<:LEred:1567796934545121280>" : "<:LEgreen:1567796933307666515>";
    };

    const buildPanel = (d) => {
      const enabled = !!d?.enabled;
      const hv = d?.heatValues || {};
      const statusText = enabled ? "<:LEgreen:1567796933307666515>  **Anti-Scam** — `ENABLED`" : "<:LEred:1567796934545121280>  **Anti-Scam** — `DISABLED`";
      return new ContainerBuilder().setAccentColor(enabled ? ACCENT.error : accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:error:1567796968758050868>  Anti-Scam Configuration"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          "**Detection Types**\n" +
          `${detStatus("detectPhishing")} Phishing Links\n` +
          `${detStatus("detectFakeNitro")} Fake Nitro/Gift Scams\n` +
          `${detStatus("detectSuspiciousContent")} Suspicious Content\n` +
          `${detStatus("detectNewAccounts")} New Account Protection (${d?.newAccountDays || 7}d)\n` +
          `${detStatus("detectSuspiciousUsernames")} Suspicious Usernames\n\n` +
          `**Global Action** — \`${d?.globalAction || "delete"}\`\n` +
          `**Heat Threshold** — ${d?.heatThreshold || 10}\n` +
          `**Log Channel** — ${d?.logChannelId ? `<#${d.logChannelId}>` : "`Not set`"}\n` +
          `**Custom Domains** — ${(d?.customDomains || []).length} blocked\n` +
          `**Warn Steps** — ${(d?.warnSteps || []).length} levels`
        ))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("as_toggle").setLabel(enabled ? "Disable" : "Enable").setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(enabled ? parseEmoji("<:LEred:1567796934545121280>") : parseEmoji("<:LEgreen:1567796933307666515>")),
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(helpRow(client.user.id, { invite: false }));
    };

    const msg = await interaction.reply({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2, fetchReply: true });
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 120_000 });
    collector.on("collect", async (i) => {
      if (i.customId === "as_toggle") {
        if (!data) data = new antiscamSchema({ guildId: interaction.guild.id, enabled: true });
        else data.enabled = !data.enabled;
        await data.save();
        return i.update({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2 });
      }
    });
  },
};
