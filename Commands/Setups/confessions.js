"use strict";
const { dashboardRedirect } = require("./_dashboardRedirect");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const confessionConfig = require("../../Schemas/confession");
const {
    postConfession,
    sendToReview,
    checkCooldown,
    validateConfession,
    containsBlockedWord,
} = require("../../Utils/confessionUtils");

// All setup logic has been moved to the RankCore Dashboard.
// User-facing subcommands (send, stats, blacklist, trusted) are handled here.

module.exports = {
  data: new SlashCommandBuilder()
        .setName('confession')
        .setDescription('Anonymous confession system')
        .setDMPermission(false)

        // ── Send ──────────────────────────────────────────────────────────
        .addSubcommand(sub => sub
            .setName('send')
            .setDescription('Send an anonymous confession')
            .addStringOption(opt => opt.setName('text').setDescription('Your confession').setRequired(true).setMaxLength(4000)))

        // ── Setup ─────────────────────────────────────────────────────────
        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('Quick-setup the confession system')
            .addChannelOption(opt => opt.setName('confess_channel').setDescription('Channel for public confessions').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addChannelOption(opt => opt.setName('review_channel').setDescription('Review channel (optional)').addChannelTypes(ChannelType.GuildText))
            .addChannelOption(opt => opt.setName('log_channel').setDescription('Mod log channel (optional)').addChannelTypes(ChannelType.GuildText)))

        // ── Stats ─────────────────────────────────────────────────────────
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('Show confession system statistics'))

        // ── Blacklist ─────────────────────────────────────────────────────
        .addSubcommand(sub => sub
            .setName('blacklist')
            .setDescription('Add or remove a user from the confession blacklist')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .addBooleanOption(opt => opt.setName('add').setDescription('true = add, false = remove').setRequired(true)))

        // ── Trusted ───────────────────────────────────────────────────────
        .addSubcommand(sub => sub
            .setName('trusted')
            .setDescription('Add or remove a trusted user (bypasses review & cooldown)')
            .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
            .addBooleanOption(opt => opt.setName('add').setDescription('true = add, false = remove').setRequired(true)))

        // ── Config group ──────────────────────────────────────────────────
        .addSubcommandGroup(group => group
            .setName('config')
            .setDescription('Configure the confession system')

            .addSubcommand(sub => sub.setName('channels')
                .setDescription('Set confession, review, and log channels')
                .addChannelOption(opt => opt.setName('confess_channel').setDescription('Confession channel').addChannelTypes(ChannelType.GuildText))
                .addChannelOption(opt => opt.setName('review_channel').setDescription('Review channel').addChannelTypes(ChannelType.GuildText))
                .addChannelOption(opt => opt.setName('log_channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText)))

            .addSubcommand(sub => sub.setName('review')
                .setDescription('Configure review mode')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable review mode').setRequired(true))
                .addBooleanOption(opt => opt.setName('anonymous').setDescription('Hide submitter from reviewer'))
                .addIntegerOption(opt => opt.setName('auto_approve_minutes').setDescription('Auto-approve after N minutes (0 = off)').setMinValue(0).setMaxValue(10080)))

            .addSubcommand(sub => sub.setName('cooldown')
                .setDescription('Set per-user confession cooldown')
                .addIntegerOption(opt => opt.setName('seconds').setDescription('Cooldown in seconds (min 5)').setRequired(true).setMinValue(5).setMaxValue(86400)))

            .addSubcommand(sub => sub.setName('length')
                .setDescription('Set confession length limits')
                .addIntegerOption(opt => opt.setName('min').setDescription('Minimum characters').setMinValue(1).setMaxValue(500))
                .addIntegerOption(opt => opt.setName('max').setDescription('Maximum characters').setMinValue(10).setMaxValue(4000)))

            .addSubcommand(sub => sub.setName('embed')
                .setDescription('Customise the confession embed appearance')
                .addStringOption(opt => opt.setName('title').setDescription('Embed title').setMaxLength(256))
                .addStringOption(opt => opt.setName('color').setDescription('Embed hex colour e.g. #5865F2').setMaxLength(7))
                .addStringOption(opt => opt.setName('footer').setDescription('Embed footer text').setMaxLength(2048))
                .addBooleanOption(opt => opt.setName('show_number').setDescription('Show confession number in title')))

            .addSubcommand(sub => sub.setName('reactions')
                .setDescription('Configure auto-reactions on confessions')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable auto-reactions').setRequired(true))
                .addStringOption(opt => opt.setName('emojis').setDescription('Comma-separated emoji list e.g. <:Red_Heart:1567796949271191642>,😂,😮').setMaxLength(200)))

            .addSubcommand(sub => sub.setName('threads')
                .setDescription('Toggle automatic reply threads on confessions')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable auto-threads').setRequired(true)))

            .addSubcommand(sub => sub.setName('dm_notifications')
                .setDescription('DM submitters when their confession is approved or denied')
                .addBooleanOption(opt => opt.setName('on_approve').setDescription('DM on approval'))
                .addBooleanOption(opt => opt.setName('on_deny').setDescription('DM on denial')))

            .addSubcommand(sub => sub.setName('ping_roles')
                .setDescription('Set ping roles for review submissions and public posts')
                .addRoleOption(opt => opt.setName('review_ping').setDescription('Role to ping on new submission'))
                .addRoleOption(opt => opt.setName('confession_ping').setDescription('Role to ping when confession posts')))

            .addSubcommand(sub => sub.setName('required_roles')
                .setDescription('Require users to have a role to confess (comma-sep role IDs, blank = anyone)')
                .addStringOption(opt => opt.setName('role_ids').setDescription('Comma-separated role IDs (blank to clear)').setRequired(true)))

            .addSubcommand(sub => sub.setName('modroles')
                .setDescription('Add or remove a moderator role')
                .addRoleOption(opt => opt.setName('role').setDescription('Role').setRequired(true))
                .addBooleanOption(opt => opt.setName('add').setDescription('true = add, false = remove').setRequired(true)))

            .addSubcommand(sub => sub.setName('showsettings')
                .setDescription('Show full current configuration')))

        // ── Word filter group ─────────────────────────────────────────────
        .addSubcommandGroup(group => group
            .setName('filter')
            .setDescription('Manage the confession word filter')

            .addSubcommand(sub => sub.setName('toggle')
                .setDescription('Enable or disable the word filter')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable/disable').setRequired(true))
                .addStringOption(opt => opt.setName('action').setDescription('block = reject; review = send to review').addChoices(
                    { name: 'Block (reject)', value: 'block' },
                    { name: 'Send to review', value: 'review' },
                )))

            .addSubcommand(sub => sub.setName('add')
                .setDescription('Add words to the block list')
                .addStringOption(opt => opt.setName('words').setDescription('Comma-separated words/phrases').setRequired(true)))

            .addSubcommand(sub => sub.setName('remove')
                .setDescription('Remove a word from the block list')
                .addStringOption(opt => opt.setName('word').setDescription('Exact word to remove').setRequired(true)))

            .addSubcommand(sub => sub.setName('list')
                .setDescription('Show all blocked words')))

        // ── Categories group ──────────────────────────────────────────────
        .addSubcommandGroup(group => group
            .setName('categories')
            .setDescription('Manage confession categories')

            .addSubcommand(sub => sub.setName('toggle')
                .setDescription('Enable or disable categories')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable/disable').setRequired(true)))

            .addSubcommand(sub => sub.setName('add')
                .setDescription('Add a confession category')
                .addStringOption(opt => opt.setName('label').setDescription('Category name').setRequired(true).setMaxLength(50))
                .addStringOption(opt => opt.setName('emoji').setDescription('Category emoji').setMaxLength(10))
                .addChannelOption(opt => opt.setName('channel').setDescription('Override channel (optional)').addChannelTypes(ChannelType.GuildText)))

            .addSubcommand(sub => sub.setName('remove')
                .setDescription('Remove a confession category')
                .addStringOption(opt => opt.setName('label').setDescription('Category label to remove').setRequired(true)))

            .addSubcommand(sub => sub.setName('list')
                .setDescription('List all categories'))),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const subgroup = interaction.options.getSubcommandGroup(false);

    // ── User-facing subcommands handled directly ─────────────────────────
    if (sub === 'send') return handleSend(interaction, client);
    if (sub === 'stats') return handleStats(interaction, client);
    if (sub === 'blacklist') return handleBlacklist(interaction, client);
    if (sub === 'trusted') return handleTrusted(interaction, client);

    // ── All setup/config subcommands redirect to dashboard ───────────────
    return dashboardRedirect(interaction, "Confessions", "confession");
  },
};

// ── Handle /confession send ────────────────────────────────────────────────
async function handleSend(interaction, client) {
    const config = await confessionConfig.findOne({ Guild: interaction.guild.id });
    if (!config) {
        return interaction.reply({
            content: '<:crossy:1567796959648030831> Confessions are not set up in this server. An admin can configure them via the dashboard.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const text = interaction.options.getString('text').trim();
    const userId = interaction.user.id;

    const validationError = validateConfession(text, config, userId);
    if (validationError) {
        return interaction.reply({ content: `<:crossy:1567796959648030831> ${validationError}`, flags: MessageFlags.Ephemeral });
    }

    if (config.RequiredRoles?.length > 0) {
        const hasRequired = config.RequiredRoles.some(id => interaction.member.roles.cache.has(id));
        if (!hasRequired) {
            return interaction.reply({ content: '<:crossy:1567796959648030831> You do not have the required role to submit confessions.', flags: MessageFlags.Ephemeral });
        }
    }

    const isTrusted = config.TrustedUsers?.includes(userId);

    if (!isTrusted) {
        const cdLeft = checkCooldown(userId, config);
        if (cdLeft) {
            return interaction.reply({ content: `<:n_loading:1567796992556666982> Please wait **${cdLeft}s** before sending another confession.`, flags: MessageFlags.Ephemeral });
        }
    }

    if (config.WordFilterEnabled && containsBlockedWord(text, config.BlockedWords)) {
        config.TotalFiltered = (config.TotalFiltered || 0) + 1;
        await config.save();

        interaction.client.emit('confessionLog', interaction.guild, config, 'WORD FILTER TRIGGERED',
            `Confession blocked from user ID \`${userId}\`.`
        );

        if (config.FilterAction === 'review') {
            await sendToReview(interaction, text, config, { userId });
            return interaction.reply({ content: '<:announcement:1567796950265241662> Your confession was sent for moderator review.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ content: '<:restrict:1567797003638022166> Your confession contains prohibited content and was not submitted.', flags: MessageFlags.Ephemeral });
    }

    if (config.ReviewEnabled && config.ReviewChannel && !isTrusted) {
        await sendToReview(interaction, text, config, { userId });
        return interaction.reply({ content: '<:announcement:1567796950265241662> Your confession was sent for moderator review.', flags: MessageFlags.Ephemeral });
    }

    await postConfession(interaction, text, { userId });
    return interaction.reply({ content: '<a:tickyy:1567797045253644368> Your confession has been submitted successfully!', flags: MessageFlags.Ephemeral });
}

// ── Handle /confession stats ───────────────────────────────────────────────
async function handleStats(interaction, client) {
    const config = await confessionConfig.findOne({ Guild: interaction.guild.id });
    if (!config) {
        return interaction.reply({ content: '<:crossy:1567796959648030831> Confessions are not set up in this server.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('<:suggestion:1567797008452812870> Confession Statistics')
        .setColor(config.ConfessionColor || '#5865F2')
        .addFields(
            { name: 'Total Confessions', value: String(config.ConfessionCount || 0), inline: true },
            { name: 'Total Posted', value: String(config.TotalPosted || 0), inline: true },
            { name: 'Total Denied', value: String(config.TotalDenied || 0), inline: true },
            { name: 'Total Filtered', value: String(config.TotalFiltered || 0), inline: true },
            { name: 'Review Enabled', value: config.ReviewEnabled ? '<a:tickyy:1567797045253644368>' : '<:crossy:1567796959648030831>', inline: true },
            { name: 'Cooldown', value: `${config.CooldownSeconds || 60}s`, inline: true },
            { name: 'Blacklisted Users', value: String(config.Blacklist?.length || 0), inline: true },
            { name: 'Trusted Users', value: String(config.TrustedUsers?.length || 0), inline: true },
        )
        .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ── Handle /confession blacklist ───────────────────────────────────────────
async function handleBlacklist(interaction, client) {
    const target = interaction.options.getUser('user');
    const add = interaction.options.getBoolean('add');

    if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ModerateMembers')) {
        return interaction.reply({ content: '<:crossy:1567796959648030831> You need administrator or moderate members permission.', flags: MessageFlags.Ephemeral });
    }

    const config = await confessionConfig.findOne({ Guild: interaction.guild.id });
    if (!config) {
        return interaction.reply({ content: '<:crossy:1567796959648030831> Confessions are not set up in this server.', flags: MessageFlags.Ephemeral });
    }

    config.Blacklist = config.Blacklist || [];

    if (add) {
        if (config.Blacklist.includes(target.id)) {
            return interaction.reply({ content: `<:crossy:1567796959648030831> ${target.tag} is already blacklisted.`, flags: MessageFlags.Ephemeral });
        }
        config.Blacklist.push(target.id);
        await config.save();
        return interaction.reply({ content: `<:restrict:1567797003638022166> ${target.tag} has been blacklisted from confessions.`, flags: MessageFlags.Ephemeral });
    } else {
        if (!config.Blacklist.includes(target.id)) {
            return interaction.reply({ content: `<:crossy:1567796959648030831> ${target.tag} is not blacklisted.`, flags: MessageFlags.Ephemeral });
        }
        config.Blacklist = config.Blacklist.filter(id => id !== target.id);
        await config.save();
        return interaction.reply({ content: `<a:tickyy:1567797045253644368> ${target.tag} has been removed from the blacklist.`, flags: MessageFlags.Ephemeral });
    }
}

// ── Handle /confession trusted ─────────────────────────────────────────────
async function handleTrusted(interaction, client) {
    const target = interaction.options.getUser('user');
    const add = interaction.options.getBoolean('add');

    if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ModerateMembers')) {
        return interaction.reply({ content: '<:crossy:1567796959648030831> You need administrator or moderate members permission.', flags: MessageFlags.Ephemeral });
    }

    const config = await confessionConfig.findOne({ Guild: interaction.guild.id });
    if (!config) {
        return interaction.reply({ content: '<:crossy:1567796959648030831> Confessions are not set up in this server.', flags: MessageFlags.Ephemeral });
    }

    config.TrustedUsers = config.TrustedUsers || [];

    if (add) {
        if (config.TrustedUsers.includes(target.id)) {
            return interaction.reply({ content: `<:crossy:1567796959648030831> ${target.tag} is already a trusted user.`, flags: MessageFlags.Ephemeral });
        }
        config.TrustedUsers.push(target.id);
        await config.save();
        return interaction.reply({ content: `<a:tickyy:1567797045253644368> ${target.tag} is now a trusted user (bypasses review & cooldown).`, flags: MessageFlags.Ephemeral });
    } else {
        if (!config.TrustedUsers.includes(target.id)) {
            return interaction.reply({ content: `<:crossy:1567796959648030831> ${target.tag} is not a trusted user.`, flags: MessageFlags.Ephemeral });
        }
        config.TrustedUsers = config.TrustedUsers.filter(id => id !== target.id);
        await config.save();
        return interaction.reply({ content: `<a:tickyy:1567797045253644368> ${target.tag} has been removed from trusted users.`, flags: MessageFlags.Ephemeral });
    }
}
