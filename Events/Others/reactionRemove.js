const { Events } = require('discord.js');
const Giveaway = require('../../Schemas/giveawaySchema');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user, client) {
        if (user.bot) return;
        if (!reaction.message.guild) return;

        try {
            if (reaction.message.partial) await reaction.message.fetch();
            if (reaction.partial) await reaction.fetch();

            const messageId = reaction.message.id;
            const giveaway = await Giveaway.findOne({ messageId });
            if (!giveaway || giveaway.ended) return;
            if (reaction.emoji.name !== giveaway.reaction) return;

            if (giveaway.winnerIds.includes(user.id)) {
                giveaway.winnerIds = giveaway.winnerIds.filter(id => id !== user.id);
                await giveaway.save();
                console.log(`[Giveaway Leave] User ${user.id} left giveaway ${messageId}`);
            }
        } catch (err) {
            console.error('[Giveaway ReactionRemove Error]', err);
        }
    }
};
