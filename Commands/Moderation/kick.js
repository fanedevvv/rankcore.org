const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require("discord.js");
const { modActionContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");
const { generateCase } = require("./_modUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick").setDMPermission(false)
    .setDescription("Kick a member from the server.")
    .addUserOption(o => o.setName("user").setDescription("The user to kick.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for the kick.").setRequired(false).setMaxLength(512))
    .addStringOption(o => o.setName("severity").setDescription("Severity level for the mod log.").setRequired(false)
      .addChoices(
        { name: "<:error:1555544434601369620> Low",      value: "low"    },
        { name: "<:error:1555544434601369620> Medium",   value: "medium" },
        { name: "<:LEred:1555544262123323422> High",     value: "high"   },
      ))
    .addBooleanOption(o => o.setName("silent").setDescription("Send silently (only visible to you).").setRequired(false))
    .addBooleanOption(o => o.setName("dm_user").setDescription("DM the user a notification (default: yes).").setRequired(false)),

  async execute(interaction, client) {
    const targetUser   = interaction.options.getUser("user");
    const targetMember = interaction.options.getMember("user");
    const reason       = interaction.options.getString("reason")   || "No reason provided";
    const severity     = interaction.options.getString("severity") || "low";
    const isSilent     = interaction.options.getBoolean("silent")  ?? false;
    const sendDm       = interaction.options.getBoolean("dm_user") ?? true;
    const caseNum      = generateCase();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.moderation;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return ephErr("Permission Denied", "You need the **Kick Members** permission to use this command.");
    if (interaction.user.id === targetUser.id)
      return ephErr("Invalid Target", "You cannot kick yourself.");
    if (targetUser.id === interaction.guild.ownerId)
      return ephErr("Invalid Target", "You cannot kick the server owner.");
    if (!targetMember)
      return ephErr("User Not Found", "That user is not a member of this server.");
    if (!targetMember.kickable)
      return ephErr("Hierarchy Error", "I cannot kick this user — check my role position.");
    if (interaction.member.id !== interaction.guild.ownerId &&
        interaction.member.roles.highest.position <= targetMember.roles.highest.position)
      return ephErr("Hierarchy Error", "You cannot kick this user — they have an equal or higher role than you.");

    let dmSent = false;
    if (sendDm) {
      try {
        const dmBox = new ContainerBuilder().setAccentColor(ACCENT.warning)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <:ban:1555544356352430202>  You have been kicked"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**Server** — ${interaction.guild.name}\n**Kicked by** — ${interaction.user.tag}\n**Reason** — ${reason}\n**Case** — ${caseNum}`
          ))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# You can rejoin the server unless further action is taken."));
        await targetUser.send({ components: [dmBox], flags: MessageFlags.IsComponentsV2 });
        dmSent = true;
      } catch {}
    }

    await targetMember.kick(`[${caseNum}] Kicked by ${interaction.user.tag} | ${reason}`);

    const severityEmoji = { low: "<:error:1555544434601369620>", medium: "<:error:1555544434601369620>", high: "<:LEred:1555544262123323422>" };

    return interaction.reply({
      components: [modActionContainer("<:ban:1555544356352430202>", "Kick Executed",
        `${targetUser.tag} (\`${targetUser.id}\`)`, reason, {
          accent, clientId: client.user.id,
          extra: `**Moderator** — ${interaction.user.tag}\n**Case** — ${caseNum}\n**Severity** — ${severityEmoji[severity] || "<:error:1555544434601369620>"} ${severity.charAt(0).toUpperCase() + severity.slice(1)}\n**DM Sent** — ${dmSent ? "<a:tickyy:1555544712687915008> Yes" : "<:crossy:1555544390221562048> No"}`,
          footer: `${interaction.guild.name} • ${new Date().toLocaleString()}`,
        })],
      flags: (isSilent ? MessageFlags.Ephemeral : 0) | MessageFlags.IsComponentsV2,
    });
  },
};
