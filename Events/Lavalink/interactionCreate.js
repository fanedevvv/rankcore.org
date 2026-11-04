const { InteractionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");
const { parseEmoji } = require('../../Utils/emojis');
const { convertTime } = require("../../Utils/convertTime");

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {
        if (interaction.type !== InteractionType.MessageComponent || !interaction.isButton()) return;

        const musicPanelCustomIds = [
            "playpause", "skip", "stop", "replay", "shuffle",
            "forward", "backward", "volplus", "volminus"
        ];

        if (!musicPanelCustomIds.includes(interaction.customId)) return;

        const guildId = interaction.guild?.id;
        if (!guildId) return;

        if (!client.musicPanels || !client.musicPanels.get) return;
        const panelData = await client.musicPanels.get(guildId);
        if (!panelData) return;

        // --- Only allow requester to use buttons ---
        if (interaction.user.id !== panelData.requesterId) {
            return interaction.reply({
                content: "<:crossy:1555544390221562048> Only the user who requested this song can use these buttons!",
                ephemeral: true
            });
        }

        if (!client.manager || !client.manager.players) return;
        const player = client.manager.players.get(guildId);
        if (!player) return;

        const panelMessage = interaction.channel.messages.cache.get(panelData.messageId) ?? await interaction.channel.messages.fetch(panelData.messageId).catch(() => null);
        if (!panelMessage) return;

        const customId = interaction.customId;
        console.log(`[Button Interaction] ${interaction.user.tag} clicked ${customId} in guild ${guildId}`);

        await interaction.deferUpdate();

        try {
            let feedback = "";
            let shouldUpdatePanel = true;
            
            switch (customId) {
                case "playpause":
                    if (player) {
                        if (player.paused) {
                            await player.pause(false);
                            feedback = "<:n_music:1555544516746940416> **Resumed playback!**";
                        } else {
                            await player.pause(true);
                            feedback = "<:n_music:1555544516746940416> **Paused playback!**";
                        }
                    }
                    break;
                case "skip":
                    if (player && (player.queue.size > 0 || player.queue.current)) {
                        try {
                            await player.skip();
                            feedback = "<:n_music:1555544516746940416> **Skipped to next track!**";
                            await new Promise(resolve => setTimeout(resolve, 1500));
                        } catch (skipError) {
                            console.error(`[Button Error] Skip failed: ${skipError}`);
                            feedback = "<:crossy:1555544390221562048> **Failed to skip track!**";
                        }
                    } else {
                        feedback = "<:crossy:1555544390221562048> **No tracks to skip!**";
                    }
                    break;
                case "stop":
                    if (player) {
                        try {
                            await player.destroy();
                            feedback = "<:n_music:1555544516746940416> **Stopped playback and disconnected!**";
                        } catch (stopError) {
                            console.error(`[Button Error] Stop failed: ${stopError}`);
                            feedback = "<:crossy:1555544390221562048> **Failed to stop player!**";
                        }
                    }
                    break;
                case "replay":
                    if (player.queue.current) {
                        player.queue.unshift(player.queue.current);
                        await player.play();
                        feedback = "<:n_add:1555544335036973106> **Replayed current track!**";
                    }
                    break;
                case "shuffle":
                    if (player.queue.size > 1) {
                        player.queue.shuffle();
                        feedback = "<:n_music:1555544516746940416> **Shuffled queue!**";
                    }
                    break;
                case "forward":
                    const position = player.position + 10000;
                    await player.seek(Math.min(position, player.queue.current.length));
                    feedback = "<:n_music:1555544516746940416> **Forwarded 10 seconds!**";
                    break;
                case "backward":
                    const newPosition = player.position - 10000;
                    await player.seek(Math.max(newPosition, 0));
                    feedback = "<:n_music:1555544516746940416> **Rewound 10 seconds!**";
                    break;
                case "volplus":
                    const newVolume = Math.min(player.volume + 10, 150);
                    await player.setVolume(newVolume);
                    feedback = "<:n_music:1555544516746940416> **Volume increased to " + newVolume + "%!**";
                    break;
                case "volminus":
                    const reducedVolume = Math.max(player.volume - 10, 0);
                    await player.setVolume(reducedVolume);
                    feedback = "<:n_music:1555544516746940416> **Volume decreased to " + reducedVolume + "%!**";
                    break;
                default:
                    return;
            }

            if (feedback) {
                try {
                    await interaction.followUp({ content: feedback, flags: MessageFlags.Ephemeral });
                } catch (followUpError) {
                    console.error(`[Button Error] Failed to send feedback: ${followUpError}`);
                }
            }

            // --- Panel update logic (same as before) ---
            if (panelMessage && shouldUpdatePanel) {
                try {
                    const currentPlayer = client.manager.players.get(guildId);
                    
                    if (currentPlayer && currentPlayer.queue && currentPlayer.queue.current) {
                        const queueList = currentPlayer.queue.size > 0 ? 
                            currentPlayer.queue.filter(track => track !== currentPlayer.queue.current)
                                .map((track, index) => `${index + 1}. **[${track.title}](${track.uri})** - \`${convertTime(track.length, true)}\``)
                                .join('\n') : '';
                        
                        const updatedEmbed = new EmbedBuilder()
                            .setColor(client.config.embedColor)
                            .setTitle("Music Control Panel")
                            .setDescription(`Now playing: **[${currentPlayer.queue.current.title}](${currentPlayer.queue.current.uri})**\nDuration: \`${convertTime(currentPlayer.queue.current.length, true)}\``)
                            .setImage(currentPlayer.queue.current.thumbnail || "https://i.pinimg.com/originals/e2/d4/5c/e2d45c1474a5b514be7d10cd47ed26b4.jpg")
                            .setFooter({ text: `Bot by ${client.config.dev} | Guild: ${interaction.guild.name} v2.0 Testing`, iconURL: client.user.displayAvatarURL() });

                        if (queueList) {
                            updatedEmbed.addFields({
                                name: "Queue",
                                value: queueList.length > 1024 ? `${queueList.slice(0, 1020)}...` : queueList,
                                inline: false
                            });
                        }

                        const playPauseButton = new ButtonBuilder().setCustomId("playpause").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(false);
                        const skipButton = new ButtonBuilder().setCustomId("skip").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(currentPlayer.queue.size === 0 && !currentPlayer.queue.current);
                        const stopButton = new ButtonBuilder().setCustomId("stop").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(false);
                        const replayButton = new ButtonBuilder().setCustomId("replay").setEmoji(parseEmoji("<:n_add:1555544335036973106>")).setStyle(ButtonStyle.Secondary).setDisabled(false);
                        const shuffleButton = new ButtonBuilder().setCustomId("shuffle").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(currentPlayer.queue.size < 2);
                        const forwardButton = new ButtonBuilder().setCustomId("forward").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(false);
                        const backwardButton = new ButtonBuilder().setCustomId("backward").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(false);
                        const volPlusButton = new ButtonBuilder().setCustomId("volplus").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(false);
                        const volMinusButton = new ButtonBuilder().setCustomId("volminus").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(false);

                        const row1 = new ActionRowBuilder().addComponents(playPauseButton, skipButton, stopButton, forwardButton, volPlusButton);
                        const row2 = new ActionRowBuilder().addComponents(replayButton, shuffleButton, backwardButton, volMinusButton);

                        await panelMessage.edit({ embeds: [updatedEmbed], components: [row1, row2] });
                        
                    } else {
                        // No music playing, disable buttons
                        const defaultEmbed = new EmbedBuilder()
                            .setColor(client.config.embedColor)
                            .setTitle("Music Control Panel")
                            .setDescription("<:n_music:1555544516746940416> **No music currently playing**\nSend a song name/link in this channel to add songs to the queue!")
                            .setImage("https://i.pinimg.com/originals/e2/d4/5c/e2d45c1474a5b514be7d10cd47ed26b4.jpg")
                            .setFooter({ text: `Bot by ${client.config.dev} | Guild: ${interaction.guild.name} v2.0 Testing`, iconURL: client.user.displayAvatarURL() });

                        const disabledButtons1 = [
                            new ButtonBuilder().setCustomId("playpause").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("skip").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("stop").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("forward").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("volplus").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true)
                        ];
                        
                        const disabledButtons2 = [
                            new ButtonBuilder().setCustomId("replay").setEmoji(parseEmoji("<:n_add:1555544335036973106>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("shuffle").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("backward").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("volminus").setEmoji(parseEmoji("<:n_music:1555544516746940416>")).setStyle(ButtonStyle.Secondary).setDisabled(true)
                        ];

                        const row1 = new ActionRowBuilder().addComponents(disabledButtons1);
                        const row2 = new ActionRowBuilder().addComponents(disabledButtons2);

                        await panelMessage.edit({ embeds: [defaultEmbed], components: [row1, row2] });
                    }
                    
                } catch (editError) {
                    console.error(`[Button Error] Failed to edit panel message after ${customId}: ${editError} for guild ${guildId}`);
                }
            }
            
        } catch (error) {
            console.error(`[Button Error] ${error} for guild ${guildId}`);
            try {
                await interaction.followUp({ content: ":exclamation: **An error occurred with the button.**", flags: MessageFlags.Ephemeral });
            } catch (followUpError) {
                console.error(`[Button Error] Failed to send error message: ${followUpError}`);
            }
        }
    }
};