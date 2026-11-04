const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
} = require("discord.js");
const { modActionContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDescription("Unban a member from the server.")
    .addStringOption(o => o.setName("id").setDescription("The user ID to unban.").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for the unban.").setMaxLength(512).setRequired(false)),

  async execute(interaction, client) {
    const reason   = interaction.options.getString("reason") || "No reason provided";
    const targetId = interaction.options.getString("id");
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.success;

    const ephErr = (title, body) => interaction.reply({
      components: [errorContainer(title, body, { clientId: client.user.id })],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    try {
      await interaction.guild.members.unban(targetId, reason);

      // Attempt DM notification
      try {
        const user = await client.users.fetch(targetId);
        const dmBox = new ContainerBuilder().setAccentColor(accent)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent("## <a:tickyy:1555544712687915008>  You have been unbanned"))
          .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**Server** — ${interaction.guild.name}\n**Reason** — ${reason}\n\nYou may now rejoin the server.`
          ));
        await user.send({ components: [dmBox], flags: MessageFlags.IsComponentsV2 });
      } catch {}

      return interaction.reply({
        components: [modActionContainer("<a:tickyy:1555544712687915008>", "Unban Executed",
          `<@${targetId}> (\`${targetId}\`)`, reason, {
            accent, clientId: client.user.id,
            extra: `**Moderator** — ${interaction.user.tag}`,
            footer: `Executed in ${interaction.guild.name} • ${new Date().toLocaleString()}`,
          })],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      if (err.code === 50013) return ephErr("Permission Error", "I do not have permission to unban this user.");
      if (err.code === 10026) return ephErr("Not Banned", "That user ID is not valid or the user is not banned.");
      return ephErr("Error", `An error occurred: ${err.message}`);
    }
  },
};
