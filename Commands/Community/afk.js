const {
  SlashCommandBuilder, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT, helpRow } = require("../../Utils/v2helpers");
const afkSchema = require("../../Schemas/afkschema");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("afk").setDMPermission(false)
    .setDescription("Set or remove your AFK status.")
    .addSubcommand(s => s.setName("set").setDescription("Set yourself as AFK.")
      .addStringOption(o => o.setName("reason").setDescription("Your AFK reason.").setRequired(false).setMaxLength(200))
      .addBooleanOption(o => o.setName("global").setDescription("Apply AFK across all servers (default: current server only)").setRequired(false)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove your AFK status.")),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.info;

    if (sub === "set") {
      const reason = interaction.options.getString("reason") || "AFK";
      const isGlobal = interaction.options.getBoolean("global") ?? false;

      if (isGlobal) {
        const allGuilds = client.guilds.cache.map(g => g.id);
        let setCount = 0;
        
        for (const guildId of allGuilds) {
          const guild = client.guilds.cache.get(guildId);
          const member = guild?.members.cache.get(interaction.user.id);
          const nick = member?.nickname || interaction.user.username;
          
          await afkSchema.findOneAndUpdate(
            { userId: interaction.user.id, guildId },
            { userId: interaction.user.id, guildId, reason, timestamp: Date.now(), nickname: nick },
            { upsert: true, new: true }
          );
          setCount++;
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        const nickname = member?.nickname || interaction.user.username;
        await member?.setNickname(`[AFK] ${nickname}`).catch(() => {});

        return interaction.reply({
          components: [new ContainerBuilder().setAccentColor(accent)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_loading:1567796992556666982>  Global AFK Set"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `You are now **AFK** in **${setCount}** servers.\n**Reason** — ${reason}\n\nYour status will be removed when you send a message in any server.`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addActionRowComponents(helpRow(client.user.id, { invite: false }))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        const member = interaction.member;
        const nickname = member?.nickname || interaction.user.username;

        await afkSchema.findOneAndUpdate(
          { userId: interaction.user.id, guildId: interaction.guild.id },
          { userId: interaction.user.id, guildId: interaction.guild.id, reason, timestamp: Date.now(), nickname },
          { upsert: true, new: true }
        );

        await member?.setNickname(`[AFK] ${nickname}`).catch(() => {});

        return interaction.reply({
          components: [new ContainerBuilder().setAccentColor(accent)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:n_loading:1567796992556666982>  AFK Status Set"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `You are now **AFK** in this server.\n**Reason** — ${reason}\n\nYour status will be removed when you next send a message.`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addActionRowComponents(helpRow(client.user.id, { invite: false }))
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    if (sub === "remove") {
      const data = await afkSchema.find({ userId: interaction.user.id });
      
      if (!data || data.length === 0) {
        return interaction.reply({
          components: [errorContainer("Not AFK", "You don't have an active AFK status.", { clientId: client.user.id })],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      const removeCount = data.length;
      
      for (const afkData of data) {
        await afkSchema.deleteMany({ userId: interaction.user.id, guildId: afkData.guildId });
        
        const guild = client.guilds.cache.get(afkData.guildId);
        if (guild) {
          const member = guild.members.cache.get(interaction.user.id);
          if (member && afkData.nickname) {
            await member.setNickname(afkData.nickname).catch(() => {});
          }
        }
      }

      const member = interaction.member;
      if (data[0]?.nickname) {
        await member?.setNickname(data[0].nickname).catch(() => {});
      }

      return interaction.reply({
        components: [successContainer(
          "<:n_loading:1567796992556666982>  AFK Removed",
          `Your AFK status has been cleared in **${removeCount}** servers. Welcome back!`,
          { accent, clientId: client.user.id }
        )],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};