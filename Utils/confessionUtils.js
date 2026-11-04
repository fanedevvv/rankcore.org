const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    StringSelectMenuBuilder,
} = require('discord.js');
const { parseEmoji } = require('./emojis');
const confessionConfig = require('../Schemas/confession');

// ── Shared cooldown map ───────────────────────────────────────────────────────
const cooldowns = new Map();

// ── Word filter ───────────────────────────────────────────────────────────────
function containsBlockedWord(text, blockedWords) {
    if (!blockedWords || blockedWords.length === 0) return false;
    const lower = text.toLowerCase();
    return blockedWords.some(word => lower.includes(word.toLowerCase()));
}

// ── Build the confession embed ────────────────────────────────────────────────
function buildConfessionEmbed(config, confessionText, number) {
    const title = config.ShowConfessionNumber && number
        ? `${config.ConfessionTitle || '<:suggestion:1555544601501237322> Anonymous Confession'} #${number}`
        : (config.ConfessionTitle || '<:suggestion:1555544601501237322> Anonymous Confession');

    const color = config.ConfessionColor || '#5865F2';

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(confessionText)
        .setColor(color)
        .setTimestamp();

    if (config.ConfessionFooter) {
        embed.setFooter({ text: config.ConfessionFooter });
    }

    return embed;
}

// ── Build confession action buttons ──────────────────────────────────────────
function buildConfessionButtons(msgId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('reply_confession')
            .setLabel('Reply Anonymously')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('↩️'),
        new ButtonBuilder()
            .setCustomId('new_confession')
            .setLabel('Send Your Own')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(parseEmoji('<:files:1555544445565407352>')),
        new ButtonBuilder()
            .setCustomId(`report_confession_${msgId || 'pending'}`)
            .setLabel('Report')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(parseEmoji('<:restrict:1555544549105999962>')),
    );
}

// ── Build admin action buttons (posted onto confession message by mods) ───────
function buildAdminButtons(confessionMsgId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`admin_delete_${confessionMsgId}`)
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(parseEmoji('<:del:1555544395720302643>')),
    );
}

// ── Core post function ────────────────────────────────────────────────────────
/**
 * Post a confession to the confession channel (or a category-specific override).
 * Handles: numbering, reactions, thread creation, pings, DM notifications.
 *
 * @param {Interaction} interaction - The source interaction (for replying)
 * @param {string}      confessionText
 * @param {object}      [opts]
 * @param {string}      [opts.categoryChannel] - Channel ID override
 * @param {string}      [opts.userId]          - Submitter ID for DM on approve
 * @param {boolean}     [opts.skipCooldown]    - Skip setting cooldown (e.g. from review approval)
 */
async function postConfession(interaction, confessionText, opts = {}) {
    const guildId   = interaction.guild?.id || interaction.guildId;
    const config    = await confessionConfig.findOne({ Guild: guildId });
    if (!config) return;

    // Increment counter
    config.ConfessionCount = (config.ConfessionCount || 0) + 1;
    config.TotalPosted     = (config.TotalPosted     || 0) + 1;
    await config.save();

    const confessionNumber = config.ConfessionCount;

    // Resolve channel
    const channelId     = opts.categoryChannel || config.ConfessionChannel;
    const confessionChan = interaction.guild.channels.cache.get(channelId);

    if (!confessionChan) {
        const msg = 'Confession channel is missing. Please contact an admin.';
        if (!interaction.replied && !interaction.deferred) {
            return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        }
        return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    }

    // Cooldown (skip for trusted users unless opts.skipCooldown explicitly false)
    const userId        = opts.userId || interaction.user?.id;
    const isTrusted     = config.TrustedUsers?.includes(userId);
    const cooldownMs    = (config.CooldownSeconds || 60) * 1000;

    if (!opts.skipCooldown && !isTrusted) {
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), cooldownMs);
    }

    // Build + send embed
    const embed   = buildConfessionEmbed(config, confessionText, confessionNumber);
    const pingContent = config.ConfessionPingRole ? `<@&${config.ConfessionPingRole}>` : null;

    const sentMsg = await confessionChan.send({
        content:    pingContent,
        embeds:     [embed],
        components: [buildConfessionButtons('pending')],
    });

    // Update report button with real message ID
    try {
        await sentMsg.edit({
            components: [buildConfessionButtons(sentMsg.id)],
        });
    } catch { /* non-critical */ }

    // Auto-react
    if (config.ReactionsEnabled && config.ReactionEmojis?.length > 0) {
        for (const emoji of config.ReactionEmojis.slice(0, 5)) {
            await sentMsg.react(emoji).catch(() => {});
            await new Promise(r => setTimeout(r, 300));
        }
    }


    // Thread replies
    if (config.ThreadReplies) {
        await sentMsg.startThread({
            name: `Confession #${confessionNumber} — Replies`,
            autoArchiveDuration: 1440,
        }).catch(() => {});
    }

    // DM submitter on approval (store userId in embed footer if not visible)
    // We encode userId invisibly in the embed for later DM use
    // (Only relevant when this is direct post, not review path)

    // Log event
    interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION POSTED',
        `Confession #${confessionNumber} posted.\nContent: \`${confessionText.slice(0, 100)}${confessionText.length > 100 ? '…' : ''}\``
    );

    // Reply to user
    const replyMsg = `<a:tickyy:1555544712687915008> Your confession (#${confessionNumber}) has been posted anonymously!`;
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: replyMsg, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.followUp({ content: replyMsg, flags: MessageFlags.Ephemeral });
        }
    } catch { /* interaction may have already been handled */ }
}

// ── Send to review ────────────────────────────────────────────────────────────
/**
 * Route a confession to the review channel.
 * Stores submitter ID for optional DM notifications.
 */
async function sendToReview(interaction, confessionText, config, opts = {}) {
    const reviewChan = interaction.guild.channels.cache.get(config.ReviewChannel);
    if (!reviewChan) {
        return interaction.reply({ content: 'Review channel is missing. Please contact an admin.', flags: MessageFlags.Ephemeral });
    }

    const userId = opts.userId || interaction.user?.id;

    const embed = new EmbedBuilder()
        .setTitle('<:files:1555544445565407352> Confession Pending Review')
        .setDescription(confessionText)
        .setColor('Yellow')
        .setTimestamp();

    // Store submitter ID for DM notifications (hidden in footer when anonymous)
    if (!config.AnonymousReview) {
        const submitter = await interaction.guild.members.fetch(userId).catch(() => null);
        embed.setFooter({ text: `Submitted by ${submitter?.user.tag || userId} (${userId})` });
    } else {
        // Encode submitter ID invisibly for DM use on approve/deny
        embed.setFooter({ text: `submitter:${userId}` });
    }

    // Category tag
    if (opts.categoryLabel) {
        embed.addFields({ name: 'Category', value: opts.categoryLabel, inline: true });
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('approve_confession').setLabel('Approve').setStyle(ButtonStyle.Success).setEmoji(parseEmoji('<a:tickyy:1555544712687915008>')),
        new ButtonBuilder().setCustomId('deny_confession').setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji(parseEmoji('<:crossy:1555544390221562048>')),
        new ButtonBuilder().setCustomId('edit_confession').setLabel('Edit & Approve').setStyle(ButtonStyle.Secondary).setEmoji(parseEmoji('<:files:1555544445565407352>')),
    );

    const pingContent = config.ReviewPingRole
        ? `<@&${config.ReviewPingRole}> A new confession is awaiting review!`
        : undefined;

    const reviewMsg = await reviewChan.send({ content: pingContent, embeds: [embed], components: [row] });

    // Auto-approve timer
    if (config.AutoApproveAfterMs > 0) {
        setTimeout(async () => {
            try {
                const msg = reviewChan.messages.cache.get(reviewMsg.id) ?? await reviewChan.messages.fetch(reviewMsg.id).catch(() => null);
                if (!msg) return; // already handled
                const freshConfig = await confessionConfig.findOne({ Guild: interaction.guild.id });
                await postConfession(interaction, confessionText, { skipCooldown: true, userId });
                await msg.delete().catch(() => {});
                interaction.client.emit('confessionLog', interaction.guild, freshConfig, 'AUTO-APPROVED',
                    `Confession auto-approved after ${Math.round(config.AutoApproveAfterMs / 60000)} minutes.`
                );
            } catch { /* message deleted, already handled */ }
        }, config.AutoApproveAfterMs);
    }

    interaction.client.emit('confessionLog', interaction.guild, config, 'CONFESSION SUBMITTED FOR REVIEW',
        `Submitted by user ID \`${userId}\`. Content: \`${confessionText.slice(0, 100)}${confessionText.length > 100 ? '…' : ''}\``
    );

    const replyMsg = '<:files:1555544445565407352> Your confession has been submitted for review. You will be notified when it is approved or denied.';
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: replyMsg, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.followUp({ content: replyMsg, flags: MessageFlags.Ephemeral });
        }
    } catch { /* handled */ }
}

// ── DM submitter ──────────────────────────────────────────────────────────────
async function dmSubmitter(client, userId, guildName, approved, reason) {
    try {
        const user = await client.users.fetch(userId);
        if (!user) return;
        await user.send({
            embeds: [new EmbedBuilder()
                .setTitle(approved ? '<a:tickyy:1555544712687915008> Confession Approved' : '<:crossy:1555544390221562048> Confession Denied')
                .setDescription(approved
                    ? `Your confession in **${guildName}** has been approved and posted.`
                    : `Your confession in **${guildName}** was denied.${reason ? `\n**Reason:** ${reason}` : ''}`)
                .setColor(approved ? 'Green' : 'Red')
                .setTimestamp()
            ],
        });
    } catch { /* user may have DMs disabled */ }
}

// ── Check cooldown ────────────────────────────────────────────────────────────
function checkCooldown(userId, config) {
    if (!cooldowns.has(userId)) return null;
    const expiry  = cooldowns.get(userId) + ((config.CooldownSeconds || 60) * 1000);
    const timeLeft = Math.ceil((expiry - Date.now()) / 1000);
    return timeLeft > 0 ? timeLeft : null;
}

// ── Validate confession ───────────────────────────────────────────────────────
/**
 * Returns null if valid, or an error string.
 */
function validateConfession(text, config, userId) {
    if (!text || !text.trim()) return 'Confession cannot be empty.';

    if (text.length < (config.MinConfessionLength || 10)) {
        return `Confession must be at least ${config.MinConfessionLength} characters.`;
    }
    if (text.length > (config.MaxConfessionLength || 2000)) {
        return `Confession exceeds the maximum length of ${config.MaxConfessionLength} characters.`;
    }
    if (config.Blacklist?.includes(userId)) {
        return 'You are blacklisted and cannot submit confessions.';
    }

    // Required roles check is handled at call site (needs member object)

    return null;
}

module.exports = {
    cooldowns,
    postConfession,
    sendToReview,
    dmSubmitter,
    checkCooldown,
    validateConfession,
    containsBlockedWord,
    buildConfessionEmbed,
    buildConfessionButtons,
    buildAdminButtons,
    // Keep backward compat
    CONFESSION_COOLDOWN_MS: 60000,
};