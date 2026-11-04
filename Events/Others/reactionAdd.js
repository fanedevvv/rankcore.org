const { Events } = require('discord.js');
const Giveaway = require('../../Schemas/giveawaySchema');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, client) {
        if (user.bot) return;
        if (!reaction.message.guild) return;

        try {
            if (reaction.message.partial) await reaction.message.fetch();
            if (reaction.partial) await reaction.fetch();

            const messageId = reaction.message.id;
            const giveaway = await Giveaway.findOne({ messageId });
            // FIX: was giveaway.ended — the schema field is hasEnded, not ended.
            // giveaway.ended was always undefined (falsy), so this guard never
            // fired and every reaction on a past giveaway message was processed.
            if (!giveaway || giveaway.hasEnded) return;
            if (reaction.emoji.name !== giveaway.reaction) return;

            if (!giveaway.entrants.includes(user.id)) {
                giveaway.entrants.push(user.id);
                await giveaway.save();
                console.log(`[Giveaway Enter] User ${user.id} entered giveaway ${messageId}`);
            }
        } catch (err) {
            console.error('[Giveaway ReactionAdd Error]', err);
        }
    }
};