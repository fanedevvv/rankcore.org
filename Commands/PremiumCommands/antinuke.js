const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChannelType } = require("discord.js");
const antinukeSchema = require('../../Schemas/antinukeSchema');

const EVENT_KEYS = [
    'memberKick', 'memberBan', 'banRemove', 'roleCreate', 'roleDelete', 'roleUpdate',
    'channelCreate', 'channelDelete', 'channelUpdate', 'webhookCreate', 'botAdd',
    'emojiCreate', 'emojiDelete', 'guildUpdate', 'memberRoleUpdate', 'integrationCreate'
];

const EVENT_LABELS = {
    memberKick: 'Member Kick',
    memberBan: 'Member Ban',
    banRemove: 'Ban Remove',
    roleCreate: 'Role Create',
    roleDelete: 'Role Delete',
    roleUpdate: 'Role Update (Dangerous Perms)',
    channelCreate: 'Channel Create',
    channelDelete: 'Channel Delete',
    channelUpdate: 'Channel Update',
    webhookCreate: 'Webhook Create',
    botAdd: 'Bot Add',
    emojiCreate: 'Emoji Create',
    emojiDelete: 'Emoji Delete',
    guildUpdate: 'Server Update',
    memberRoleUpdate: 'Dangerous Role Grant',
    integrationCreate: 'Integration Create',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription("Manage anti-nuke protection for the server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // Core
        .addSubcommand(s => s.setName('enable').setDescription('Enable anti-nuke protection.'))
        .addSubcommand(s => s.setName('disable').setDescription('Disable anti-nuke protection.'))
        .addSubcommand(s => s.setName('status').setDescription('View anti-nuke configuration.'))

        // Action
        .addSubcommand(s => s.setName('set-action').setDescription('Set the global punishment action.')
            .addStringOption(o => o.setName('action').setDescription('Action to take').setRequired(true)
                .addChoices(
                    { name: '<:files:1555544445565407352> Log Only', value: 'log' },
                    { name: '<:ban:1555544356352430202> Kick User', value: 'kick' },
                    { name: '<:ban:1555544356352430202> Ban User', value: 'ban' },
                    { name: '<:1430986239036625017:1555544229143519304> Strip Roles', value: 'stripRoles' },
                    { name: '<:n_music:1555544516746940416> Timeout (28d)', value: 'timeout' },
                )))

        // Log channel
        .addSubcommand(s => s.setName('set-log-channel').setDescription('Set the alert log channel.')
            .addChannelOption(o => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))

        // Alert ping
        .addSubcommand(s => s.setName('set-alert-ping').setDescription('Set a role/user to ping on alerts.')
            .addMentionableOption(o => o.setName('target').setDescription('Role or user to ping').setRequired(true)))

        // DM owner toggle
        .addSubcommand(s => s.setName('dm-owner').setDescription('Toggle DM alerts to server owner.')
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable DM alerts to owner').setRequired(true)))

        // Whitelist
        .addSubcommand(s => s.setName('whitelist-add').setDescription('Add a user to the whitelist.')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('whitelist-remove').setDescription('Remove a user from the whitelist.')
            .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
        .addSubcommand(s => s.setName('whitelist-list').setDescription('Show whitelisted users.'))

        // Trusted Roles
        .addSubcommand(s => s.setName('trusted-role-add').setDescription('Add a trusted role (all members bypassed).')
            .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
        .addSubcommand(s => s.setName('trusted-role-remove').setDescription('Remove a trusted role.')
            .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))

        // Per-event control
        .addSubcommand(s => s.setName('event-toggle').setDescription('Enable or disable a specific event.')
            .addStringOption(o => o.setName('event').setDescription('Event key').setRequired(true)
                .addChoices(...EVENT_KEYS.map(k => ({ name: EVENT_LABELS[k], value: k }))))
            .addBooleanOption(o => o.setName('enabled').setDescription('Enable this event protection').setRequired(true)))
        .addSubcommand(s => s.setName('event-action').setDescription('Set action for a specific event (overrides global).')
            .addStringOption(o => o.setName('event').setDescription('Event key').setRequired(true)
                .addChoices(...EVENT_KEYS.map(k => ({ name: EVENT_LABELS[k], value: k }))))
            .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true)
                .addChoices(
                    { name: '<:n_music:1555544516746940416> Inherit Global', value: 'inherit' },
                    { name: '<:files:1555544445565407352> Log Only', value: 'log' },
                    { name: '<:ban:1555544356352430202> Kick', value: 'kick' },
                    { name: '<:ban:1555544356352430202> Ban', value: 'ban' },
                    { name: '<:1430986239036625017:1555544229143519304> Strip Roles', value: 'stripRoles' },
                    { name: '<:n_music:1555544516746940416> Timeout', value: 'timeout' },
                )))
        .addSubcommand(s => s.setName('event-threshold').setDescription('Set rate-limit threshold for an event (0 = instant).')
            .addStringOption(o => o.setName('event').setDescription('Event key').setRequired(true)
                .addChoices(...EVENT_KEYS.map(k => ({ name: EVENT_LABELS[k], value: k }))))
            .addIntegerOption(o => o.setName('count').setDescription('Number of actions before triggering (0 = instant)').setMinValue(0).setMaxValue(20).setRequired(true))
            .addIntegerOption(o => o.setName('window').setDescription('Time window in seconds').setMinValue(1).setMaxValue(300).setRequired(false)))

        // Logs
        .addSubcommand(s => s.setName('logs').setDescription('Show recent anti-nuke punishment log.'))
        .addSubcommand(s => s.setName('reset').setDescription('Reset all anti-nuke settings.')),
        premium: true,
    premiumTier: 'basic',

    category: "Security",
    usage: "/antinuke <subcommand>",
    permissions: ["Administrator"],

    async execute(interaction) {
        try {
            const sub = interaction.options.getSubcommand();

            // Owner-only commands
            const ownerOnly = ['enable', 'disable', 'reset'];
            if (ownerOnly.includes(sub) && interaction.user.id !== interaction.guild.ownerId) {
                return interaction.reply({ content: '<:error:1555544434601369620> Only the server owner can use this subcommand.', flags: MessageFlags.Ephemeral });
            }

            const handlers = {
                'enable': enableAntinuke,
                'disable': disableAntinuke,
                'status': checkStatus,
                'set-action': setAction,
                'set-log-channel': setLogChannel,
                'set-alert-ping': setAlertPing,
                'dm-owner': setDmOwner,
                'whitelist-add': whitelistAdd,
                'whitelist-remove': whitelistRemove,
                'whitelist-list': whitelistList,
                'trusted-role-add': trustedRoleAdd,
                'trusted-role-remove': trustedRoleRemove,
                'event-toggle': eventToggle,
                'event-action': eventAction,
                'event-threshold': eventThreshold,
                'logs': viewLogs,
                'reset': resetConfig,
            };

            if (handlers[sub]) await handlers[sub](interaction);
            else await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('[AntiNuke Command] Error:', error);
            return interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
        }
    }
};

// ===================== HELPERS =====================
async function getEntry(guildId) {
    return antinukeSchema.findOne({ guildId });
}

async function requireEntry(interaction) {
    const entry = await getEntry(interaction.guild.id);
    if (!entry) {
        await interaction.reply({ content: '<:crossy:1555544390221562048> Anti-nuke is not enabled. Use `/antinuke enable` first.', flags: MessageFlags.Ephemeral });
        return null;
    }
    return entry;
}

// ===================== HANDLERS =====================

async function enableAntinuke(interaction) {
    const existing = await getEntry(interaction.guild.id);
    if (existing) return interaction.reply({ content: '<a:tickyy:1555544712687915008> Anti-nuke is already enabled. Use `/antinuke status` to view config.', flags: MessageFlags.Ephemeral });

    await interaction.deferReply();

    await antinukeSchema.create({
        guildId: interaction.guild.id,
        enabled: true,
        whitelist: [interaction.client.user.id],
        action: 'log',
    });

    const embed = new EmbedBuilder()
        .setTitle('<:restrict:1555544549105999962> Anti-Nuke Enabled')
        .setDescription(
            `Anti-nuke protection is now **active**.\n\n` +
            `**Default Action:** Log Only\n` +
            `**Protected Events:** All 16 events\n\n` +
            `Use \`/antinuke set-action\` to change the punishment.\n` +
            `Use \`/antinuke set-log-channel\` to receive alerts.\n` +
            `Use \`/antinuke whitelist-add\` to trust specific users.`
        )
        .setColor('#00ff88')
        .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
}

async function disableAntinuke(interaction) {
    const entry = await getEntry(interaction.guild.id);
    if (!entry) return interaction.reply({ content: '<:crossy:1555544390221562048> Anti-nuke is not enabled.', flags: MessageFlags.Ephemeral });
    await antinukeSchema.findOneAndDelete({ guildId: interaction.guild.id });
    return interaction.reply('<:restrict:1555544549105999962> Anti-nuke protection has been **disabled**.');
}

async function checkStatus(interaction) {
    const entry = await getEntry(interaction.guild.id);
    if (!entry) return interaction.reply({ content: '<:crossy:1555544390221562048> Anti-nuke is **disabled**.', flags: MessageFlags.Ephemeral });

    const actionEmoji = { log: '<:files:1555544445565407352>', kick: '<:ban:1555544356352430202>', ban: '<:ban:1555544356352430202>', stripRoles: '<:1430986239036625017:1555544229143519304>', timeout: '<:n_music:1555544516746940416>' };
    const actionNames = { log: 'Log Only', kick: 'Kick', ban: 'Ban', stripRoles: 'Strip Roles', timeout: 'Timeout' };

    const disabledEvents = EVENT_KEYS.filter(k => entry.events?.[k]?.enabled === false);
    const customActionEvents = EVENT_KEYS.filter(k => entry.events?.[k]?.action && entry.events[k].action !== 'inherit');

    const embed = new EmbedBuilder()
        .setTitle('<:restrict:1555544549105999962> Anti-Nuke Status')
        .setColor('#00ff88')
        .addFields(
            { name: '<:thunderr:1555544623735242883> Status', value: entry.enabled ? '<a:tickyy:1555544712687915008> Enabled' : '<:crossy:1555544390221562048> Disabled', inline: true },
            { name: `${actionEmoji[entry.action] || '<:files:1555544445565407352>'} Global Action`, value: actionNames[entry.action] || 'Log Only', inline: true },
            { name: '<:announcement:1555544345740967956> Log Channel', value: entry.logChannelId ? `<#${entry.logChannelId}>` : 'Not Set', inline: true },
            { name: '<:1430986220011524216:1555544196952367134> Whitelisted Users', value: `${entry.whitelist.length} user(s)`, inline: true },
            { name: '<:minigames:1555544500179439707> Trusted Roles', value: `${entry.trustedRoles?.length || 0} role(s)`, inline: true },
            { name: '<:announcement:1555544345740967956> DM Owner', value: entry.dmOwner ? 'Yes' : 'No', inline: true },
            { name: '<:announcement:1555544345740967956> Disabled Events', value: disabledEvents.length ? disabledEvents.map(k => EVENT_LABELS[k]).join(', ') : 'None', inline: false },
            { name: '<:n_utils:1555544669545431062> Custom Event Actions', value: customActionEvents.length ? customActionEvents.map(k => `${EVENT_LABELS[k]}: ${entry.events[k].action}`).join('\n') : 'None', inline: false },
        )
        .setTimestamp();

    return interaction.reply({ embeds: [embed] });
}

async function setAction(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    entry.action = interaction.options.getString('action');
    await entry.save();
    const actionNames = { log: 'Log Only', kick: 'Kick', ban: 'Ban', stripRoles: 'Strip Roles', timeout: 'Timeout (28d)' };
    return interaction.reply(`<a:tickyy:1555544712687915008> Global action set to **${actionNames[entry.action]}**.`);
}

async function setLogChannel(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const channel = interaction.options.getChannel('channel');
    entry.logChannelId = channel.id;
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> Alert log channel set to ${channel}.`);
}

async function setAlertPing(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const target = interaction.options.getMentionable('target');
    entry.alertPing = target.id;
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> Alert ping set to <@${target.id}>.`);
}

async function setDmOwner(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    entry.dmOwner = interaction.options.getBoolean('enabled');
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> DM owner on alert: **${entry.dmOwner ? 'Enabled' : 'Disabled'}**.`);
}

async function whitelistAdd(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const user = interaction.options.getUser('user');
    if (entry.whitelist.includes(user.id)) return interaction.reply({ content: `<:error:1555544434601369620> ${user.tag} is already whitelisted.`, flags: MessageFlags.Ephemeral });
    entry.whitelist.push(user.id);
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> **${user.tag}** added to whitelist.`);
}

async function whitelistRemove(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const user = interaction.options.getUser('user');
    entry.whitelist = entry.whitelist.filter(id => id !== user.id);
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> **${user.tag}** removed from whitelist.`);
}

async function whitelistList(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const users = entry.whitelist.map(id => `<@${id}>`).join('\n') || 'None';
    const embed = new EmbedBuilder()
        .setTitle('<:1430986220011524216:1555544196952367134> Whitelisted Users')
        .setDescription(users)
        .setColor('#00ff88');
    return interaction.reply({ embeds: [embed] });
}

async function trustedRoleAdd(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const role = interaction.options.getRole('role');
    if (!entry.trustedRoles) entry.trustedRoles = [];
    if (entry.trustedRoles.includes(role.id)) return interaction.reply({ content: `<:error:1555544434601369620> ${role.name} is already trusted.`, flags: MessageFlags.Ephemeral });
    entry.trustedRoles.push(role.id);
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> **${role.name}** added as trusted role.`);
}

async function trustedRoleRemove(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const role = interaction.options.getRole('role');
    entry.trustedRoles = (entry.trustedRoles || []).filter(id => id !== role.id);
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> **${role.name}** removed from trusted roles.`);
}

async function eventToggle(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const eventKey = interaction.options.getString('event');
    const enabled = interaction.options.getBoolean('enabled');
    if (!entry.events[eventKey]) entry.events[eventKey] = {};
    entry.events[eventKey].enabled = enabled;
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> **${EVENT_LABELS[eventKey]}** protection: **${enabled ? 'Enabled' : 'Disabled'}**.`);
}

async function eventAction(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const eventKey = interaction.options.getString('event');
    const action = interaction.options.getString('action');
    if (!entry.events[eventKey]) entry.events[eventKey] = {};
    entry.events[eventKey].action = action;
    await entry.save();
    return interaction.reply(`<a:tickyy:1555544712687915008> **${EVENT_LABELS[eventKey]}** action set to **${action}**.`);
}

async function eventThreshold(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const eventKey = interaction.options.getString('event');
    const count = interaction.options.getInteger('count');
    const window = interaction.options.getInteger('window') || 10;
    if (!entry.events[eventKey]) entry.events[eventKey] = {};
    entry.events[eventKey].threshold = count;
    entry.events[eventKey].thresholdWindow = window;
    await entry.save();
    const msg = count === 0
        ? `<a:tickyy:1555544712687915008> **${EVENT_LABELS[eventKey]}** set to trigger **instantly**.`
        : `<a:tickyy:1555544712687915008> **${EVENT_LABELS[eventKey]}** threshold set to **${count}** actions within **${window}s**.`;
    return interaction.reply(msg);
}

async function viewLogs(interaction) {
    const entry = await requireEntry(interaction);
    if (!entry) return;
    const logs = (entry.punishmentLog || []).slice(-10).reverse();
    if (!logs.length) return interaction.reply({ content: '<:files:1555544445565407352> No punishment logs yet.', flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
        .setTitle('<:files:1555544445565407352> Recent Anti-Nuke Actions')
        .setColor('#00ff88')
        .setDescription(logs.map((l, i) =>
            `**${i + 1}.** \`${l.type}\` — ${l.executorTag} → **${l.actionTaken}**\n` +
            `↳ ${l.details} • <t:${Math.floor(new Date(l.timestamp).getTime() / 1000)}:R>`
        ).join('\n\n'))
        .setTimestamp();

    return interaction.reply({ embeds: [embed] });
}

async function resetConfig(interaction) {
    await antinukeSchema.findOneAndDelete({ guildId: interaction.guild.id });
    return interaction.reply('<:n_add:1555544335036973106> Anti-nuke configuration has been **reset**. Use `/antinuke enable` to set up again.');
}