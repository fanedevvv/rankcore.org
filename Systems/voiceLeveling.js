const { Events, EmbedBuilder, MessageFlags } = require('discord.js');
const voiceLevelSchema = require("../Schemas/voiceLevel");
const voiceBlacklistSchema = require("../Schemas/voiceBlacklist");

module.exports = (client) => {
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const { guild, member } = newState;

        if (!guild || member.user.bot) return;

        const levelData = await voiceLevelSchema.findOne({ Guild: guild.id });
        if (!levelData || !levelData.IsEnabled) return;

        if (newState.channelId && !oldState.channelId) {
            member.voiceStartTime = Date.now();
        }

        if (!newState.channelId && oldState.channelId) {
            const timeSpent = Date.now() - member.voiceStartTime;

            if (isNaN(timeSpent) || timeSpent < 0) {
                console.error("Invalid time spent in voice channel:", timeSpent);
                return;
            }

            const isBlacklisted = await voiceBlacklistSchema.findOne({
                Guild: guild.id,
                ChannelID: oldState.channelId,
            });

            if (isBlacklisted) {
                return;
            }

            const xpEarned = Math.floor(timeSpent / 1000);

            if (isNaN(xpEarned) || xpEarned < 0) {
                console.error("Invalid XP earned:", xpEarned);
                return;
            }

            let userData = await voiceLevelSchema.findOne({
                Guild: guild.id,
                User: member.id,
            });

            if (!userData) {
                userData = await voiceLevelSchema.create({
                    Guild: guild.id,
                    User: member.id,
                    XP: 0,
                    Level: 1,
                });
            }

            userData.XP += xpEarned;

            if (isNaN(userData.XP)) {
                console.error("Invalid userData.XP:", userData.XP);
                return;
            }

            let requiredXP = userData.Level * 40;
            let leveledUp = false;

            while (userData.XP >= requiredXP) {
                userData.XP -= requiredXP;
                userData.Level += 1;
                leveledUp = true;
                requiredXP = userData.Level * 40;
            }

            await userData.save();

            if (leveledUp) {
                const notificationChannelId = levelData.NotificationChannel;
                const notificationChannel = guild.channels.cache.get(notificationChannelId);

                if (notificationChannel) {
                    const levelembed = new EmbedBuilder()
                        .setColor(client.config.embedColor)
                        .setTitle(`> ${member.user.username} has Leveled Up!`)
                        .setDescription(`<:boost:1567796953599836280> **Congratulations!** You've reached **Level ${userData.Level}**!`)
                        .setFooter({ text: `Keep chatting in voice channels to level up faster!` })
                        .setTimestamp();

                    await notificationChannel.send({ embeds: [levelembed] });
                }
            }
        }
    });
};