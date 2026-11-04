const { Events, EmbedBuilder } = require('discord.js');
const sticky = require('../../Schemas/stickySchema');

// Cooldown tracker: "guildId:channelId" -> timestamp of last sticky send
const stickyChannelCooldowns = new Map();
const STICKY_COOLDOWN_MS = 3000; // 3 seconds between sticky messages per channel

// Conversation detection: "guildId:channelId" -> array of recent message timestamps
const recentMessages = new Map();

/**
 * Returns true when the channel looks like an active conversation.
 * A "conversation" is defined as 3+ messages within the convoWindowMs window.
 */
function isActiveConversation(key, now, windowMs) {
    const CONVO_THRESHOLD = 3; // messages within the window = conversation
    let timestamps = recentMessages.get(key) || [];
    // Prune old entries
    timestamps = timestamps.filter(t => now - t < windowMs);
    timestamps.push(now);
    recentMessages.set(key, timestamps);
    return timestamps.length >= CONVO_THRESHOLD;
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (!message.guild || !message.channel) return;

        const data = await sticky.find({ Guild: message.guild.id, Channel: message.channel.id });
        if (data.length === 0) return;

        const now = Date.now();
        const cooldownKey = `${message.guild.id}:${message.channel.id}`;

        await Promise.all(data.map(async (value) => {
            // ── Bot-ignore check ──────────────────────────────────────────────
            // If IgnoreBots is true (default), messages from bots are completely
            // ignored — they don't increment the count and won't trigger a resend.
            if (message.author.bot && value.IgnoreBots !== false) return;

            // ── Conversation-detection check ──────────────────────────────────
            // Track message timestamps for this channel regardless of which sticky
            // we're processing; the map key is shared across all stickies in the
            // channel so we only need one set of timestamps per channel.
            if (value.ConvoDetection) {
                const windowMs = value.ConvoWindowMs ?? 8000;
                if (isActiveConversation(cooldownKey, now, windowMs)) {
                    // Active conversation — reset counter but don't send
                    value.Count = 0;
                    await value.save();
                    return;
                }
            }

            // ── Cap counting ──────────────────────────────────────────────────
            if (value.Count < value.Cap - 1) {
                value.Count++;
                await value.save();
                return;
            }

            // ── Cooldown check ────────────────────────────────────────────────
            const lastSent = stickyChannelCooldowns.get(cooldownKey) ?? 0;
            if (now - lastSent < STICKY_COOLDOWN_MS) {
                value.Count = 0;
                await value.save();
                return;
            }

            stickyChannelCooldowns.set(cooldownKey, now);

            // ── Delete previous sticky ────────────────────────────────────────
            if (value.LastMessageId) {
                try {
                    const oldMsg = message.channel.messages.cache.get(value.LastMessageId)
                        ?? await message.channel.messages.fetch(value.LastMessageId).catch(() => null);
                    if (oldMsg) await oldMsg.delete().catch(() => {});
                } catch (_) {}
            }

            // ── Send sticky ───────────────────────────────────────────────────
            let sent;
            if (value.UseEmbed === false) {
                sent = await message.channel.send({ content: value.Message });
            } else {
                const embedColor = value.EmbedColor || client.config?.embedColor || '#6C53FF';
                const embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setDescription(`> ${value.Message}`)
                    .setTimestamp();
                sent = await message.channel.send({ embeds: [embed] });
            }

            value.LastMessageId = sent.id;
            value.Count = 0;
            await value.save();
        }));
    }
};