const ALWAYS_ON = new Set(['help', 'report', 'redeem', 'premium']); // can't be switched off per server
const { runWithInteraction } = require('../../../Utils/componentExpiry');
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors
} = require("discord.js");
const { isDead } = require('./safeInteraction');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_not_configured');
const getOwners = require("../../../Utils/getOwners");
const blacklistDB = require("../../../Schemas/blacklistSchema");
const customCommandSchema = require("../../../Schemas/customCommandSchema");
const GuildCommands       = require("../../../Schemas/Guildcommandsschema");
const { logGuildError }   = require("../../../Utils/logGuildError");

const {
    globalCooldown,
    spamMap,
    GLOBAL_COOLDOWN_TIME,
    SPAM_LIMIT,
    SPAM_INTERVAL
} = require("./state");

const {
    isUserPremium,
    isGuildPremium,
    getPermissionName
} = require("./utils");

// ==========================================================
// Helper: Fire-and-forget webhook POST
// ==========================================================
async function postWebhook(url, payload) {
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('[postWebhook] Failed to send webhook:', err.message);
    }
}

module.exports = async function handleSlashCommand(interaction, client) {
    const { commandName, user, guild } = interaction;
    const userId   = user.id;

    // Guard: most commands require a guild context — DM interactions have guild = null
    if (!guild) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Orange)
                    .setTitle("Server Only")
                    .setDescription("This bot's commands can only be used inside a server, not in DMs.")
                    .setTimestamp()
            ],
            ephemeral: true
        });
    }
    const ownerIds = await getOwners();

    // ── Whole-module guard (slash-commands module stopped/disabled) ───────────
    const mgr = client.moduleManager;
    if (mgr && !ownerIds.includes(userId)) {
        const modState = mgr._modules.get('slash-commands')?.state;
        if (modState === 'stopped' || modState === 'disabled') {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Orange)
                        .setTitle("Commands Temporarily Unavailable")
                        .setDescription(
                            `Slash commands are currently **${modState}**.\n\n` +
                            `Please check back shortly.`
                        )
                        .setFooter({ text: 'Module state: ' + modState })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }
    }

    // ── Per-command granular guard ─────────────────────────────────────────────
    const granular = client.granularManager;
    if (granular && !ownerIds.includes(userId)) {
        if (!granular.isCommandEnabled(commandName)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Orange)
                        .setTitle("Command Disabled")
                        .setDescription(
                            `The command \`${commandName}\` has been **disabled** by a developer.\n\n` +
                            `Please check back later.`
                        )
                        .setFooter({ text: 'Contact a developer if you think this is a mistake.' })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }
    }

    // -- Spam Detection --
    const spamData = spamMap.get(userId) || { count: 0, timeout: null };

    if (spamData.count >= SPAM_LIMIT) {
        await blacklistDB.create({
            userId,
            reason: `spamming (${commandName})`
        });

        spamMap.delete(userId);

        // <:error:1567796968758050868> Alert: user auto-blacklisted for spam
        sendAlert('auto-blacklist', { interaction, commandName, spamCount: spamData.count }, client);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle("Blacklisted")
                    .setDescription(
                        `You have been blacklisted for spamming commands.\n\n` +
                        `**Command:** \`${commandName}\`\n` +
                        `**Reason:** Excessive spam detected\n` +
                        `**Action:** Your account has been permanently blocked from using this bot.`
                    )
                    .setFooter({ text: "Contact support if you believe this is a mistake" })
                    .setTimestamp()
            ],
            ephemeral: true
        });
    }

    spamData.count++;

    if (!spamData.timeout) {
        spamData.timeout = setTimeout(
            () => spamMap.delete(userId),
            SPAM_INTERVAL
        );
    }

    spamMap.set(userId, spamData);

    // -- Global Cooldown --
    if (!ownerIds.includes(userId)) {
        const now        = Date.now();
        const expiration = globalCooldown.get(userId);

        if (expiration && expiration > now) {
            const remainingSeconds = Math.ceil((expiration - now) / 1000);
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Gold)
                        .setTitle("Cooldown Active")
                        .setDescription(
                            `You're using commands too quickly!\n\n` +
                            `**Time Remaining:** \`${remainingSeconds}s\`\n` +
                            `**Command:** \`${commandName}\`\n\n` +
                            `Please wait before executing another command.`
                        )
                        .setFooter({ text: "Global cooldown applies to all commands" })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        globalCooldown.set(userId, now + GLOBAL_COOLDOWN_TIME);
    }

    // -- Guild Command Gate --
    // Every command is on by default. A server manager can switch commands off in the
    // dashboard (Command Manager), which stores them in disabledCommands.
    if (!ALWAYS_ON.has(commandName) && !ownerIds.includes(userId) && !client._isCBClient) {
        const guildCmds = await GuildCommands.findOne({ guildId: guild.id }, { disabledCommands: 1 }).lean();
        if (guildCmds?.disabledCommands?.includes(commandName)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Orange)
                        .setTitle("Command Disabled")
                        .setDescription(
                            `\`/${commandName}\` has been turned off in this server.\n\n` +
                            `A server manager can turn it back on in the **Dashboard** → Command Manager.`
                        )
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }
    }

    // -- Custom Commands --
    const customCmd = await customCommandSchema.findOne({
        Guild: guild.id,
        Name:  commandName.toLowerCase()
    });

    if (customCmd)
        return executeCustomCommand(interaction, customCmd, client);

    // -- Standard Commands --
    const command = client.commands.get(commandName);
    if (!command) return;

    // ─── Premium gate ────────────────────────────────────────────────────────
    if (command.premium) {
        const { meetsMinTierForInteraction } = require('./utils');
        // command.premiumTier: 'basic' | 'pro' | 'elite'  (defaults to 'basic')
        const requiredTier = command.premiumTier ?? 'basic';
        const allowed = await meetsMinTierForInteraction(userId, guild.id, requiredTier);

        if (!allowed) {
            const TIER_NAMES  = { basic: '<:boost:1567796953599836280> Basic', pro: '<:eco:1567796967197900842> Pro', elite: '<:1430986209995526274:1567796911350747206> Elite' };
            const TIER_COLORS = { basic: 0x3b82f6, pro: 0xa855f7, elite: 0xf59e0b };

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${TIER_NAMES[requiredTier]} Required`)
                        .setColor(TIER_COLORS[requiredTier] ?? 0xa855f7)
                        .setDescription(
                            `**\`/${commandName}\`** requires **RankCore ${TIER_NAMES[requiredTier]}** or higher.\n\n` +
                            `Upgrade your plan to unlock this command and many more powerful features.`
                        )
                        .addFields({
                            name: '<:n_add:1567796983408754731> Get Premium',
                            value: `Use \`/premium plans\` to see all plans, or visit the premium page to subscribe.`,
                        })
                        .setFooter({ text: 'Premium · Cancel anytime' })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }
    }

    if (command.developer && !ownerIds.includes(userId)) {
        // <:lockk:1567796977809367122> Alert: non-dev probing a developer-only command
        sendAlert('dev-blocked', { interaction, commandName }, client);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle("Developer Only")
                    .setDescription(
                        `This command is restricted to developers only.\n\n` +
                        `**Command:** \`${commandName}\`\n` +
                        `**Access Level:** Developer\n` +
                        `**Your Access:** User\n\n` +
                        `Only the bot developers can execute this command.`
                    )
                    .setFooter({ text: "If you believe this is an error, contact support" })
                    .setTimestamp()
            ],
            ephemeral: true
        });
    }


    if (command.dev)
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Yellow)
                    .setTitle("Under Maintenance")
                    .setDescription(
                        `This command is currently under maintenance.\n\n` +
                        `**Command:** \`${commandName}\`\n` +
                        `**Status:** Disabled\n` +
                        `**Reason:** Maintenance in progress\n\n` +
                        `Please check back later when the command is available.`
                    )
                    .setFooter({ text: "We're working hard to bring you updates!" })
                    .setTimestamp()
            ],
            ephemeral: true
        });

    // <a:tickyy:1567797045253644368> Alert: successful command execution
    sendAlert('command', { interaction, command }, client);

    try {
        await runWithInteraction(interaction, () => command.execute(interaction, client));
    } catch (err) {
        if (err?.code === 10062) return;

        // <:fire:1567796972125945888> Alert: unhandled command error
        sendAlert('error', { interaction, commandName, err }, client);

        console.error(`[slash] execute error in ${commandName}:`, err);
        logGuildError(guild?.id, `slash:${commandName}`, err, { userId, commandName });
        const payload = { embeds: [
            new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('Something went wrong')
                .setDescription('An unexpected error occurred. Please try again.')
                .setTimestamp()
        ], ephemeral: true };
        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
            else await interaction.reply(payload);
        } catch { /* interaction already gone */ }
    }
};

// ==========================================================
// Helper: Custom Command Execution
// ==========================================================
async function executeCustomCommand(interaction, customCmd, client) {
    await interaction.deferReply().catch(() => {});

    if (
        customCmd.RequiredPermission &&
        !interaction.member.permissions.has(customCmd.RequiredPermission)
    ) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle("Insufficient Permissions")
                    .setDescription(
                        `You lack the required permission to use this command.\n\n` +
                        `**Command:** \`${customCmd.Name}\`\n` +
                        `**Required Permission:** \`${getPermissionName(customCmd.RequiredPermission)}\`\n\n` +
                        `Ask a server administrator to grant you this permission.`
                    )
                    .setFooter({ text: "Permission check failed" })
                    .setTimestamp()
            ]
        });
    }

    let response = customCmd.Response
        .replace(/{user}/g,  interaction.user.toString())
        .replace(/{guild}/g, interaction.guild.name);

    if (customCmd.Options) {
        customCmd.Options.forEach((opt, idx) => {
            response = response.replace(
                new RegExp(`{arg${idx + 1}}`, 'g'),
                interaction.options.getString(opt.name) || ''
            );
        });
    }

    if (customCmd.IsEmbed) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(client.config.embedColor || Colors.Blurple)
                    .setDescription(response)
                    .setFooter({ text: customCmd.Name })
                    .setTimestamp()
            ]
        });
    }

    return interaction.editReply({ content: response });
}

// ==========================================================
// Central Alert Dispatcher
// Routes an embed to the webhook (always) and to the RankCore
// logging channel (when not a CB bot).
// Exported so blacklist.js can also fire alerts.
// ==========================================================
function sendAlert(type, data, client) {
    const embed = buildAlertEmbed(type, data, client);
    if (!embed) return;

    // ── Determine webhook URL for this alert type ────────────────────────────
    // USAGE_LOG_WEBHOOK  → command uses + button presses
    // BOT_ALERT_WEBHOOK  → errors, blacklists, dev-blocks, operational alerts
    // CB bots use CB_USAGE_LOG_WEBHOOK / CB_ALERT_WEBHOOK if set, falling back
    // to the main bot's vars.
    const isUsageLog   = type === 'command' || type === 'button';
    const webhookUrl   = client._isCBClient
        ? (isUsageLog
            ? (process.env.CB_USAGE_LOG_WEBHOOK  || process.env.USAGE_LOG_WEBHOOK)
            : (process.env.CB_ALERT_WEBHOOK       || process.env.BOT_ALERT_WEBHOOK))
        : (isUsageLog
            ? process.env.USAGE_LOG_WEBHOOK
            : process.env.BOT_ALERT_WEBHOOK);

    // Send to webhook (works for all types including command/button)
    if (webhookUrl) {
        postWebhook(webhookUrl, { embeds: [embed.toJSON()] });
    }

    // Also send to the configured in-Discord log channel (non-CB bots only)
    if (!client._isCBClient) {
        const logChannelId = isUsageLog
            ? (type === 'button'
                ? (client.config?.buttonLoggingChannel || client.config?.slashCommandLoggingChannel)
                : client.config?.slashCommandLoggingChannel)
            : client.config?.slashCommandLoggingChannel;
        const channel = client.channels.cache.get(logChannelId);
        if (channel) channel.send({ embeds: [embed] }).catch(() => {});
    }
}

module.exports.sendAlert = sendAlert;

// ==========================================================
// Alert Embed Builders — one case per alert type
// ==========================================================
function buildAlertEmbed(type, data, client) {
    const isCB  = !!client._isCBClient;
    const cbTag = isCB ? ` [CB: ${client._cbGuildId ?? '?'}]` : '';

    switch (type) {

        // ── <a:tickyy:1567797045253644368> Successful command execution ───────────────────────────────────
        case 'command': {
            const { interaction, command } = data;
            const cmdStr     = getCommandString(interaction);
            const optionsStr = getOptionsString(interaction);

            const embed = new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`Command Executed${cbTag}`)
                .setColor(client.config?.embedColor || Colors.Blurple)
                .addFields(
                    {
                        name: '<:user:1567797032423264261> User',
                        value: `${interaction.user} \`${interaction.user.id}\`\nCreated: <t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`,
                        inline: true
                    },
                    {
                        name: '<:n_home:1567796990148878446> Server',
                        value: `**${interaction.guild.name}**\n\`${interaction.guild.id}\` • ${interaction.guild.memberCount} members`,
                        inline: true
                    },
                    {
                        name: '<:javascript:1567796975502364742> Command',
                        value: `\`/${cmdStr}\`\nCategory: ${command?.category || 'Unknown'}`,
                        inline: false
                    }
                );

            if (optionsStr)
                embed.addFields({ name: '<:n_utils:1567796996830658573> Options', value: optionsStr, inline: false });

            if (command) {
                const props = [];
                if (command.premium)   props.push('<:boost:1567796953599836280> Premium');
                if (command.developer) props.push('<:lockk:1567796977809367122> Developer');
                if (command.dev)       props.push('<:error:1567796968758050868> Maintenance');
                if (props.length)
                    embed.addFields({ name: '<:thread:1567797010692706324> Flags', value: props.join(' • '), inline: false });
            }

            return embed
                .setFooter({ text: `#${interaction.channel.name} • ${interaction.id}` })
                .setTimestamp();
        }

        // ── <:error:1567796968758050868> User auto-blacklisted for command spam ─────────────────────────
        case 'auto-blacklist': {
            const { interaction, commandName, spamCount } = data;
            return new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`User Auto-Blacklisted${cbTag}`)
                .setColor(Colors.DarkRed)
                .addFields(
                    {
                        name: '<:user:1567797032423264261> User',
                        value: `${interaction.user} \`${interaction.user.id}\``,
                        inline: true
                    },
                    {
                        name: '<:n_home:1567796990148878446> Server',
                        value: `**${interaction.guild.name}** \`${interaction.guild.id}\``,
                        inline: true
                    },
                    {
                        name: '<:thunderr:1567797012991189134> Trigger',
                        value: `\`/${commandName}\` — hit spam limit (${spamCount} rapid commands)`,
                        inline: false
                    },
                    {
                        name: '<:dot:1567796963624226826> Action Taken',
                        value: 'Permanently blacklisted from all bot interactions.',
                        inline: false
                    }
                )
                .setFooter({ text: 'Review in the dev panel if this was a mistake' })
                .setTimestamp();
        }

        // ── <:restrict:1567797003638022166> Blacklisted user blocked from interacting ─────────────────────
        case 'blacklist-blocked': {
            const { interaction, reason } = data;
            return new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`Blacklisted User Blocked${cbTag}`)
                .setColor(Colors.DarkOrange)
                .addFields(
                    {
                        name: '<:user:1567797032423264261> User',
                        value: `${interaction.user} \`${interaction.user.id}\``,
                        inline: true
                    },
                    {
                        name: '<:n_home:1567796990148878446> Server',
                        value: `**${interaction.guild?.name ?? 'DM'}** \`${interaction.guild?.id ?? 'N/A'}\``,
                        inline: true
                    },
                    {
                        name: '<:files:1567796970964394044> Blacklist Reason',
                        value: reason || 'No reason recorded',
                        inline: false
                    },
                    {
                        name: '<:thunderr:1567797012991189134> Interaction Attempted',
                        value: `\`/${interaction.commandName ?? interaction.customId ?? 'unknown'}\``,
                        inline: false
                    }
                )
                .setFooter({ text: 'No action needed — blocked automatically' })
                .setTimestamp();
        }

        // ── <:lockk:1567796977809367122> Non-developer probed a developer-only command ──────────────────
        case 'dev-blocked': {
            const { interaction, commandName } = data;
            return new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`Developer Command Probe${cbTag}`)
                .setColor(Colors.Yellow)
                .addFields(
                    {
                        name: '<:user:1567797032423264261> User',
                        value: `${interaction.user} \`${interaction.user.id}\``,
                        inline: true
                    },
                    {
                        name: '<:n_home:1567796990148878446> Server',
                        value: `**${interaction.guild.name}** \`${interaction.guild.id}\``,
                        inline: true
                    },
                    {
                        name: '<:restrict:1567797003638022166> Command Attempted',
                        value: `\`/${commandName}\``,
                        inline: false
                    }
                )
                .setFooter({ text: 'User was denied — access logged' })
                .setTimestamp();
        }

        // ── <:fire:1567796972125945888> Unhandled command error / crash ────────────────────────────────
        case 'error': {
            const { interaction, commandName, err } = data;
            const stack = err?.stack
                ? err.stack.split('\n').slice(0, 5).join('\n')
                : String(err);

            return new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`Command Error${cbTag}`)
                .setColor(Colors.Red)
                .addFields(
                    {
                        name: '<:javascript:1567796975502364742> Command',
                        value: `\`/${commandName}\``,
                        inline: true
                    },
                    {
                        name: '<:user:1567797032423264261> User',
                        value: `${interaction.user} \`${interaction.user.id}\``,
                        inline: true
                    },
                    {
                        name: '<:n_home:1567796990148878446> Server',
                        value: `**${interaction.guild?.name}** \`${interaction.guild?.id}\``,
                        inline: true
                    },
                    {
                        name: '<:crossy:1567796959648030831> Error Message',
                        value: `\`\`\`${String(err?.message || err).slice(0, 900)}\`\`\``,
                        inline: false
                    },
                    {
                        name: '<:files:1567796970964394044> Stack Trace',
                        value: `\`\`\`${stack.slice(0, 900)}\`\`\``,
                        inline: false
                    }
                )
                .setFooter({ text: `#${interaction.channel?.name ?? 'unknown'} • ${interaction.id}` })
                .setTimestamp();
        }

        // ── <:n_utils:1567796996830658573>️ Button interaction (from main bot or CB bot) ───────────────────
        case 'button': {
            const { interaction } = data;
            const isCBTag = isCB ? ` [CB: ${client._cbGuildId ?? '?'}]` : '';
            return new EmbedBuilder()
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setTitle(`Button Used${isCBTag}`)
                .setColor(client.config?.embedColor || Colors.Blurple)
                .addFields(
                    {
                        name: '<:user:1567797032423264261> User',
                        value: `${interaction.user} \`${interaction.user.id}\``,
                        inline: true,
                    },
                    {
                        name: '<:n_home:1567796990148878446> Server',
                        value: `**${interaction.guild.name}**\n\`${interaction.guild.id}\` • ${interaction.guild.memberCount} members`,
                        inline: true,
                    },
                    {
                        name: '<:dot:1567796963624226826> Button ID',
                        value: `\`${interaction.customId}\``,
                        inline: false,
                    }
                )
                .setFooter({ text: `#${interaction.channel?.name ?? 'unknown'} • ${interaction.id}` })
                .setTimestamp();
        }

        default:
            return null;
    }
}

// ==========================================================
// Helpers
// ==========================================================
function getOptionsString(interaction) {
    const options = interaction.options.data;
    if (!options?.length) return '';
    return options.map(opt => {
        const value = opt.value !== undefined
            ? opt.value
            : (opt.options?.length ? `[${opt.options.map(o => o.name).join(', ')}]` : 'N/A');
        return `**${opt.name}:** \`${value}\``;
    }).join('\n');
}

function getCommandString(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand(false);
    return group
        ? `${interaction.commandName} > ${group} > ${sub || ''}`
        : sub
            ? `${interaction.commandName} > ${sub}`
            : interaction.commandName;
}