const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
} = require("discord.js");
const { modActionContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("untimeout").setDMPermission(false)
    .setDescription("Remove a timeout from a member.")
    .addUserOption(o => o.setName("user").setDescription("The user to untimeout.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for removing the timeout.").setRequired(false)),

  async execute(interaction, client) {
    const targetUser   = interaction.options.getUser("user");
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const reason       = interaction.options.getString("reason") || "No reason provided";
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.success;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return ephErr("Permission Denied", "You need the **Moderate Members** permission to remove timeouts.");
    if (!targetMember)
      return ephErr("User Not Found", "That user is not in this server.");
    if (!targetMember.communicationDisabledUntil)
      return ephErr("Not Timed Out", `**${targetUser.tag}** is not currently timed out.`);

    await targetMember.timeout(null, `Untimeout by ${interaction.user.tag} | ${reason}`);

    return interaction.reply({
      components: [modActionContainer("<:n_music:1567796993403658261>", "Timeout Removed",
        `${targetUser.tag} (\`${targetUser.id}\`)`, reason, {
          accent, clientId: client.user.id,
          extra: `**Moderator** — ${interaction.user.tag}`,
          footer: `Executed in ${interaction.guild.name} • ${new Date().toLocaleString()}`,
        })],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
