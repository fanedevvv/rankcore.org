const { EmbedBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const adoptionSchema = require("../../../Schemas/adoptionSchema");
const { parseDuration } = require("./helpers");

module.exports = {
  async execute(interaction, client) {
    const parent = interaction.user;
    const child = interaction.options.getMember("child");
    const role = interaction.options.getRole("role");
    const durationString = interaction.options.getString("duration");
    const guild = interaction.guild;

    if (!guild)
      return interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });

    const adoptionData = await adoptionSchema.findOne({ parent: parent.id, child: child.id });
    if (!adoptionData)
      return interaction.reply({ content: `${child} is not your adopted child!`, flags: MessageFlags.Ephemeral });

    const durationMs = parseDuration(durationString);
    if (!durationMs || durationMs <= 0)
      return interaction.reply({ content: "Invalid duration format. Use formats like `1h30m` or `5m`.", flags: MessageFlags.Ephemeral });

    if (durationMs > 24 * 60 * 60 * 1000)
      return interaction.reply({ content: "The maximum role duration is 24 hours.", flags: MessageFlags.Ephemeral });

    const botMember = await guild.members.fetch(client.user.id);

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles))
      return interaction.reply({ content: "I do not have the 'Manage Roles' permission to perform this action.", flags: MessageFlags.Ephemeral });

    if (role.position >= botMember.roles.highest.position)
      return interaction.reply({ content: `I cannot assign the role **${role.name}** because it is higher than or equal to my highest role.`, flags: MessageFlags.Ephemeral });

    if (role.managed)
      return interaction.reply({ content: `The role **${role.name}** is a managed integration role and cannot be assigned.`, flags: MessageFlags.Ephemeral });

    try {
      await child.roles.add(role.id, `Given by parent ${parent.tag} via /family setrole`);

      const removeAt = new Date(Date.now() + durationMs);
      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle("Role Assigned <:1430986209995526274:1555544172302307449>")
        .setDescription(`${parent} gave **${role.name}** to ${child} for **${durationString}**! It will be removed <t:${Math.floor(removeAt.getTime() / 1000)}:R>.`);

      await interaction.reply({ embeds: [embed] });

      // Role removal — replace with a proper scheduler in production
      setTimeout(async () => {
        const updatedChild = await guild.members.fetch(child.id).catch(() => null);
        if (updatedChild && updatedChild.roles.cache.has(role.id)) {
          await updatedChild.roles.remove(role.id, "Role duration ended.");
        }
      }, durationMs);

    } catch (error) {
      console.error("Error setting role:", error);
      return interaction.reply({ content: "An error occurred while trying to assign the role. Check role hierarchy and permissions.", flags: MessageFlags.Ephemeral });
    }
  },
};