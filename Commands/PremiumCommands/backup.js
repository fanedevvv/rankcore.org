const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const BackupSchema = require('../../Schemas/backupSchema');
const maxStates = 5;
const rateLimit = new Map();

async function hasRequiredPermissions(interaction) {
    return interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
           interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
           interaction.member.id === interaction.guild.ownerId ||
           interaction.member.roles.cache.some(role => role.name === 'BackupAdmin');
}

function validateState(state) {
    return /^[a-zA-Z0-9_]{1,20}$/.test(state);
}

async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manage server backups')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Creates a backup of the server settings.')
                .addStringOption(option =>
                    option.setName('state').setDescription('The state to backup to (Default is latest).').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all backups of the server settings.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restores a backup of the server settings from states.')
                .addStringOption(option =>
                    option.setName('state').setDescription('The state to restore from.').setRequired(false))
                .addStringOption(option =>
                    option.setName('scope').setDescription('What to restore (channels, roles, emojis, all).').setRequired(false)
                        .addChoices(
                            { name: 'All', value: 'all' },
                            { name: 'Channels', value: 'channels' },
                            { name: 'Roles', value: 'roles' },
                            { name: 'Emojis', value: 'emojis' }
                        ))
        ),

        premium: true,
        premiumTier: 'elite',
        
        async execute(interaction) {
        try {
            if (!interaction.guild) {
                return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            }

            const subcommand = interaction.options.getSubcommand();
            const state = interaction.options.getString('state') || 'latest';

            if (!validateState(state)) {
                return interaction.reply({ content: 'Invalid state name. Use alphanumeric characters and underscores (max 20).', flags: MessageFlags.Ephemeral });
            }

            if (subcommand === 'create') {
                await handleCreateBackup(interaction, state);
            } else if (subcommand === 'list') {
                await handleListBackups(interaction, state);
            } else if (subcommand === 'restore') {
                await handleRestoreBackup(interaction, state, interaction.options.getString('scope') || 'all');
            }
        } catch (error) {
            console.error(`Execute Error [Guild: ${interaction.guild.id}, Subcommand: ${interaction.options.getSubcommand()}, User: ${interaction.user.id}]:`, error);
            await interaction.followUp({ content: 'An error occurred while processing the command.', flags: MessageFlags.Ephemeral });
        }
    },
};

async function handleCreateBackup(interaction, state) {
    try {
        if (!(await hasRequiredPermissions(interaction))) {
            return interaction.reply({ content: 'You need Administrator, Manage Server, or BackupAdmin role to use this command.', flags: MessageFlags.Ephemeral });
        }

        const now = Date.now();
        const rateLimitKey = `${interaction.guild.id}:create`;
        if (rateLimit.has(rateLimitKey) && now - rateLimit.get(rateLimitKey) < 5 * 60 * 1000) {
            return interaction.reply({ content: 'Please wait 5 minutes before creating another backup.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ ephemeral: false });
        rateLimit.set(rateLimitKey, now);

        const serverDataString = await createBackupData(interaction);
        const size = Buffer.byteLength(serverDataString, 'utf8');

        const existingBackup = await BackupSchema.findOne({ guildId: interaction.guild.id, state });
        const serverInfo = new EmbedBuilder()
            .setTitle('Server Backup')
            .setDescription(`Created Backup: ${state}\n\n**Channels Stored:** ${interaction.guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory && c.id !== interaction.guild.rulesChannelId && c.id !== interaction.guild.publicUpdatesChannelId && c.id !== interaction.guild.systemChannelId).size}\n**Roles Stored:** ${interaction.guild.roles.cache.filter(r => !r.managed && r.name !== '@everyone' && !r.permissions.has(PermissionsBitField.Flags.Administrator)).size}\n**Categories Stored:** ${interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size}\n**Forum Channels Stored:** ${interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildForum).size}\n**Server Name:** ${interaction.guild.name}\n**Server Owner:** <@${interaction.guild.ownerId}>\n**Server ID:** ${interaction.guild.id}\n**Backup Size:** ${(size / 1024).toFixed(2)} KB`)
            .setColor('#80b918')
            .setTimestamp();

        const guildBackups = await BackupSchema.find({ guildId: interaction.guild.id });
        if (guildBackups.length >= maxStates) {
            const latestBackupIndex = guildBackups.findIndex(b => b.state === 'latest');
            const backupsToDelete = guildBackups.filter((b, i) => i !== latestBackupIndex).slice(0, guildBackups.length - maxStates + 1);
            for (const backup of backupsToDelete) {
                await retryOperation(() => BackupSchema.findByIdAndDelete(backup._id));
            }
        }

        if (existingBackup) {
            await retryOperation(() => BackupSchema.updateOne(
                { guildId: interaction.guild.id, state },
                { data: serverDataString, creatorId: interaction.user.id, size, updatedAt: new Date() }
            ));
            console.log(`Updated backup [Guild: ${interaction.guild.id}, State: ${state}]`);
        } else {
            await retryOperation(() => BackupSchema.create({
                data: serverDataString,
                guildId: interaction.guild.id,
                state,
                creatorId: interaction.user.id,
                size,
                createdAt: new Date(),
                updatedAt: new Date()
            }));
        }

        await BackupSchema.deleteMany({ guildId: interaction.guild.id, createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

        await interaction.editReply({ content: 'Server backup created successfully!', embeds: [serverInfo] });
    } catch (error) {
        console.error(`Create Backup Error [Guild: ${interaction.guild.id}, State: ${state}, User: ${interaction.user.id}]:`, error);
        const method = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
        await interaction[method]({ content: 'Failed to create backup. Please try again later.', flags: MessageFlags.Ephemeral });
    }
}

async function handleRestoreBackup(interaction, state, scope) {
    try {
        if (!(await hasRequiredPermissions(interaction))) {
            return interaction.reply({ content: 'You need Administrator, Manage Server, or BackupAdmin role to use this command.', flags: MessageFlags.Ephemeral });
        }

        const rateLimitKey = `${interaction.guild.id}:restore`;
        if (rateLimit.has(rateLimitKey) && Date.now() - rateLimit.get(rateLimitKey) < 5 * 60 * 1000) {
            return interaction.reply({ content: 'Please wait 5 minutes before restoring another backup.', flags: MessageFlags.Ephemeral });
        }

        const backup = await BackupSchema.findOne({ guildId: interaction.guild.id, state });
        if (!backup) {
            return interaction.reply({ content: `No backup found for state: ${state}`, flags: MessageFlags.Ephemeral });
        }

        const confirmButton = new ButtonBuilder().setCustomId('confirm_restore').setLabel('Confirm').setStyle(ButtonStyle.Danger);
        const cancelButton = new ButtonBuilder().setCustomId('cancel_restore').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            content: `Are you sure you want to restore the backup '${state}'? This will overwrite ${scope === 'all' ? 'channels, roles, and emojis' : scope}.`,
            components: [row],
            flags: MessageFlags.Ephemeral
        });

        const filter = i => i.user.id === interaction.user.id && ['confirm_restore', 'cancel_restore'].includes(i.customId);
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async i => {
            try {
                if (i.customId === 'cancel_restore') {
                    await i.update({ content: 'Restore cancelled.', components: [], flags: MessageFlags.Ephemeral });
                    collector.stop();
                    return;
                }

                rateLimit.set(rateLimitKey, Date.now());
                await i.update({ content: 'Restoring backup...', components: [], flags: MessageFlags.Ephemeral });

                const serverData = JSON.parse(backup.data);
                if (!serverData.schemaVersion || !serverData.guildInfo || !Array.isArray(serverData.channels)) {
                    throw new Error('Invalid backup data structure');
                }

                const channels = interaction.guild.channels.cache;
                const roles = interaction.guild.roles.cache;

                if (scope === 'all' || scope === 'channels') {
                    await deleteExistingData(interaction, 'channels');
                    await restoreCategories(interaction, serverData.categories);
                    await restoreChannels(interaction, serverData, channels);
                }

                if (scope === 'all' || scope === 'roles') {
                    await deleteExistingData(interaction, 'roles');
                    await restoreRoles(interaction, serverData, roles);
                }

                if (scope === 'all' || scope === 'emojis') {
                    await deleteExistingData(interaction, 'emojis');
                    await restoreEmojis(interaction, serverData.emojis);
                }

                await i.followUp({ content: `Backup '${state}' restored successfully!`, flags: MessageFlags.Ephemeral });
            } catch (error) {
                console.error(`Restore Backup Error [Guild: ${interaction.guild.id}, State: ${state}, Scope: ${scope}]:`, error);
                await i.followUp({ content: `Failed to restore backup: ${error.message}`, flags: MessageFlags.Ephemeral });
            } finally {
                collector.stop();
            }
        });

        collector.on('end', async collected => {
            if (!collected.size) {
                await interaction.editReply({ content: 'Restore timed out.', components: [], flags: MessageFlags.Ephemeral });
            }
        });
    } catch (error) {
        console.error(`Find Backup Error [Guild: ${interaction.guild.id}, State: ${state}]:`, error);
        await interaction.reply({ content: 'Failed to find backup.', flags: MessageFlags.Ephemeral });
    }
}

async function deleteExistingData(interaction, type) {
    const filters = {
        channels: c => c.id !== interaction.guild.rulesChannelId && c.id !== interaction.guild.publicUpdatesChannelId && c.id !== interaction.guild.systemChannelId,
        roles: r => !r.managed && r.name !== '@everyone' && !r.permissions.has(PermissionsBitField.Flags.Administrator),
        emojis: () => true
    };

    const items = type === 'channels' ? interaction.guild.channels.cache.filter(filters[type]) :
                  type === 'roles' ? interaction.guild.roles.cache.filter(filters[type]) :
                  interaction.guild.emojis.cache;

    for (const item of items.values()) {
        await retryOperation(() => item.delete(), 3, 1000);
    }
}

async function restoreCategories(interaction, categories) {
    for (const categoryData of categories) {
        await retryOperation(() => interaction.guild.channels.create({
            name: categoryData.name,
            type: ChannelType.GuildCategory
        }));
    }
}

async function restoreChannels(interaction, serverData, channels) {
    for (const channelData of serverData.channels) {
        const channelCategoryName = serverData.categories.find(c => c.channels?.includes(channelData.name))?.name;
        const channelCategory = channels.find(c => c.type === ChannelType.GuildCategory && c.name === channelCategoryName);
        const permissions = channelData.permissions.map(p => ({
            id: interaction.guild.roles.cache.find(r => r.name === p.id)?.id || interaction.guild.id,
            allow: p.allow,
            deny: p.deny
        }));

        const channel = await retryOperation(() => interaction.guild.channels.create({
            name: channelData.name,
            type: channelData.type,
            topic: channelData.description,
            rateLimitPerUser: channelData.slowmode,
            parent: channelCategory?.id,
            permissionOverwrites: permissions
        }));

        if (channelData.type === ChannelType.GuildForum) {
            const forumData = serverData.forumChannels.find(f => f.name === channelData.name);
            if (forumData) {
                await retryOperation(() => channel.setRateLimitPerUser(forumData.settings.rateLimitPerUser));
                await retryOperation(() => channel.setDefaultThreadRateLimitPerUser(forumData.settings.defaultThreadRateLimitPerUser));
                await retryOperation(() => channel.setDefaultAutoArchiveDuration(forumData.settings.defaultAutoArchiveDuration));
                await retryOperation(() => channel.setDefaultForumLayout(forumData.settings.defaultForumLayout));
                await retryOperation(() => channel.setAvailableTags(forumData.settings.availableTags));
            }
        }
    }
}

async function restoreRoles(interaction, serverData, roles) {
    const restoredRoles = {};
    for (const roleData of serverData.roles) {
        const role = await retryOperation(() => interaction.guild.roles.create({
            name: roleData.name,
            color: roleData.color,
            permissions: roleData.permissions,
            hoist: roleData.hoist,
            mentionable: roleData.mentionable,
            icon: roleData.icon
        }));
        await retryOperation(() => role.setPosition(roleData.position));
        restoredRoles[roleData.name] = role.id;
    }

    for (const memberData of serverData.members) {
        const member = await interaction.guild.members.fetch(memberData.id).catch(() => null);
        if (member) {
            const memberRoles = memberData.roles.map(r => restoredRoles[r]).filter(Boolean);
            if (memberRoles.length) {
                await retryOperation(() => member.roles.set(memberRoles));
            }
        }
    }
}

async function restoreEmojis(interaction, emojis) {
    for (const emojiData of emojis) {
        await retryOperation(() => interaction.guild.emojis.create({
            attachment: emojiData.url,
            name: emojiData.name
        }));
    }
}

async function handleListBackups(interaction, state) {
    try {
        const query = { guildId: interaction.guild.id };
        if (state !== 'latest') {
            query.state = state; // Only filter by state if not 'latest' (show all if 'latest')
        }

        const backups = await BackupSchema.find(query).sort({ createdAt: -1 }); // Sort by newest first
        if (!backups.length) {
            return interaction.reply({ content: `No backups found${state !== 'latest' ? ` for state: ${state}` : ''}.`, flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('Server Backups')
            .setDescription(`Backups for ${interaction.guild.name}`)
            .setColor('#80b918')
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

        backups.forEach((backup, index) => {
            const serverData = JSON.parse(backup.data);
            embed.addFields({
                name: `Backup ${index + 1}: ${backup.state || 'unnamed'}`,
                value: [
                    `**Created:** ${backup.createdAt?.toLocaleString() || 'N/A'}`,
                    `**Updated:** ${backup.updatedAt?.toLocaleString() || 'N/A'}`,
                    `**Creator:** ${backup.creatorId ? `<@${backup.creatorId}>` : 'Unknown'}`,
                    `**Size:** ${(backup.size / 1024).toFixed(2)} KB`,
                    `**Channels:** ${serverData.channels?.length || 'N/A'}`,
                    `**Roles:** ${serverData.roles?.length || 'N/A'}`,
                    `**Categories:** ${serverData.categories?.length || 'N/A'}`,
                    `**Forum Channels:** ${serverData.forumChannels?.length || 'N/A'}`,
                    `**Emojis:** ${serverData.emojis?.length || 'N/A'}`
                ].join('\n'),
                inline: true
            });
        });

        await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (error) {
        console.error(`List Backups Error [Guild: ${interaction.guild.id}, State: ${state}]:`, error);
        await interaction.reply({ content: 'Failed to list backups.', flags: MessageFlags.Ephemeral });
    }
}

async function createBackupData(interaction) {
    try {
        const guild = interaction.guild;

        const serverData = {
            schemaVersion: '1.0.0',
            guildInfo: {
                name: guild.name,
                ownerId: guild.ownerId,
                icon: guild.iconURL({ dynamic: true }),
                banner: guild.bannerURL({ dynamic: true }),
                afkChannel: guild.afkChannel?.name || null,
                afkTimeout: guild.afkTimeout || null,
                systemChannel: guild.systemChannel?.name || null,
                rulesChannel: guild.rulesChannel?.name || null,
                systemChannelFlags: guild.systemChannelFlags?.toArray() || []
            },
            categories: guild.channels?.cache?.filter(c => c.type === ChannelType.GuildCategory)?.map(c => ({
                name: c.name,
                rawPosition: c.rawPosition,
                channels: guild.channels?.cache?.filter(ch => ch.parentId === c.id)?.map(ch => ch.name) || []
            })) || [],
            channels: guild.channels?.cache?.filter(c =>
                c.type !== ChannelType.GuildCategory &&
                c.id !== guild.rulesChannelId &&
                c.id !== guild.publicUpdatesChannelId &&
                c.id !== guild.systemChannelId
            )?.map(c => ({
                name: c.name,
                type: c.type,
                description: c.topic || null,
                slowmode: c.rateLimitPerUser || 0,
                autoArchiveDuration: c.defaultAutoArchiveDuration || null,
                rawPosition: c.rawPosition,
                permissions: c.permissionOverwrites?.cache?.filter(p => p.type === 0)?.map(p => ({
                    id: guild.roles?.cache?.get(p.id)?.name || '@everyone',
                    allow: p.allow?.toArray() || [],
                    deny: p.deny?.toArray() || []
                })) || []
            })) || [],
            forumChannels: guild.channels?.cache?.filter(c => c.type === ChannelType.GuildForum)?.map(f => ({
                name: f.name,
                settings: {
                    availableTags: f.availableTags || [],
                    defaultAutoArchiveDuration: f.defaultAutoArchiveDuration || null,
                    defaultForumLayout: f.defaultForumLayout || null,
                    defaultReactionEmoji: f.defaultReactionEmoji || null,
                    defaultSortOrder: f.defaultSortOrder || null,
                    defaultThreadRateLimitPerUser: f.defaultThreadRateLimitPerUser || null,
                    nsfw: f.nsfw || false,
                    rateLimitPerUser: f.rateLimitPerUser || 0,
                    topic: f.topic || null
                },
                permissions: f.permissionOverwrites?.cache?.filter(p => p.type === 0)?.map(p => ({
                    id: guild.roles?.cache?.get(p.id)?.name || '@everyone',
                    allow: p.allow?.toArray() || [],
                    deny: p.deny?.toArray() || []
                })) || []
            })) || [],
            roles: guild.roles?.cache?.filter(r =>
                !r.managed && r.name !== '@everyone' && !r.permissions.has(PermissionsBitField.Flags.Administrator)
            )?.map(r => ({
                id: r.id,
                name: r.name,
                permissions: r.permissions?.toArray() || [],
                color: r.color,
                hoist: r.hoist,
                mentionable: r.mentionable,
                icon: r.iconURL() || null,
                position: r.rawPosition
            })) || [],
            members: guild.members?.cache?.map(m => ({
                id: m.id,
                roles: m.roles?.cache?.filter(r => r.name !== '@everyone' && !r.managed)?.map(r => r.name) || []
            })) || [],
            emojis: guild.emojis?.cache?.map(e => ({
                name: e.name,
                url: e.url
            })) || []
        };

        return JSON.stringify(serverData);
    } catch (error) {
        console.error(`Create Backup Data Error [Guild: ${interaction.guild?.id}]:`, error);
        throw new Error('Failed to create backup data.');
    }
}