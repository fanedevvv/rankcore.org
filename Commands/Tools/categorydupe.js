const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    PermissionsBitField,
    parseEmoji
} = require("discord.js");

const activeProcesses = new Map();
const COOLDOWN_SECONDS = 15;
const cooldowns = new Map();

const securityTips = [
    "<:restrict:1567797003638022166> Limit roles with 'Administrator' or 'Manage Server' to trusted individuals.",
    "<:restrict:1567797003638022166> NEVER grant 'Manage Roles' to unvetted users or public bots.",
    "<:restrict:1567797003638022166> Ensure your bot's role is lower than the roles it manages.",
    "<:error:1567796968758050868> Use 'None' overwrites carefully; they revert to parent permissions.",
    "<:1430986244921495654:1567796929587576852> Enable 2FA for all moderator/admin accounts.",
    "<:1430986225493479485:1567796921681055824> Be cautious with invite links from unverified users.",
    "<:n_utils:1567796996830658573> Apply permissions to categories first, then use 'None' on channels to inherit."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dupecategory")
        .setDescription("Duplicate a category once along with its permissions, but without duplicating child channels.")
        .addChannelOption(option => option
            .setName("category")
            .setDescription("Select the category to duplicate")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const category = interaction.options.getChannel("category");
        const botMember = interaction.guild.members.me;

        if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: "Please select a valid category.", ephemeral: true });
        }

        if (activeProcesses.has(guildId)) {
            return interaction.reply({ content: "Another category duplication is already running in this server.", ephemeral: true });
        }

        if (cooldowns.has(userId) && Date.now() < cooldowns.get(userId)) {
            const timeLeft = Math.ceil((cooldowns.get(userId) - Date.now()) / 1000);
            return interaction.reply({ content: `Please wait ${timeLeft} seconds before using this command again.`, ephemeral: true });
        }

        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: "I need MANAGE_CHANNELS permission to duplicate categories.", ephemeral: true });
        }

        cooldowns.set(userId, Date.now() + COOLDOWN_SECONDS * 1000);
        activeProcesses.set(guildId, { executorId: userId });

        const securityTip = securityTips[Math.floor(Math.random() * securityTips.length)];
        const confirmEmbed = new EmbedBuilder()
            .setTitle(`<:files:1567796970964394044> Duplicate Category: ${category.name}`)
            .setDescription(`Do you want to duplicate this category's structure and permissions? **No child channels will be duplicated.**`)
            .setFooter({ text: securityTip })
            .setColor("Blue");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_dupe").setLabel("Confirm").setEmoji(parseEmoji('<a:tickyy:1567797045253644368>')).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("cancel_dupe").setLabel("Cancel").setEmoji(parseEmoji('<:restrict:1567797003638022166>')).setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });

        const filter = i => i.user.id === userId && ["confirm_dupe", "cancel_dupe"].includes(i.customId);
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

        collector.on("collect", async i => {
            await i.deferUpdate();
            let newCategory; // Define outside try block for scope
            
            if (i.customId === "cancel_dupe") {
                collector.stop("canceled");
                return;
            }

            try {
                // Duplicate category permission overwrites
                const overwrites = category.permissionOverwrites.cache.map(over => {
                    const obj = { id: over.id, type: over.type };

                    // Only include allow/deny bitfields if they are not 0n (zero BigInt)
                    if (over.allow.bitfield !== 0n) {
                        obj.allow = over.allow.bitfield;
                    }

                    if (over.deny.bitfield !== 0n) {
                        obj.deny = over.deny.bitfield;
                    }

                    return obj;
                });

                // Create the new category
                newCategory = await interaction.guild.channels.create({
                    name: `${category.name} - copy`,
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: overwrites,
                    reason: `Duplicated by ${interaction.user.tag} (Category Only)`
                });

                // NOTE: The loop to duplicate child channels has been removed here.

                collector.stop("success");
            } catch (err) {
                console.error(err);
                collector.stop("error");
            }
        });

        collector.on("end", async (collected, reason) => {
            activeProcesses.delete(guildId);
            
            let newCategory;
            // Attempt to get the new category from collected data if necessary, though it's safer to rely on the 'success' logic below.

            if (reason === "success") {
                // If success, attempt to get the newly created channel object (requires fetching it or making sure it was passed via collector state, 
                // but since it's defined inside 'collect' scope, we'll simplify the message here)
                await interaction.editReply({ content: `<a:tickyy:1567797045253644368> Category duplicated successfully! A new category named **${category.name} - copy** was created.`, embeds: [], components: [] }).catch(console.error);
            } else if (reason === "canceled") {
                await interaction.editReply({ content: `<:restrict:1567797003638022166> Category duplication canceled.`, embeds: [], components: [] }).catch(console.error);
            } else if (reason === "error") {
                await interaction.editReply({ content: `<:crossy:1567796959648030831> An unexpected error occurred while duplicating the category.`, embeds: [], components: [] }).catch(console.error);
            } else {
                 await interaction.editReply({ content: `<:crossy:1567796959648030831> Failed to duplicate category. Confirmation timed out.`, embeds: [], components: [] }).catch(console.error);
            }
        });
    }
};