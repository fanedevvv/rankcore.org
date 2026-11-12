const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { parseEmoji } = require('../../Utils/emojis');
const { ACCENT, helpRow, errorContainer } = require("../../Utils/v2helpers");
const AntiRaidSchema = require("../../Schemas/AntiRaidSchema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("antiraid").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDescription("Configure the anti-raid protection system."),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: "You need **Administrator** permission.", flags: MessageFlags.Ephemeral });

    let data = await AntiRaidSchema.findOne({ guildId: interaction.guild.id });
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.error;

    const buildPanel = (d) => {
      const enabled    = !!d?.enabled;
      const statusText = enabled ? "<:LEgreen:1567796933307666515>  **Anti-Raid** — `ENABLED`" : "<:LEred:1567796934545121280>  **Anti-Raid** — `DISABLED`";
      const cfgLines = [
        `**Join Threshold** — ${d?.joinThreshold ? `\`${d.joinThreshold} joins\`` : "\`5 joins\`"} (default: 5 per 10s)`,
        `**Action** — ${d?.action ? `\`${d.action}\`` : "\`ban\`"}`,
        `**Whitelist** — ${d?.whitelist?.length ? `${d.whitelist.length} user(s)` : "\`None\`"}`,
      ].join("\n");

      return new ContainerBuilder().setAccentColor(enabled ? ACCENT.error : accent)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:restrict:1567797003638022166>  Anti-Raid Configuration"))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(statusText))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(cfgLines))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          "-# When a raid is detected, the bot will automatically take the configured action against new joiners."
        ))
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("ar_toggle").setLabel(enabled ? "Disable" : "Enable").setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success).setEmoji(enabled ? parseEmoji("<:LEred:1567796934545121280>") : parseEmoji("<:LEgreen:1567796933307666515>")),
            new ButtonBuilder().setCustomId("ar_set_threshold").setLabel("Set Threshold").setStyle(ButtonStyle.Primary).setEmoji(parseEmoji("<:n_utils:1567796996830658573>")),
            new ButtonBuilder().setCustomId("ar_set_action").setLabel("Set Action").setStyle(ButtonStyle.Primary).setEmoji(parseEmoji("<:thunderr:1567797012991189134>")),
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
        .addActionRowComponents(helpRow(client.user.id, { invite: false }));
    };

    await interaction.reply({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2});
    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 300_000 });

    collector.on("collect", async (i) => {
      if (i.customId === "ar_toggle") {
        if (!data) data = new AntiRaidSchema({ guildId: interaction.guild.id, enabled: true });
        else data.enabled = !data.enabled;
        await data.save();
        return i.update({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2 });
      }

      if (i.customId === "ar_set_threshold") {
        await i.update({
          components: [new ContainerBuilder().setAccentColor(accent)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_utils:1567796996830658573>  Set Join Threshold\n\nType a number (e.g. `5`) in chat — the amount of joins per 10 seconds to trigger the raid response.\n\n-# Type below ↓"))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
        const mc = i.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 30_000 });
        mc.on("collect", async (m) => {
          const num = parseInt(m.content);
          m.delete().catch(() => {});
          if (isNaN(num) || num < 2 || num > 50) return interaction.followUp({ content: "<:crossy:1567796959648030831> Please enter a number between 2 and 50.", flags: MessageFlags.Ephemeral });
          if (!data) data = new AntiRaidSchema({ guildId: interaction.guild.id });
          data.joinThreshold = num; await data.save();
          await interaction.followUp({ content: `<a:tickyy:1567797045253644368> Join threshold set to **${num}**.`, flags: MessageFlags.Ephemeral });
          return interaction.editReply({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2 });
        });
        mc.on("end", async (c) => { if (!c.size) { await interaction.followUp({ content: "<:1430986244921495654:1567796929587576852> Timed out.", flags: MessageFlags.Ephemeral }); return interaction.editReply({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2 }); } });
      }

      if (i.customId === "ar_set_action") {
        const actionMenu = new ContainerBuilder().setAccentColor(accent)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:thunderr:1567797012991189134>  Set Raid Action\n\nChoose what happens when a raid is detected:"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addActionRowComponents(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId("ar_action_ban").setLabel("Ban").setStyle(ButtonStyle.Danger).setEmoji(parseEmoji("<:ban:1567796952538554458>")),
              new ButtonBuilder().setCustomId("ar_action_kick").setLabel("Kick").setStyle(ButtonStyle.Danger).setEmoji(parseEmoji("<:restrict:1567797003638022166>")),
              new ButtonBuilder().setCustomId("ar_action_timeout").setLabel("Timeout").setStyle(ButtonStyle.Danger).setEmoji(parseEmoji("<:timeout:1567797028979740822>")),
              new ButtonBuilder().setCustomId("ar_action_back").setLabel("← Back").setStyle(ButtonStyle.Secondary),
            )
          );
        return i.update({ components: [actionMenu], flags: MessageFlags.IsComponentsV2 });
      }

      if (i.customId.startsWith("ar_action_")) {
        if (i.customId === "ar_action_back") return i.update({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2 });
        const action = i.customId.replace("ar_action_", "");
        if (!data) data = new AntiRaidSchema({ guildId: interaction.guild.id });
        data.action = action; await data.save();
        await i.reply({ content: `<a:tickyy:1567797045253644368> Raid action set to **${action}**.`, flags: MessageFlags.Ephemeral });
        return i.message.edit({ components: [buildPanel(data)], flags: MessageFlags.IsComponentsV2 });
      }
    });
  },
};
