const { Events } = require('discord.js');
const reactions = require("../Schemas/reactionrole.js");

/**
 * Resolves the emoji ID string used in the DB for both animated and static custom
 * emojis as well as plain unicode/default emojis.
 */
function resolveEmojiId(emoji) {
    if (!emoji.id) return emoji.name; // unicode emoji
    if (emoji.animated) return `<a:${emoji.name}:${emoji.id}>`;
    return `<:${emoji.name}:${emoji.id}>`;
}

async function handleReactionAdd(reaction, user) {
    if (user.bot) return;

    // Fetch partial reaction/message so guildId and content are available
    if (reaction.partial) {
        try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    if (!reaction.message.guildId) return;

    const cID = resolveEmojiId(reaction.emoji);

    const data = await reactions.findOne({
        Guild: reaction.message.guildId,
        Message: reaction.message.id,
        Emoji: cID,
    });

    if (!data) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    let member = guild.members.cache.get(user.id);
    if (!member) {
        try { member = await guild.members.fetch(user.id); } catch { return; }
    }
    if (!member) return;

    try {
        await member.roles.add(data.Role);
    } catch (e) {
        console.log("Error adding role!", e.message);
    }
}

async function handleReactionRemove(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
        try { reaction = await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
    }

    if (!reaction.message.guildId) return;

    const cID = resolveEmojiId(reaction.emoji);

    const data = await reactions.findOne({
        Guild: reaction.message.guildId,
        Message: reaction.message.id,
        Emoji: cID,
    });

    if (!data) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    let member = guild.members.cache.get(user.id);
    if (!member) {
        try { member = await guild.members.fetch(user.id); } catch { return; }
    }
    if (!member) return;

    try {
        await member.roles.remove(data.Role);
    } catch (e) {
        console.log("Error removing role!", e.message);
    }
}

module.exports = (client) => {
    client.on(Events.MessageReactionAdd,    handleReactionAdd);
    client.on(Events.MessageReactionRemove, handleReactionRemove);
};

/**
 * Credits: Arpan | @arpandevv
 * Buy: https://razorbot.buzz/buy
 */