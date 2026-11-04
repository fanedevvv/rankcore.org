const {
    Events,
    EmbedBuilder,
} = require('discord.js');

// --- Configuration Constants ---
const CUSTOM_CROSS_EMOJI = '<:crossy:1555544390221562048>';
const CROSS_EMOJI_ID = '1555544390221562048';
const WARNING_DELETE_TIMEOUT = 30000; // 30 seconds
const MAX_HISTORY = 10; // Max reset events to store

const NUMBER_EXTRACTION_REGEX = /(\d+)/;

// Per-guild channel processing lock — prevents concurrent messages racing on the
// same DB doc and hammering Discord's API with duplicate sends/reacts.
const processingLock = new Set();

module.exports = (client) => {
    const countschema = require("../Schemas/counting");

    client.on(Events.MessageCreate, async (message) => {
        if (message.guild === null || message.author.bot) return;

        const guildId = message.guild.id;
        const userId = message.author.id;

        const countdata = await countschema.findOne({ Guild: guildId });
        if (!countdata || !countdata.Channel) return;
        if (message.channel.id !== countdata.Channel) return;

        // Drop silently if already processing this channel — prevents spam from
        // triggering concurrent DB reads/writes and Discord rate limits.
        const lockKey = `${guildId}:${countdata.Channel}`;
        if (processingLock.has(lockKey)) return;
        processingLock.add(lockKey);

        try {
            await handleCountMessage(message, countdata, userId);
        } finally {
            processingLock.delete(lockKey);
        }
    });

    async function handleCountMessage(message, countdata, userId) {
        const content = message.content.trim();

        // --- Helper: Timed Warning ---
        const sendTimedWarning = async (warningContent) => {
            try {
                const warningMessage = await message.channel.send({ content: warningContent });
                setTimeout(async () => {
                    try { await warningMessage.delete(); } catch (e) { }
                }, WARNING_DELETE_TIMEOUT);
            } catch (err) {
                console.error("Failed to send warning message:", err);
            }
        };

        // --- Helper: Delete wrong message to discourage spam ---
        const deleteWrongMessage = async () => {
            try { await message.delete(); } catch (e) { }
        };

        // --- Number Extraction ---
        const numberMatch = content.match(NUMBER_EXTRACTION_REGEX);
        const potentialNumber = numberMatch ? numberMatch[0] : null;

        // Reject decimal-containing input
        if (potentialNumber && (content.includes('.') || content.includes(','))) {
            await deleteWrongMessage();
            await sendTimedWarning(`${CUSTOM_CROSS_EMOJI} **${message.author.toString()}**, only **whole numbers** are valid for counting!`);
            return;
        }

        const messageNumber = potentialNumber ? parseInt(potentialNumber, 10) : -1;

        // --- Determine expected number ---
        const previousCount = countdata.Count;
        let expectedNumber;

        if (countdata.CountdownMode) {
            // Count is an internal step counter (0, 1, 2…).
            // FIX: was `remaining - 1` which caused an off-by-one — first expected
            // was CountdownStart-1 instead of CountdownStart.
            expectedNumber = countdata.CountdownStart - previousCount;
            if (expectedNumber < 0) expectedNumber = 0;
        } else {
            expectedNumber = previousCount + 1;
        }

        // --- Counting Logic ---
        let reset = false;
        let resetReason = '';

        if (!potentialNumber && !countdata.AllowWords) {
            reset = true;
            resetReason = `You must send **only** a number in this channel!`;
        } else if (!potentialNumber) {
            // AllowWords is true — pure text with no number is allowed but warn
            await sendTimedWarning(`${CUSTOM_CROSS_EMOJI} **${message.author.toString()}**, please include the count number (**${expectedNumber}**) in your message!`);
            return;
        } else if (userId === countdata.LastUser) {
            reset = true;
            resetReason = `You **cannot** count twice in a row!`;
        } else if (messageNumber !== expectedNumber) {
            reset = true;
            resetReason = `Wrong number! Expected **${expectedNumber}**, got **${messageNumber}**.`;
        }

        if (reset) {
            countdata.TotalFails = (countdata.TotalFails || 0) + 1;

            // Delete the wrong message to stop users spamming to get it right
            await deleteWrongMessage();

            if (countdata.FailAction === 'warn') {
                // Soft fail: just warn, don't reset
                const warnEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('Wrong Count!')
                    .setDescription(`${message.author} made a mistake, but the count continues!`)
                    .addFields(
                        { name: 'Reason', value: resetReason, inline: false },
                        { name: 'Current Count', value: `Still at **${previousCount}**. Next: **${expectedNumber}**`, inline: true }
                    )
                    .setTimestamp();

                await message.channel.send({ embeds: [warnEmbed] });

                try { await message.react(CROSS_EMOJI_ID); } catch (e) { }

            } else {
                // Hard fail: reset
                const prevHigh = countdata.HighScore || 0;
                if (previousCount > prevHigh) countdata.HighScore = previousCount;

                // Record history
                const historyEntry = {
                    user: userId,
                    username: message.author.tag,
                    count: previousCount,
                    reason: resetReason,
                    date: new Date().toISOString(),
                };
                countdata.CountHistory = [historyEntry, ...(countdata.CountHistory || [])].slice(0, MAX_HISTORY);

                const resetEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Counting Chain Broken!')
                    .setDescription(`${countdata.PingOnFail ? message.author.toString() : message.author} has reset the count!`)
                    .addFields(
                        { name: 'Reason', value: resetReason, inline: false },
                        { name: 'Chain Stopped At', value: `**${previousCount}**`, inline: true },
                        { name: 'All-Time High', value: `**${countdata.HighScore}**`, inline: true },
                        { name: 'Next Number', value: countdata.CountdownMode
                            ? `Start counting down from **${countdata.CountdownStart}** again.`
                            : `Start counting from **1** again.`, inline: false }
                    )
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await message.channel.send({ embeds: [resetEmbed] });

                // Assign fail role if configured
                if (countdata.FailRole) {
                    try {
                        const member = await message.guild.members.fetch(userId);
                        const role = message.guild.roles.cache.get(countdata.FailRole);
                        if (member && role) await member.roles.add(role);
                    } catch (e) {
                        console.error("Failed to assign fail role:", e);
                    }
                }

                countdata.Count = 0;
                countdata.LastUser = null;

                try { await message.react(CROSS_EMOJI_ID); } catch (e) { }
            }

        } else {
            // --- SUCCESSFUL COUNT ---
            countdata.TotalCounts = (countdata.TotalCounts || 0) + 1;

            if (countdata.CountdownMode) {
                countdata.Count = previousCount + 1;
            } else {
                countdata.Count = messageNumber;
            }
            countdata.LastUser = userId;

            // Track per-user counts
            if (!countdata.UserCounts) countdata.UserCounts = new Map();
            const userPrev = countdata.UserCounts.get(userId) || 0;
            countdata.UserCounts.set(userId, userPrev + 1);
            countdata.markModified('UserCounts');

            // Update high score
            if (countdata.Count > (countdata.HighScore || 0)) {
                countdata.HighScore = countdata.Count;
            }

            // Check milestone reward roles
            if (countdata.RewardRoles && countdata.RewardRoles.size > 0) {
                const milestoneRole = countdata.RewardRoles.get(String(countdata.Count));
                if (milestoneRole) {
                    try {
                        const member = await message.guild.members.fetch(userId);
                        const role = message.guild.roles.cache.get(milestoneRole);
                        if (member && role) {
                            await member.roles.add(role);
                            await message.channel.send(`<:boost:1555544362455146576> ${message.author} reached **${countdata.Count}** and earned the <@&${milestoneRole}> role!`);
                        }
                    } catch (e) {
                        console.error("Failed to assign reward role:", e);
                    }
                }
            }

            // Check milestones for reactions/celebrations
            const milestones = countdata.Milestones || [10, 25, 50, 100, 250, 500, 1000];
            const isMilestone = milestones.includes(countdata.Count);

            let reaction;
            if (isMilestone) {
                reaction = "<:boost:1555544362455146576>";
                const milestoneEmbed = new EmbedBuilder()
                    .setColor(0x00FF88)
                    .setTitle(`Milestone Reached: ${countdata.Count}!`)
                    .setDescription(`Amazing work! ${message.author} counted to **${countdata.Count}**!`)
                    .setTimestamp();
                await message.channel.send({ embeds: [milestoneEmbed] });
            } else if (countdata.Count >= 1000) {
                reaction = "<:boost:1555544362455146576>";
            } else if (countdata.Count >= 500) {
                reaction = "<:fire:1555544450871332944>";
            } else if (countdata.Count >= 100) {
                reaction = "<:boost:1555544362455146576>";
            } else {
                reaction = "<a:tickyy:1555544712687915008>";
            }

            try { await message.react(reaction); } catch (e) { }
        }

        // --- Save ---
        try {
            await countdata.save();
        } catch (err) {
            console.error("Failed to save count data:", err);
        }
    }
};