const {
  SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nick").setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .setDescription("Change or reset a member's nickname.")
    .addSubcommand(s => s.setName("set").setDescription("Set a member's nickname.")
      .addUserOption(o => o.setName("user").setDescription("The member.").setRequired(true))
      .addStringOption(o => o.setName("nickname").setDescription("The new nickname (max 32 characters).").setMaxLength(32).setRequired(true)))
    .addSubcommand(s => s.setName("reset").setDescription("Reset a member's nickname back to their username.")
      .addUserOption(o => o.setName("user").setDescription("The member.").setRequired(true))),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const target = interaction.options.getUser("user");
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.info;

    const ephErr = (t, b) => interaction.reply({
      components: [errorContainer(t, b, { clientId: client.user.id })], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!member) return ephErr("User Not Found", "That user is not in this server.");
    if (!member.manageable) return ephErr("Hierarchy Error", "I cannot manage that member's nickname due to role hierarchy.");

    if (sub === "set") {
      const newNick = interaction.options.getString("nickname");
      const oldNick = member.nickname || target.username;
      await member.setNickname(newNick, `Changed by ${interaction.user.tag}`);
      return interaction.reply({
        components: [successContainer("<:files:1555544445565407352>  Nickname Changed",
          `**${target.tag}**'s nickname has been updated.`, {
            accent, clientId: client.user.id,
            extra: `**Before** — \`${oldNick}\`\n**After** — \`${newNick}\`\n**Changed by** — ${interaction.user.tag}`,
          })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "reset") {
      const oldNick = member.nickname || target.username;
      await member.setNickname(null, `Reset by ${interaction.user.tag}`);
      return interaction.reply({
        components: [successContainer("<:files:1555544445565407352>  Nickname Reset",
          `**${target.tag}**'s nickname has been reset.`, {
            accent, clientId: client.user.id,
            extra: `**Was** — \`${oldNick}\`\n**Reset by** — ${interaction.user.tag}`,
          })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
