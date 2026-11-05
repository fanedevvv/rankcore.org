const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('massrole')
        .setDescription('Add or remove a role from all server members (Premium Only)')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to add or remove')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Add or remove the role')
                .setRequired(true)
                .addChoices(
                    { name: 'Add', value: 'add' },
                    { name: 'Remove', value: 'remove' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    premium: true,
    premiumTier: 'basic',

    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const action = interaction.options.getString('action');

        if (!role.editable) {
            return interaction.reply({ content: 'I cannot manage that role due to permission hierarchy.', ephemeral: true });
        }

        await interaction.reply(`Starting to ${action} the role <@&${role.id}> for all members...`);

        const members = await interaction.guild.members.fetch();
        let successCount = 0;
        let failCount = 0;

        for (const member of members.values()) {
            try {
                if (action === 'add') {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                        successCount++;
                    }
                } else if (action === 'remove') {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        successCount++;
                    }
                }
            } catch (error) {
                failCount++;
                console.error(`Failed to ${action} role for ${member.user.tag}:`, error);
            }
        }

        await interaction.followUp({
            content: `Finished! <a:tickyy:1567797045253644368> **${successCount}** members updated. <:crossy:1567796959648030831> **${failCount}** failed.`,
            ephemeral: true
        });
    }
};
