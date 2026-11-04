const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'confessionLog',
    once: false, // This runs every time the event is emitted
    async execute(guild, config, action, details) {
        // Validation checks
        if (!guild || !config || !config.LogChannel) return;

        const logChan = guild.channels.cache.get(config.LogChannel);
        if (!logChan) return;

        // determine color based on action type
        const isNegativeAction = action.includes('BLACKLIST') || action.includes('DENIED') || action.includes('Failed');
        const color = isNegativeAction ? 'Red' : 'Blue';

        const logEmbed = new EmbedBuilder()
            .setTitle(`<:error:1555544434601369620> ${action} Log`)
            .setDescription(details)
            .setColor(color)
            .setTimestamp();

        try {
            await logChan.send({ embeds: [logEmbed] });
        } catch (err) {
            console.error(`Failed to send log message in guild ${guild.id}:`, err);
        }
    },
};