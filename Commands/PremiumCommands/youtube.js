const {
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
  } = require("discord.js");
  const YouTubeNotification = require('../../Schemas/youtubeSchema');
  
  module.exports = {
    data: new SlashCommandBuilder()
        .setName("youtube")
        .setDescription("Configure YouTube notifications for a channel.")
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configure YouTube notification settings.')),
                premium: true,
    premiumTier: 'basic',
  
    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return await interaction.reply({
                content: "You **do not** have the permission to do that!",
                flags: MessageFlags.Ephemeral,
            });
        }
  
        const subcommand = interaction.options.getSubcommand();
  
        if (subcommand === 'config') {
            const notifications = await YouTubeNotification.find({ Guild: interaction.guild.id });
            const setupCount = notifications.length;
  
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('YouTube Notifications Configuration Panel')
                .setDescription(`\`\`\`md\n# Welcome to YouTube Notifications System\n> Never miss your favorite channel's uploads or streams!\`\`\``);
  
            let systemStatus = '';
            let activeConfigs = '';
            if (setupCount === 0) {
                systemStatus = `\`\`\`ansi\n\u001b[31m□ <:LEred:1567796934545121280> SYSTEM OFFLINE\n\u001b[31m├───> Features: NOT CONFIGURED\n\u001b[31m└───> Updates: Disabled\`\`\``;
                activeConfigs = `\`\`\`yml\n"Setups": "None"\n"Slots Used": "0/5"\`\`\``;
            } else {
                systemStatus = `\`\`\`ansi\n\u001b[32m□ <:LEgreen:1567796933307666515> ALL SYSTEMS ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\`\`\``;
                activeConfigs = `\`\`\`yml\n"Slots Used": "${setupCount}/5"\n`;
                notifications.forEach((notif, index) => {
                    activeConfigs += `"Setup ${notif.SetupNumber}":\n  "channel": "${notif.Channel}"\n  "youtube-channel": "${notif.YouTubeChannel}"\n`;
                });
                activeConfigs += `\`\`\``;
            }
  
            embed.addFields(
                { name: 'SYSTEM STATUS', value: systemStatus },
                { name: 'Active Configurations', value: activeConfigs }
            ).setFooter({ text: `Today at ${new Date().toLocaleTimeString()}` });
  
            const setupOptions = [];
            for (let i = 1; i <= 5; i++) {
                const isSetup = notifications.some(notif => notif.SetupNumber === i);
                setupOptions.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`Setup ${i}`)
                        .setValue(`setup_${i}`)
                        .setDescription(isSetup ? `Already configured` : `Configure Setup ${i}`)
                );
            }
  
            const setupSelect = new StringSelectMenuBuilder()
                .setCustomId('setup_select')
                .setPlaceholder('Select a setup slot...')
                .addOptions(setupOptions);
  
            const disableOptions = [];
            if (setupCount > 0) {
                notifications.forEach((notif, index) => {
                    disableOptions.push(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(`Setup ${notif.SetupNumber}`)
                            .setValue(`disable_${notif.SetupNumber}`)
                            .setDescription(`Disable Setup ${notif.SetupNumber}`)
                    );
                });
                disableOptions.push(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('All Setups')
                        .setValue('disable_all')
                        .setDescription('Disable all setups')
                );
            }
  
            const disableSelect = new StringSelectMenuBuilder()
                .setCustomId('disable_select')
                .setPlaceholder('Select a setup to disable...')
                .addOptions(disableOptions.length > 0 ? disableOptions : [
                    new StringSelectMenuOptionBuilder()
                        .setLabel('No setups to disable')
                        .setValue('no_setups')
                        .setDescription('No configurations available')
                ]);
  
            const setupRow = new ActionRowBuilder().addComponents(setupSelect);
            const disableRow = new ActionRowBuilder().addComponents(disableSelect);
  
            const message = await interaction.reply({
                embeds: [embed],
                components: [setupRow, disableRow],
                withResponse: true
            });
  
            const filter = i => i.user.id === interaction.user.id && 
                               (i.customId === 'setup_select' || i.customId === 'disable_select');
            const collector = message.resource.message.createMessageComponentCollector({ filter, time: 60000 });
  
            let setupStage = null;
            let collectedData = {};
            let currentSetupNumber = null;
  
            collector.on('collect', async i => {
                if (i.customId === 'setup_select') {
                    const setupNumber = parseInt(i.values[0].split('_')[1]);
                    const existingSetup = notifications.find(notif => notif.SetupNumber === setupNumber);
  
                    if (existingSetup) {
                        await i.reply({
                            content: `Setup ${setupNumber} is already configured! Please disable it first or use another setup slot.`,
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
  
                    if (setupCount >= 5) {
                        await i.reply({
                            content: 'All setup slots are already used! Please disable a setup to configure a new one.',
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
  
                    currentSetupNumber = setupNumber;
                    setupStage = 'channel';
                    await i.reply({
                        content: `Configuring Setup ${setupNumber}. Send the Channel ID or mention the channel for notifications!`,
                        flags: MessageFlags.Ephemeral,
                    });
  
                    const channelFilter = m => m.author.id === i.user.id;
                    const channelCollector = i.channel.createMessageCollector({ filter: channelFilter, max: 1, time: 30000 });
  
                    channelCollector.on('collect', async m => {
                        const channel = m.mentions.channels.first() || i.guild.channels.cache.get(m.content);
                        if (!channel) {
                            await i.followUp({
                                content: 'Invalid channel! Please try again.',
                                flags: MessageFlags.Ephemeral,
                            });
                            setupStage = null;
                            return;
                        }
  
                        collectedData.channel = channel.id;
                        setupStage = 'youtube_channel';
  
                        await i.followUp({
                            content: 'Send the YouTube channel URL (e.g., https://www.youtube.com/@username or https://www.youtube.com/channel/UC...)!',
                            flags: MessageFlags.Ephemeral,
                        });
  
                        const youtubeCollector = i.channel.createMessageCollector({ filter: channelFilter, max: 1, time: 30000 });
  
                        youtubeCollector.on('collect', async m => {
                            const youtubeUrl = m.content;
                            if (!youtubeUrl.match(/^(https:\/\/(www\.)?youtube\.com\/(@[a-zA-Z0-9._-]+|channel\/[a-zA-Z0-9_-]+))$/)) {
                                await i.followUp({
                                    content: 'Invalid YouTube URL! Please provide a valid YouTube channel URL.',
                                    flags: MessageFlags.Ephemeral,
                                });
                                setupStage = null;
                                return;
                            }
  
                            collectedData.youtubeChannel = youtubeUrl;
                            setupStage = 'message';
  
                            await i.followUp({
                                content: 'Send the custom message to send when new content is posted!',
                                flags: MessageFlags.Ephemeral,
                            });
  
                            const messageCollector = i.channel.createMessageCollector({ filter: channelFilter, max: 1, time: 30000 });
  
                            messageCollector.on('collect', async m => {
                                collectedData.message = m.content;
  
                                const newNotification = new YouTubeNotification({
                                    Guild: i.guild.id,
                                    Channel: collectedData.channel,
                                    YouTubeChannel: collectedData.youtubeChannel,
                                    Message: collectedData.message,
                                    SetupNumber: currentSetupNumber,
                                    LastNotified: new Date(),
                                });
                                await newNotification.save();
  
                                const updatedNotifications = await YouTubeNotification.find({ Guild: i.guild.id });
                                const newSetupCount = updatedNotifications.length;
  
                                embed.spliceFields(0, 2, 
                                    { 
                                        name: 'SYSTEM STATUS', 
                                        value: `\`\`\`ansi\n\u001b[32m□ <:LEgreen:1567796933307666515> ALL SYSTEMS ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\`\`\`` 
                                    },
                                    { 
                                        name: 'Active Configurations', 
                                        value: `\`\`\`yml\n"Slots Used": "${newSetupCount}/5"\n` + 
                                               updatedNotifications.map((notif, index) => 
                                                   `"Setup ${notif.SetupNumber}":\n  "channel": "${notif.Channel}"\n  "youtube-channel": "${notif.YouTubeChannel}"\n`
                                               ).join('') + `\`\`\``
                                    }
                                );
  
                                const newDisableOptions = updatedNotifications.map(notif => 
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel(`Setup ${notif.SetupNumber}`)
                                        .setValue(`disable_${notif.SetupNumber}`)
                                        .setDescription(`Disable Setup ${notif.SetupNumber}`)
                                );
                                newDisableOptions.push(
                                    new StringSelectMenuOptionBuilder()
                                        .setLabel('All Setups')
                                        .setValue('disable_all')
                                        .setDescription('Disable all setups')
                                );
  
                                disableSelect.setOptions(newDisableOptions);
                                await i.message.edit({
                                    embeds: [embed],
                                    components: [setupRow, disableRow],
                                });
  
                                await i.followUp({
                                    content: `Setup ${currentSetupNumber} configured successfully! Channel: <#${collectedData.channel}>, YouTube: ${collectedData.youtubeChannel}`,
                                    flags: MessageFlags.Ephemeral,
                                });
  
                                setupStage = null;
                                collectedData = {};
                                currentSetupNumber = null;
                            });
                        });
                    });
                } else if (i.customId === 'disable_select') {
                    const value = i.values[0];
                    if (value === 'no_setups') {
                        await i.reply({
                            content: 'No setups to disable!',
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
  
                    if (value === 'disable_all') {
                        await YouTubeNotification.deleteMany({ Guild: i.guild.id });
                        embed.spliceFields(0, 2, 
                            { 
                                name: 'SYSTEM STATUS', 
                                value: `\`\`\`ansi\n\u001b[31m□ <:LEred:1567796934545121280> SYSTEM OFFLINE\n\u001b[31m├───> Features: NOT CONFIGURED\n\u001b[31m└───> Updates: Disabled\`\`\`` 
                            },
                            { 
                                name: 'Active Configurations', 
                                value: `\`\`\`yml\n"Setups": "None"\n"Slots Used": "0/5"\`\`\`` 
                            }
                        );
  
                        disableSelect.setOptions([
                            new StringSelectMenuOptionBuilder()
                                .setLabel('No setups to disable')
                                .setValue('no_setups')
                                .setDescription('No configurations available')
                        ]);
  
                        await i.update({
                            embeds: [embed],
                            components: [setupRow, disableRow],
                        });
  
                        await i.followUp({
                            content: 'All YouTube notification setups have been disabled.',
                            flags: MessageFlags.Ephemeral,
                        });
                    } else {
                        const setupNumber = parseInt(value.split('_')[1]);
                        await YouTubeNotification.deleteOne({ Guild: i.guild.id, SetupNumber: setupNumber });
  
                        const remainingNotifications = await YouTubeNotification.find({ Guild: i.guild.id });
                        const remainingSetupCount = remainingNotifications.length;
  
                        if (remainingSetupCount === 0) {
                            embed.spliceFields(0, 2, 
                                { 
                                    name: 'SYSTEM STATUS', 
                                    value: `\`\`\`ansi\n\u001b[31m□ <:LEred:1567796934545121280> SYSTEM OFFLINE\n\u001b[31m├───> Features: NOT CONFIGURED\n\u001b[31m└───> Updates: Disabled\`\`\`` 
                                },
                                { 
                                    name: 'Active Configurations', 
                                    value: `\`\`\`yml\n"Setups": "None"\n"Slots Used": "0/5"\`\`\`` 
                                }
                            );
  
                            disableSelect.setOptions([
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('No setups to disable')
                                    .setValue('no_setups')
                                    .setDescription('No configurations available')
                            ]);
                        } else {
                            embed.spliceFields(0, 2, 
                                { 
                                    name: 'SYSTEM STATUS', 
                                    value: `\`\`\`ansi\n\u001b[32m□ <:LEgreen:1567796933307666515> ALL SYSTEMS ONLINE\n\u001b[32m├───> Features: FULLY AVAILABLE\n\u001b[32m└───> Updates: Real-time Enabled\`\`\`` 
                                },
                                { 
                                    name: 'Active Configurations', 
                                    value: `\`\`\`yml\n"Slots Used": "${remainingSetupCount}/5"\n` + 
                                           remainingNotifications.map((notif, index) => 
                                               `"Setup ${notif.SetupNumber}":\n  "channel": "${notif.Channel}"\n  "youtube-channel": "${notif.YouTubeChannel}"\n`
                                           ).join('') + `\`\`\``
                                }
                            );
  
                            const newDisableOptions = remainingNotifications.map(notif => 
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(`Setup ${notif.SetupNumber}`)
                                    .setValue(`disable_${notif.SetupNumber}`)
                                    .setDescription(`Disable Setup ${notif.SetupNumber}`)
                            );
                            newDisableOptions.push(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('All Setups')
                                    .setValue('disable_all')
                                    .setDescription('Disable all setups')
                            );
                            disableSelect.setOptions(newDisableOptions);
                        }
  
                        await i.update({
                            embeds: [embed],
                            components: [setupRow, disableRow],
                        });
  
                        await i.followUp({
                            content: `Setup ${setupNumber} has been disabled.`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                }
            });
  
            collector.on('end', async () => {
                setupSelect.setDisabled(true);
                disableSelect.setDisabled(true);
                await message.resource.message.edit({ components: [setupRow, disableRow] });
            });
        }
    },
  };