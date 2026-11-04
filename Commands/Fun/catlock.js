"use strict";

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const catSchema = require("../../Schemas/catschema");
const uwuSchema = require("../../Schemas/uwuschema");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("catlock")
        .setDescription("Enable or remove CatLock mode — turns someone into a cat 🐱")
        .addSubcommand(sub =>
            sub.setName("set")
                .setDescription("Enable CatLock on yourself or someone else")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("Enable CatLock for this user (requires Manage Messages)")
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove CatLock from yourself or someone else")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("Remove CatLock from this user (requires Manage Messages)")
                        .setRequired(false)
                )
        ),

    async execute(interaction, client) {
        const { options, guild } = interaction;
        const sub        = options.getSubcommand();
        const targetUser = options.getUser("user") || interaction.user;

        // Only admins can target others
        if (
            targetUser.id !== interaction.user.id &&
            !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)
        ) {
            return interaction.reply({
                content: `${client.emoji?.error ?? '<:crossy:1555544390221562048>'} | You need **Manage Messages** to cat-lock other users.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        switch (sub) {
            case "set": {
                // Re-query inside the case so we always have a fresh read
                const existing = await catSchema.findOne({ Guild: guild.id, User: targetUser.id }).lean();
                if (existing) {
                    return interaction.reply({
                        content: `${client.emoji?.error ?? '<:crossy:1555544390221562048>'} | ${targetUser.username} is already a cat! 🐱`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                // Block if user is already UwULocked
                const uwuData = await uwuSchema.findOne({ Guild: guild.id, User: targetUser.id }).lean();
                if (uwuData) {
                    return interaction.reply({
                        content: `${client.emoji?.error ?? '<:crossy:1555544390221562048>'} | ${targetUser.username} is already UwULocked! Remove their UwULock first before applying CatLock. UwU`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await catSchema.create({ Guild: guild.id, User: targetUser.id });

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xF4A261)
                            .setTitle("🐱 CatLock Activated!")
                            .setDescription(
                                `**${targetUser.username}** has been turned into a cat.\n` +
                                `All their messages will now be *cattified*. Meow~`
                            )
                            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                            .setFooter({ text: "Use /catlock remove to free them" }),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            case "remove": {
                // Re-query inside the case so we always have a fresh read
                const existing = await catSchema.findOne({ Guild: guild.id, User: targetUser.id }).lean();
                if (!existing) {
                    return interaction.reply({
                        content: `${client.emoji?.error ?? '<:crossy:1555544390221562048>'} | ${targetUser.username} is not currently CatLocked.`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                await catSchema.deleteMany({ Guild: guild.id, User: targetUser.id });

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x57F287)
                            .setDescription(
                                `${client.emoji?.tick ?? '<a:tickyy:1555544712687915008>'} **${targetUser.username}** has been freed from CatLock. They are human again!`
                            ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};