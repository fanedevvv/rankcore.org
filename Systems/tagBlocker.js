const { Events } = require("discord.js");
const BlockedTags = require("../Schemas/blockedTagsSchema");
const cache = require('../src/lib/cache');

module.exports = (client) => {
    client.on(Events.GuildMemberAdd, async (member) => {
        if (!member || member.user.bot) return;

        const data = await cache.wrap('tagblocker', `config:${member.guild.id}`,
          () => BlockedTags.findOne({ Guild: member.guild.id }).lean(), 60);
        if (!data || !data.Enabled || !data.Tags.length) return;

        const tag = member.user.username; // or member.user.tag for username#discriminator

        if (data.Tags.includes(tag)) {
            try {
                await member.ban({ reason: "Blocked guild tag detected" });
                console.log(`Banned ${member.user.tag} for blocked tag.`);
            } catch (err) {
                console.error(`Failed to ban ${member.user.tag}:`, err);
            }
        }
    });
};
