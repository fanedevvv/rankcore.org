const {
  SlashCommandBuilder, PermissionsBitField, MessageFlags,
} = require("discord.js");
const { successContainer, errorContainer, ACCENT } = require("../../Utils/v2helpers");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("role").setDMPermission(false)
    .setDescription("Manage member roles.")
    .addSubcommand(s => s.setName("add").setDescription("Add a role to a member.")
      .addUserOption(o => o.setName("user").setDescription("Target member.").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role to add.").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Remove a role from a member.")
      .addUserOption(o => o.setName("user").setDescription("Target member.").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role to remove.").setRequired(true)))
    .addSubcommand(s => s.setName("members").setDescription("Show how many members have a role.")
      .addRoleOption(o => o.setName("role").setDescription("The role to check.").setRequired(true))),

  async execute(interaction, client) {
    const sub    = interaction.options.getSubcommand();
    const accent = typeof client.config?.embedColor === "string" && client.config.embedColor.startsWith("#")
      ? parseInt(client.config.embedColor.slice(1), 16) : ACCENT.info;

    const ephErr = (t, b) => interaction.reply({
      components: [errorContainer(t, b, { clientId: client.user.id })], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return ephErr("Permission Denied", "You need the **Manage Roles** permission.");

    if (sub === "add") {
      const user   = interaction.options.getUser("user");
      const role   = interaction.options.getRole("role");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return ephErr("Not Found", "That user is not in this server.");
      if (role.managed) return ephErr("Managed Role", "Bot-managed roles cannot be assigned manually.");
      if (role.position >= interaction.guild.members.me.roles.highest.position)
        return ephErr("Hierarchy Error", "That role is higher than my highest role.");
      if (member.roles.cache.has(role.id))
        return ephErr("Already Has Role", `${user.tag} already has ${role}.`);
      await member.roles.add(role, `Role added by ${interaction.user.tag}`);
      return interaction.reply({
        components: [successContainer("<:minigames:1567796978929238076>  Role Added", `${role} has been added to **${user.tag}**.`, { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "remove") {
      const user   = interaction.options.getUser("user");
      const role   = interaction.options.getRole("role");
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return ephErr("Not Found", "That user is not in this server.");
      if (!member.roles.cache.has(role.id))
        return ephErr("Role Not Found", `${user.tag} does not have ${role}.`);
      await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);
      return interaction.reply({
        components: [successContainer("<:minigames:1567796978929238076>  Role Removed", `${role} has been removed from **${user.tag}**.`, { accent, clientId: client.user.id })],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "members") {
      const role = interaction.options.getRole("role");
      await interaction.guild.members.fetch();
      const count = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
      return interaction.reply({
        components: [successContainer("<:minigames:1567796978929238076>  Role Members", `**${role.name}** has **${count}** member(s).`, {
          accent, clientId: client.user.id,
          extra: `**Role** — ${role}\n**Color** — \`${role.hexColor}\`\n**Hoisted** — ${role.hoist ? "Yes" : "No"}\n**Position** — ${role.position}`,
        })],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
