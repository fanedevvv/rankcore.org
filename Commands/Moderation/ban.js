const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const { modActionContainer, errorContainer, helpRow, ACCENT } = require("../../Utils/v2helpers");
const { generateCase } = require("./_modUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban").setDMPermission(false)
    .setDescription("Permanently ban a user from the server.")
    .addUserOption(o => o.setName("user").setDescription("The user to ban.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for the ban.").setRequired(false).setMaxLength(512))
    .addStringOption(o => o.setName("severity").setDescription("Severity level for the mod log.").setRequired(false)
      .addChoices(
        { name: "<:error:1555544434601369620> Low",      value: "low"      },
        { name: "<:error:1555544434601369620> Medium",   value: "medium"   },
        { name: "<:LEred:1555544262123323422> High",     value: "high"     },
        { name: "<:error:1555544434601369620> Critical", value: "critical" },
      ))
    .addIntegerOption(o => o.setName("delete_days").setDescription("Days of messages to delete (0–7).").setMinValue(0).setMaxValue(7).setRequired(false))
    .addBooleanOption(o => o.setName("silent").setDescription("Send silently (only visible to you).").setRequired(false))
    .addBooleanOption(o => o.setName("dm_user").setDescription("DM the user a notification (default: yes).").setRequired(false)),

  async execute(interaction, client) {
    try {
      const targetUser   = interaction.options.getUser("user");
      const targetMember = interaction.options.getMember("user");
      const reason       = interaction.options.getString("reason")    || "No reason provided";
      const severity     = interaction.options.getString("severity")  || "medium";
      const deleteDays   = interaction.options.getInteger("delete_days") ?? 0;
      const isSilent     = interaction.options.getBoolean("silent")   ?? false;
      const sendDm       = interaction.options.getBoolean("dm_user")  ?? true;
      const caseNum      = generateCase();
      const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
        ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

      const ephErr = (title, body) => interaction.reply({
        components: [errorContainer(title, body, { clientId: client.user.id })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return ephErr("Permission Denied", "You need the **Ban Members** permission to use this command.");
      if (interaction.user.id === targetUser.id)
        return ephErr("Invalid Target", "You cannot ban yourself.");
      if (targetUser.id === interaction.guild.ownerId)
        return ephErr("Invalid Target", "You cannot ban the server owner.");
      if (!targetMember)
        return ephErr("User Not Found", "That user is not a member of this server. Use `/unban` to lift existing bans by ID.");

      const botMember = interaction.guild.members.me;
      if (!targetMember.bannable || botMember?.roles.highest.position <= targetMember.roles.highest.position)
        return ephErr("Hierarchy Error", "I cannot ban this user — they may have a higher or equal role to me.");
      if (interaction.member.id !== interaction.guild.ownerId &&
          interaction.member.roles.highest.position <= targetMember.roles.highest.position)
        return ephErr("Hierarchy Error", "You cannot ban this user — they have an equal or higher role than you.");

      // DM notification
      let dmSent = false;
      if (sendDm) {
        try {
          const dmBox = new ContainerBuilder().setAccentColor(ACCENT.error)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:ban:1555544356352430202>  You have been banned"))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              `**Server** — ${interaction.guild.name}\n**Banned by** — ${interaction.user.tag}\n**Reason** — ${reason}\n**Case** — ${caseNum}`
            ))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
              "-# You may appeal this ban by contacting a server administrator."
            ));
          await targetUser.send({ components: [dmBox], flags: MessageFlags.IsComponentsV2 });
          dmSent = true;
        } catch {}
      }

      await interaction.guild.members.ban(targetUser.id, {
        reason: `[${caseNum}] Banned by ${interaction.user.tag} | ${reason}`,
        deleteMessageSeconds: deleteDays * 86400,
      });

      const severityEmoji = { low: "<:error:1555544434601369620>", medium: "<:error:1555544434601369620>", high: "<:LEred:1555544262123323422>", critical: "<:error:1555544434601369620>" };

      const container = modActionContainer("<:ban:1555544356352430202>", "Ban Executed",
        `${targetUser.tag} (\`${targetUser.id}\`)`, reason, {
          accent, clientId: client.user.id,
          extra: `**Moderator** — ${interaction.user.tag}\n**Case** — ${caseNum}\n**Severity** — ${severityEmoji[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}\n**Messages Deleted** — ${deleteDays > 0 ? `${deleteDays} day(s)` : "None"}\n**DM Sent** — ${dmSent ? "<a:tickyy:1555544712687915008> Yes" : "<:crossy:1555544390221562048> No"}`,
          footer: `${interaction.guild.name} • ${new Date().toLocaleString()}`,
        });

      return interaction.reply({
        components: [container],
        flags: (isSilent ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      console.error("Error in ban command:", err);
      return interaction.reply({
        components: [errorContainer("Error", `An unexpected error occurred: \`${err.message}\``)],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      }).catch(() => {});
    }
  },
};
