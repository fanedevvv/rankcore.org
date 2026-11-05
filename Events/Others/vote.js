// events/vote.js
const { EmbedBuilder } = require('discord.js');

module.exports = async (vote, client) => {
    try {
        // Fetch the user who voted
        const user = await client.users.fetch(vote.user).catch(() => null);
        if (user) {
            // DM the user
            const dmEmbed = new EmbedBuilder()
                .setTitle('<:boost:1567796953599836280> Thanks for Voting!')
                .setDescription('Thanks for supporting the bot! You have unlocked special perks.')
                .setColor('Green')
                .setTimestamp();
            user.send({ embeds: [dmEmbed] }).catch(() => console.log(`Cannot DM ${user.tag}`));
        }

        // Log in the dev channel
        const logChannel = client.channels.cache.get('1380212495351812237');
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('<a:votes:1567797046562259015> New Vote!')
                .setDescription(`User <@${vote.user}> just voted for the bot.`)
                .setColor('Blue')
                .setTimestamp();
            logChannel.send({ embeds: [logEmbed] });
        }
    } catch (err) {
        console.error('Error handling vote event:', err);
    }
};
