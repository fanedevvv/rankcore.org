/*
██████╗  █████╗ ███████╗ ██████╗ ██████╗ 
██╔══██╗██╔══██╗╚══███╔╝██╔═██╗██╔══██╗
██████╔╝███████║  ███╔╝ ██║   ██║██████╔╝
██╔══██╗██╔══██║ ███╔╝  ██║   ██║██╔══██╗
██║  ██║██║  ██║███████╗╚██████╔╝██║  ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝

Developed by: @arpandevv. All rights reserved. (2025)
MIT License
*/
const cron = require('node-cron');

const Premium = require('../../Schemas/premiumUserSchema.js');
const PremiumGuild = require('../../Schemas/premiumGuildSchema.js');
const customCommandSchema = require('../../Schemas/customCommandSchema.js');
const GuildCommands = require('../../Schemas/Guildcommandsschema.js');
const { endGiveaway } = require('../../Commands/Giveaway/giveaway');
const { REST } = require('discord.js');
const { Routes } = require('discord-api-types/v10');

// FIX: Required at module scope so the QOTD cron (now inside module.exports)
// can access them. Previously these were at the bottom of the file, outside
// module.exports, which meant client/logStep/theme were all undefined when
// their callbacks fired.
const QOTDSchema = require('../../Schemas/qotdSchema');
const { postQOTD } = require('../../Commands/Community/qotd');


module.exports = (client) => {

    const theme = {
        reset: "\x1b[0m",
        bright: "\x1b[1m",
        dim: "\x1b[2m",
        cyan: "\x1b[36m",
        yellow: "\x1b[33m",
        green: "\x1b[32m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        red: "\x1b[31m",
        gray: "\x1b[90m"
    };

    const sep = theme.gray + '-------------------------------------------' + theme.reset;

    const logStep = (label, message, color = theme.cyan) => {
        console.log(sep);
        console.log(`${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset} ${color}${theme.bright}[${label}]${theme.reset} ${message}`);
        console.log(sep);
    };

    logStep('CRON', 'cronJobs.js Loaded', theme.magenta);

    // FIX: Collect every job handle so the module manager's stop() can cancel
    // them when the cron module is stopped or restarted. Without this, each
    // restart stacks a fresh set of crons on top of the still-running old ones,
    // multiplying every poller's frequency.
    const jobs = [];

    // -------------------------------
    // 🎄 Christmas Countdown — DAILY @ 06:00
    // -------------------------------
    function getChristmasMessage(daysLeft, isChristmasDay) {
        if (isChristmasDay) {
            return {
                title: "<:boost:1567796953599836280> **MERRY CHRISTMAS!** 🎄",
                description: "<:boost:1567796953599836280> **It's finally here!**\nMay your day be filled with joy, warmth, and presents! <:boost:1567796953599836280>🎄<:Red_Heart:1567796949271191642>\n\nThank you for counting down with us!",
                footer: "🎄 Enjoy your Christmas Day!"
            };
        }

        if (daysLeft > 90) {
            return {
                title: "❄️ Christmas Countdown",
                description: `🎅 **${daysLeft} days left until Christmas.**\nStill a while to go — but the season will be here before you know it.`,
                footer: "Christmas is on the horizon ❄️"
            };
        }

        if (daysLeft > 30) {
            return {
                title: "🎄 Christmas Countdown",
                description: `🎅 **${daysLeft} days left until Christmas!**\nFestive season is slowly creeping in…`,
                footer: "The holiday spirit is waking up 🎄"
            };
        }

        if (daysLeft > 7) {
            return {
                title: "🎄<:boost:1567796953599836280> Christmas Countdown <:boost:1567796953599836280>🎄",
                description: `🎅 **ONLY ${daysLeft} DAYS LEFT!**\nLights, music, and hot chocolate season is almost here! <:eco:1567796967197900842><:boost:1567796953599836280>`,
                footer: "The festive vibes are getting stronger!"
            };
        }

        return {
            title: "🎄<:boost:1567796953599836280> CHRISTMAS IS ALMOST HERE! <:boost:1567796953599836280>🎄",
            description: `<:fire:1567796972125945888> **JUST ${daysLeft} DAYS TO GO!** <:fire:1567796972125945888>\nThe hype is REAL — get those presents ready! 🎅<:boost:1567796953599836280><:boost:1567796953599836280>`,
            footer: "Maximum festive energy 🎄<:fire:1567796972125945888>"
        };
    }

    jobs.push(cron.schedule('0 6 * * *', async () => {
        logStep('CHRISTMAS', 'Daily cron started', theme.cyan);

        const christmasSchema = require('../../Schemas/christmasSchema.js');
        const { EmbedBuilder } = require('discord.js');

        const daysUntil = (month, day) => {
            const now = new Date();
            let target = new Date(now.getFullYear(), month - 1, day);
            if (target < now) target.setFullYear(now.getFullYear() + 1);
            return Math.ceil((target - now) / 86400000);
        };

        try {
            const configs = await christmasSchema.find({ Enabled: true });
            const now = new Date();
            const today = now.getDate();
            const todayMonth = now.getMonth() + 1;

            for (const config of configs) {
                if (config.LastSentDay === today) continue;

                const guild = client.guilds.cache.get(config.Guild);
                if (!guild) continue;

                const channel = guild.channels.cache.get(config.Channel);
                if (!channel) continue;

                const daysLeft = daysUntil(12, 25);
                const isChristmasDay = (todayMonth === 12 && today === 25);

                const festive = getChristmasMessage(daysLeft, isChristmasDay);

                const embed = new EmbedBuilder()
                    .setColor("Red")
                    .setTitle(festive.title)
                    .setDescription(festive.description)
                    .setFooter({ text: festive.footer })
                    .setTimestamp();

                const ping = config.PingRole ? `<@&${config.PingRole}>` : "";
                await channel.send({ content: ping, embeds: [embed] });

                await christmasSchema.updateOne(
                    { Guild: config.Guild },
                    { LastSentDay: today }
                );

                logStep('CHRISTMAS', `Countdown posted in guild ${guild.id}`, theme.green);
            }
        } catch (err) {
            logStep('CHRISTMAS', `ERROR: ${err}`, theme.red);
        }
    }));

    // -------------------------------
    // 🎃 Halloween Countdown — DAILY @ 06:00
    // -------------------------------
    function getHalloweenMessage(daysLeft, isHalloweenDay) {
        if (isHalloweenDay) {
            return {
                title: "🎃 **HAPPY HALLOWEEN!** 👻",
                description: "🕸️ **The spookiest day of the year has arrived!**\nMay your candy be plenty, your costumes spooky, and your night filled with thrills! 👀🦇🎃",
                footer: "🎃 Enjoy your spooky day!"
            };
        }

        if (daysLeft > 90) {
            return {
                title: "🕷️ Halloween Countdown",
                description: `🎃 **${daysLeft} days until Halloween.**\nIt's quiet… for now. The darkness hasn't stirred yet.`,
                footer: "The calm before the haunt 🕷️"
            };
        }

        if (daysLeft > 30) {
            return {
                title: "🎃 Halloween Countdown",
                description: `🕸️ **${daysLeft} days until Halloween!**\nPumpkins are growing… something stirs in the shadows.`,
                footer: "The spooky season approaches 🎃"
            };
        }

        if (daysLeft > 7) {
            return {
                title: "🎃👻 Halloween is Near 👻🎃",
                description: `🦇 **ONLY ${daysLeft} DAYS LEFT!**\nFog rolls in… costumes prepare… candy stockpiles grow! 🍬👀`,
                footer: "The fear is rising… 👻"
            };
        }

        return {
            title: "👻🎃 HALLOWEEN IS ALMOST HERE! 🎃👻",
            description: `<:fire:1567796972125945888> **JUST ${daysLeft} DAYS REMAIN!** <:fire:1567796972125945888>\nThe veil thins… the spirits awaken… prepare yourself! 🕸️🦇🎃`,
            footer: "Maximum spookiness 👻<:fire:1567796972125945888>"
        };
    }

    jobs.push(cron.schedule('0 6 * * *', async () => {
        logStep('HALLOWEEN', 'Daily cron started', theme.cyan);

        const halloweenSchema = require('../../Schemas/halloweenSchema.js');
        const { EmbedBuilder } = require('discord.js');

        const daysUntil = (month, day) => {
            const now = new Date();
            let target = new Date(now.getFullYear(), month - 1, day);
            if (target < now) target.setFullYear(now.getFullYear() + 1);
            return Math.ceil((target - now) / 86400000);
        };

        try {
            const configs = await halloweenSchema.find({ Enabled: true });
            const now = new Date();
            const today = now.getDate();
            const todayMonth = now.getMonth() + 1;

            for (const config of configs) {
                if (config.LastSentDay === today) continue;

                const guild = client.guilds.cache.get(config.Guild);
                if (!guild) continue;

                const channel = guild.channels.cache.get(config.Channel);
                if (!channel) continue;

                const daysLeft = daysUntil(10, 31);
                const isHalloweenDay = todayMonth === 10 && today === 31;

                const spooky = getHalloweenMessage(daysLeft, isHalloweenDay);

                const embed = new EmbedBuilder()
                    .setColor("Orange")
                    .setTitle(spooky.title)
                    .setDescription(spooky.description)
                    .setFooter({ text: spooky.footer })
                    .setTimestamp();

                const ping = config.PingRole ? `<@&${config.PingRole}>` : "";
                await channel.send({ content: ping, embeds: [embed] });

                await halloweenSchema.updateOne(
                    { Guild: config.Guild },
                    { LastSentDay: today }
                );

                logStep('HALLOWEEN', `Countdown posted in guild ${guild.id}`, theme.green);
            }
        } catch (err) {
            logStep('HALLOWEEN', `ERROR: ${err}`, theme.red);
        }
    }));

    // -------------------------------
    // PREMIUM USER CHECK — DAILY
    // -------------------------------
    jobs.push(cron.schedule('0 6 * * *', async () => {
        try {
            const now = new Date();
            const all = await Premium.find({});
            const expired = all.filter(u => u.premium.expiresAt < now);

            for (const user of expired) {
                await Premium.deleteOne({ _id: user._id });
                logStep('PREMIUM', `Removed from user ${user.id}`, theme.yellow);
            }

            logStep('PREMIUM', 'Daily user check done.', theme.green);
        } catch (err) {
            logStep('PREMIUM', `Error: ${err}`, theme.red);
        }
    }));

    // -------------------------------
    // PREMIUM GUILD CHECK — DAILY
    // -------------------------------
    jobs.push(cron.schedule('0 6 * * *', async () => {
        try {
            const now = new Date();
            const all = await PremiumGuild.find({});
            const expired = all.filter(g => g.premium.expiresAt < now);

            for (const guild of expired) {
                await PremiumGuild.deleteOne({ _id: guild._id });
                logStep('PREMIUM GUILD', `Removed from guild ${guild.id}`, theme.yellow);
            }

            logStep('PREMIUM GUILD', 'Daily guild check done.', theme.green);
        } catch (err) {
            logStep('PREMIUM GUILD', `Error: ${err}`, theme.red);
        }
    }));

    // -------------------------------
    // GUILD COMMAND REFRESH — DAILY @ 00:00
    // -------------------------------
    // Ensures guild-scoped commands (both built-in enabled commands AND custom
    // commands) stay in sync with the database. Uses a single bulk PUT per guild
    // to atomically set the exact expected command list on Discord.
    jobs.push(cron.schedule("0 0 * * *", async () => {
        try {
            const rest = new REST({ version: "10" }).setToken(process.env.token);
            const appId = client.user?.id;
            if (!appId) return;

            let synced = 0;

            for (const guild of client.guilds.cache.values()) {
                try {
                    const body = [];

                    // Built-in commands are global — only this guild's custom commands are guild-scoped
                    // Custom commands (with arguments if available)
                    const customCommands = await customCommandSchema.find({ Guild: guild.id });
                    if (customCommands.length) {
                        const { argToDiscordOption } = require('../../Events/ready');
                        for (const cmd of customCommands) {
                            if (cmd.Enabled === false) continue;
                            const args = Array.isArray(cmd.Arguments) ? cmd.Arguments : [];
                            const sorted = [...args.filter(a => a.required), ...args.filter(a => !a.required)];
                            const payload = {
                                name:        cmd.Name.toLowerCase(),
                                description: cmd.Description || 'Custom server command',
                            };
                            if (sorted.length) payload.options = sorted.map(argToDiscordOption);
                            body.push(payload);
                        }
                    }

                    // 3. Only PUT if there's something to register
                    if (body.length) {
                        await rest.put(Routes.applicationGuildCommands(appId, guild.id), { body });
                        synced++;
                    }
                } catch { /* skip individual guild failures */ }
            }

            logStep('GUILD-CMD-REFRESH', `${synced} guild(s) synced.`, theme.green);
        } catch (err) {
            logStep('GUILD-CMD-REFRESH', `Error: ${err}`, theme.red);
        }
    }));

    // -------------------------------
    // <:boost:1567796953599836280> GIVEAWAY POLLER — EVERY 15 SECONDS
    // -------------------------------
    jobs.push(cron.schedule('*/15 * * * * *', async () => {
        try {
            const Giveaway = require('../../Schemas/giveawaySchema');

            // ── Stale giveaway cleanup ──────────────────────────────────────
            // FIX: Reduced from 1 hour to 2 minutes. The original 1-hour window
            // allowed up to 240 retry cycles (one per 15s) before a stuck
            // giveaway was swept up, each cycle firing a GET
            // /channels/:id/messages/:id per stuck record — the direct cause of
            // the rate limit storm. endGiveaway() already marks hasEnded:true
            // before touching Discord, so legitimate giveaways that end cleanly
            // are never retried at all. The 2-minute window only affects records
            // that crashed between the DB write and the Discord call, giving them
            // a single grace period before being declared done.
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const staleCount = await Giveaway.countDocuments({
                hasEnded: false,
                endTime: { $lte: twoMinutesAgo },
            });
            if (staleCount > 0) {
                await Giveaway.updateMany(
                    { hasEnded: false, endTime: { $lte: twoMinutesAgo } },
                    { $set: { hasEnded: true, drawnAt: new Date() } }
                );
                logStep('GIVEAWAY', `Cleaned up ${staleCount} stale giveaway(s) stuck past end time`, theme.yellow);
            }
            // ───────────────────────────────────────────────────────────────

            const overdue = await Giveaway.find({
                hasEnded: false,
                endTime: { $lte: new Date() },
            }).limit(20);

            for (const g of overdue) {
                try {
                    await endGiveaway(g.giveawayId, client);
                    logStep('GIVEAWAY', 'Ended giveaway: ' + g.giveawayId + ' in guild ' + g.guildId, theme.green);
                } catch (err) {
                    logStep('GIVEAWAY', 'Failed to end ' + g.giveawayId + ': ' + err.message, theme.red);
                }
            }
        } catch (err) {
            logStep('GIVEAWAY', 'Poller error: ' + err.message, theme.red);
        }
    }));

    // ─────────────────────────────────────────────────────────────────────────
    // QOTD — runs every minute, posts if schedule matches current HH:MM UTC
    // ─────────────────────────────────────────────────────────────────────────
    // FIX: Was outside module.exports at the bottom of the file. client,
    // logStep, and theme were all out of scope, so QOTD posting never worked.
    jobs.push(cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const hhmm = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
            const today = now.toISOString().slice(0, 10);

            const guilds = await QOTDSchema.find({ enabled: true, schedule: hhmm });
            for (const doc of guilds) {
                if (doc.lastPostedDate === today) continue; // already posted today
                try {
                    const guild = client.guilds.cache.get(doc.guildId);
                    if (!guild) continue;
                    const channel = guild.channels.cache.get(doc.channelId);
                    if (!channel) continue;
                    await postQOTD(doc, channel, guild, client);
                    logStep('QOTD', `Posted for guild ${doc.guildId}`, theme.cyan);
                } catch (e) {
                    logStep('QOTD', `Error for guild ${doc.guildId}: ${e.message}`, theme.red);
                }
            }
        } catch (err) {
            logStep('QOTD', `Cron error: ${err.message}`, theme.red);
        }
    }));

    logStep('CRON', 'All cron jobs scheduled successfully.', theme.green);

    // FIX: Return the job handle array so modules/index.js stop() can call
    // .stop() on each one when the cron module is restarted or shut down.
    // Without this return, client._cronJobs was always [], stop() was a no-op,
    // and every module restart created a duplicate set of pollers.
    return jobs;
};