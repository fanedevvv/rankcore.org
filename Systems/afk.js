const afkSchema = require("../Schemas/afkschema");
const GuildSettings = require("../Schemas/guildSettingsSchema");
const { Events, EmbedBuilder } = require('discord.js');

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours   = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days    = Math.floor(ms / (1000 * 60 * 60 * 24));

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
}

module.exports = (client) => {
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildSettings = await GuildSettings.findOne({ guildId: message.guild.id });
        if (!guildSettings?.afkEnabled) return;

        const userAfk = await afkSchema.findOne({
            guildId: message.guild.id,
            userId: message.author.id,
        });

        if (userAfk) {
            const duration = formatDuration(Date.now() - userAfk.timestamp);
            await afkSchema.deleteOne({
                guildId: message.guild.id,
                userId: message.author.id,
            });

            if (userAfk.nickname) {
                await message.member.setNickname(userAfk.nickname).catch(() => {});
            }

            const backEmbed = new EmbedBuilder()
                .setColor(0x22c55e)
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
                .setTitle('<:user:1555544664155889668> Welcome Back!')
                .setDescription(`You were AFK for **${duration}**`)
                .setFooter({ text: 'AFK status removed' })
                .setTimestamp();

            const m1 = await message.reply({ embeds: [backEmbed] }).catch(() => null);
            if (m1) setTimeout(() => m1.delete().catch(() => {}), 5000);
            return;
        }

        const mentionedUser = message.mentions.users.first();
        if (!mentionedUser || mentionedUser.id === message.author.id) return;

        const mentionedAfk = await afkSchema.findOne({
            guildId: message.guild.id,
            userId: mentionedUser.id,
        });

        if (!mentionedAfk) return;

        const member = message.guild.members.cache.get(mentionedUser.id);
        if (!member) return;

        const duration = formatDuration(Date.now() - mentionedAfk.timestamp);
        const reason = mentionedAfk.reason || 'No Reason Given';

        const afkEmbed = new EmbedBuilder()
            .setColor(0xf97316)
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('<:n_loading:1555544489194688623> AFK Notice')
            .setDescription(`${member.user.tag} is currently **AFK**`)
            .addFields(
                { name: 'Reason', value: reason, inline: true },
                { name: 'Duration', value: duration, inline: true }
            )
            .setFooter({ text: 'Please avoid pinging them' })
            .setTimestamp();

        const m = await message.reply({ embeds: [afkEmbed] }).catch(() => null);
        if (m) setTimeout(() => m.delete().catch(() => {}), 7000);
    });

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        if (oldMember.nickname === newMember.nickname) return;
        
        const nickname = newMember.nickname;
        if (!nickname || !nickname.startsWith('[AFK]')) return;

        const afkData = await afkSchema.findOne({
            guildId: newMember.guild.id,
            userId: newMember.id,
        });

        if (afkData) {
            await afkSchema.findOneAndUpdate(
                { guildId: newMember.guild.id, userId: newMember.id },
                { nickname: nickname.replace('[AFK]', '').trim() }
            );
        }
    });
};