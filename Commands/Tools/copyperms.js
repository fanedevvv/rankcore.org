const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("overridecategory")
        .setDescription("Copy permissions from a channel onto a category.")
        .addChannelOption(option => option
            .setName("category")
            .setDescription("The category whose permissions you want to overwrite.")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption(option => option
            .setName("sourcechannel")
            .setDescription("The text/voice channel you want to copy permissions from.")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice)
            .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),

    async execute(interaction) {
        const category = interaction.options.getChannel("category");
        const source = interaction.options.getChannel("sourcechannel");
        const botMember = interaction.guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: "I need MANAGE_CHANNELS permission to modify category permissions.",
                ephemeral: true
            });
        }

        try {
            const overwrites = source.permissionOverwrites.cache.map(over => {
                const obj = { id: over.id, type: over.type };

                if (over.allow.bitfield !== 0n) obj.allow = over.allow.bitfield;
                if (over.deny.bitfield !== 0n) obj.deny = over.deny.bitfield;

                return obj;
            });

            await category.edit({
                permissionOverwrites: overwrites,
                reason: `Copied from channel ${source.name} by ${interaction.user.tag}`
            });

            const embed = new EmbedBuilder()
                .setTitle("<:n_utils:1555544669545431062> Category Permissions Updated")
                .setDescription(`The category **${category.name}** now has all permissions copied from **${source.name}**.`)
                .setColor("Blue");

            return interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: "<:crossy:1555544390221562048> Failed to override category permissions due to an error.",
                ephemeral: true
            });
        }
    }
};
