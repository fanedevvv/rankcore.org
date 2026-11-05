const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const uwuSchema = require("../../Schemas/uwuschema");
const catSchema = require("../../Schemas/catschema");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("uwulock")
        .setDescription("Enable or remove UwULock mode")
        .addSubcommand(sub =>
            sub.setName("set")
                .setDescription("Enable UwULock on yourself or someone else")
                .addUserOption(option =>
                    option.setName("user")
                          .setDescription("Enable UwULock for this user (admin only)")
                          .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove UwULock from yourself or someone else")
                .addUserOption(option =>
                    option.setName("user")
                          .setDescription("Remove UwULock from this user (admin only)")
                          .setRequired(false)
                )
        ),

    async execute(interaction, client) {
        const { options, guild } = interaction;
        const sub        = options.getSubcommand();
        const targetUser = options.getUser("user") || interaction.user;

        // Only allow admins to target others
        if (targetUser.id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({
                content: `${client.emoji?.error ?? '<:crossy:1567796959648030831>'} | You don't have permission to enable/remove UwULock for others.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        switch (sub) {
            case "set": {
                // Re-query inside the case so we always have a fresh read
                const existing = await uwuSchema.findOne({ Guild: guild.id, User: targetUser.id }).lean();
                if (existing) {
                    return interaction.reply({
                        content: `${client.emoji?.error ?? '<:crossy:1567796959648030831>'} | ${targetUser.username} is already UwULocked!`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                // Block if user is already CatLocked
                const catData = await catSchema.findOne({ Guild: guild.id, User: targetUser.id }).lean();
                if (catData) {
                    return interaction.reply({
                        content: `${client.emoji?.error ?? '<:crossy:1567796959648030831>'} | ${targetUser.username} is already CatLocked! Remove their CatLock first before applying UwULock. 🐱`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await uwuSchema.create({ Guild: guild.id, User: targetUser.id });

                return interaction.reply({
                    content: `${client.emoji?.tick ?? '<a:tickyy:1567797045253644368>'} ${targetUser.username} is now UwULocked! All their messages will be uwuified.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            case "remove": {
                // Re-query inside the case so we always have a fresh read
                const existing = await uwuSchema.findOne({ Guild: guild.id, User: targetUser.id }).lean();
                if (!existing) {
                    return interaction.reply({
                        content: `${client.emoji?.error ?? '<:crossy:1567796959648030831>'} | ${targetUser.username} is not UwULocked.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await uwuSchema.deleteMany({ Guild: guild.id, User: targetUser.id });

                const embed = new EmbedBuilder()
                    .setColor(client.config?.embedColor ?? 0x5865F2)
                    .setDescription(`${client.emoji?.tick ?? '<a:tickyy:1567797045253644368>'} UwULock has been removed from ${targetUser.username}!`);

                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        }
    },
};