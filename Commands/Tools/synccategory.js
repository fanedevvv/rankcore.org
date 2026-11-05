const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("syncpanel")
        .setDescription("Sync channels to their category permissions.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),

    async execute(interaction) {
        const botMember = interaction.guild.members.me;

        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: "<:crossy:1567796959648030831> I need **MANAGE_CHANNELS** permission to sync channels.",
                ephemeral: true
            });
        }

        // Build category list upfront
        const categories = interaction.guild.channels.cache
            .filter(c => c.type === ChannelType.GuildCategory)
            .sort((a, b) => a.position - b.position);

        const categoryOptions = categories.map(cat => {
            const childCount = interaction.guild.channels.cache.filter(
                c => c.parentId === cat.id &&
                    [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)
            ).size;
            return new StringSelectMenuOptionBuilder()
                .setLabel(cat.name)
                .setValue(`cat_${cat.id}`)
                .setDescription(`${childCount} channel${childCount !== 1 ? "s" : ""} inside`);
        });

        const modeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("mode_category")
                .setLabel("By Category")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("📁"),
            new ButtonBuilder()
                .setCustomId("mode_channels")
                .setLabel("Pick Channels")
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("🔍")
        );

        const modeEmbed = new EmbedBuilder()
            .setTitle("🔄 Channel Sync Panel")
            .setColor("Blurple")
            .setDescription(
                "**How would you like to sync?**\n\n" +
                "📁 **By Category** — Sync every channel inside one or more categories at once\n" +
                "🔍 **Pick Channels** — Search & select up to 25 specific channels"
            );

        await interaction.reply({ embeds: [modeEmbed], components: [modeRow], ephemeral: true });

        const message = await interaction.fetchReply();

        // ── Persisted selection state ─────────────────────────────────────────
        // Values are stored here when each SELECT fires, so the BUTTON handler
        // can read them reliably — they are never read from the button's own
        // i.values (buttons don't carry values), which was the original bug.
        let selectedChannels   = [];
        let selectedCategories = [];

        const collector = message.createMessageComponentCollector({ time: 90_000 });

        collector.on("collect", async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "<:crossy:1567796959648030831> You can't use this panel.", ephemeral: true });
            }

            // Defer immediately to prevent the 3-second expiry (error 10062)
            await i.deferUpdate();

            // ── Mode: By Category ─────────────────────────────────────────────
            if (i.customId === "mode_category") {
                if (!categoryOptions.length) {
                    return interaction.editReply({
                        content: "<:crossy:1567796959648030831> This server has no categories.",
                        embeds: [], components: []
                    });
                }

                const catSelect = new StringSelectMenuBuilder()
                    .setCustomId("cat_select")
                    .setPlaceholder("Select one or more categories…")
                    .setMinValues(1)
                    .setMaxValues(Math.min(categoryOptions.length, 25))
                    .addOptions(categoryOptions);

                const catEmbed = new EmbedBuilder()
                    .setTitle("📁 Sync by Category")
                    .setColor("Blurple")
                    .setDescription(
                        "Select one or more categories then press **Sync**.\n" +
                        "All text, voice and stage channels in those categories will be synced to the category's permission overrides."
                    );

                return interaction.editReply({
                    embeds: [catEmbed],
                    components: [
                        new ActionRowBuilder().addComponents(catSelect),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("back_to_mode").setLabel("Back").setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId("sync_cat_button").setLabel("Sync Selected Categories").setStyle(ButtonStyle.Primary)
                        )
                    ]
                });
            }

            // ── Mode: Pick Channels ───────────────────────────────────────────
            if (i.customId === "mode_channels") {
                selectedChannels = [];

                const channelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId("channel_select")
                    .setPlaceholder("Search & select channels…")
                    .setMinValues(1)
                    .setMaxValues(25)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice);

                const chanEmbed = new EmbedBuilder()
                    .setTitle("🔍 Pick Channels to Sync")
                    .setColor("Blurple")
                    .setDescription(
                        "Select up to **25 channels** then press **Sync**.\n" +
                        "Channels not inside a category will be skipped."
                    );

                return interaction.editReply({
                    embeds: [chanEmbed],
                    components: [
                        new ActionRowBuilder().addComponents(channelSelect),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("back_to_mode").setLabel("Back").setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId("sync_channels_button").setLabel("Sync Selected Channels").setStyle(ButtonStyle.Primary)
                        )
                    ]
                });
            }

            // ── Back to mode select ───────────────────────────────────────────
            if (i.customId === "back_to_mode") {
                selectedChannels   = [];
                selectedCategories = [];
                return interaction.editReply({ embeds: [modeEmbed], components: [modeRow] });
            }

            // ── Category select fired — persist selection + show preview ──────
            if (i.customId === "cat_select") {
                selectedCategories = i.values.map(v => v.replace(/^cat_/, ""));

                const channelCount = selectedCategories.reduce((sum, catId) =>
                    sum + interaction.guild.channels.cache.filter(
                        c => c.parentId === catId &&
                            [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)
                    ).size, 0);

                const catNames = selectedCategories
                    .map(id => interaction.guild.channels.cache.get(id)?.name ?? id)
                    .map(n => `**${n}**`).join(", ");

                const previewEmbed = new EmbedBuilder()
                    .setTitle("📁 Sync by Category")
                    .setColor("Blurple")
                    .setDescription(
                        `Selected: ${catNames}\n` +
                        `**${channelCount} channel${channelCount !== 1 ? "s" : ""}** will be synced.\n\n` +
                        "Press **Sync Selected Categories** to proceed."
                    );

                const catSelect = new StringSelectMenuBuilder()
                    .setCustomId("cat_select")
                    .setPlaceholder("Select one or more categories…")
                    .setMinValues(1)
                    .setMaxValues(Math.min(categoryOptions.length, 25))
                    .addOptions(categoryOptions);

                return interaction.editReply({
                    embeds: [previewEmbed],
                    components: [
                        new ActionRowBuilder().addComponents(catSelect),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("back_to_mode").setLabel("Back").setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId("sync_cat_button").setLabel("Sync Selected Categories").setStyle(ButtonStyle.Primary)
                        )
                    ]
                });
            }

            // ── Channel select fired — persist selection + show preview ────────
            if (i.customId === "channel_select") {
                selectedChannels = i.values;

                const withParent = selectedChannels.filter(id => !!interaction.guild.channels.cache.get(id)?.parentId).length;
                const noParent   = selectedChannels.length - withParent;

                const previewEmbed = new EmbedBuilder()
                    .setTitle("🔍 Pick Channels to Sync")
                    .setColor("Blurple")
                    .setDescription(
                        `**${selectedChannels.length}** channel${selectedChannels.length !== 1 ? "s" : ""} selected` +
                        (noParent > 0 ? ` *(${noParent} without a category will be skipped)*` : "") +
                        `\n\nPress **Sync Selected Channels** to proceed.`
                    );

                const channelSelect = new ChannelSelectMenuBuilder()
                    .setCustomId("channel_select")
                    .setPlaceholder("Search & select channels…")
                    .setMinValues(1)
                    .setMaxValues(25)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice);

                return interaction.editReply({
                    embeds: [previewEmbed],
                    components: [
                        new ActionRowBuilder().addComponents(channelSelect),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId("back_to_mode").setLabel("Back").setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId("sync_channels_button").setLabel("Sync Selected Channels").setStyle(ButtonStyle.Primary)
                        )
                    ]
                });
            }

            // ── Sync categories button ────────────────────────────────────────
            if (i.customId === "sync_cat_button") {
                if (!selectedCategories.length) {
                    collector.stop("done");
                    return interaction.editReply({ content: "<:crossy:1567796959648030831> No categories selected.", embeds: [], components: [] });
                }

                let synced = 0, skipped = 0;

                for (const catId of selectedCategories) {
                    const children = interaction.guild.channels.cache.filter(
                        c => c.parentId === catId &&
                            [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)
                    );
                    for (const [, channel] of children) {
                        try { await channel.lockPermissions(); synced++; }
                        catch { skipped++; }
                    }
                }

                const catNames = selectedCategories
                    .map(id => interaction.guild.channels.cache.get(id)?.name ?? id)
                    .map(n => `\`${n}\``).join(", ");

                const resultEmbed = new EmbedBuilder()
                    .setTitle("<a:tickyy:1567797045253644368> Sync Complete")
                    .setColor("Green")
                    .setDescription(
                        `**Categories:** ${catNames}\n\n` +
                        `**Synced:** ${synced}\n**Skipped:** ${skipped}\n\n` +
                        "All valid channels were synced to their category permissions."
                    )
                    .setTimestamp();

                collector.stop("done");
                return interaction.editReply({ embeds: [resultEmbed], components: [] });
            }

            // ── Sync channels button ──────────────────────────────────────────
            if (i.customId === "sync_channels_button") {
                if (!selectedChannels.length) {
                    collector.stop("done");
                    return interaction.editReply({ content: "<:crossy:1567796959648030831> No channels selected.", embeds: [], components: [] });
                }

                let synced = 0, skipped = 0;

                for (const id of selectedChannels) {
                    const channel = interaction.guild.channels.cache.get(id);
                    if (!channel?.parentId) { skipped++; continue; }
                    try { await channel.lockPermissions(); synced++; }
                    catch { skipped++; }
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle("<a:tickyy:1567797045253644368> Sync Complete")
                    .setColor("Green")
                    .setDescription(
                        `**Synced:** ${synced}\n**Skipped:** ${skipped}\n\n` +
                        "All valid channels were synced to their category permissions."
                    )
                    .setTimestamp();

                collector.stop("done");
                return interaction.editReply({ embeds: [resultEmbed], components: [] });
            }
        });

        collector.on("end", (_, reason) => {
            if (reason !== "done") {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });
    }
};
