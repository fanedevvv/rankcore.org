const { Events, EmbedBuilder } = require('discord.js');
const MassJoinProtection = require("../Schemas/AntiRaidSchema.js");
const cache = require('../src/lib/cache');

module.exports = (client) => {
  client.on("guildMemberAdd", async (member) => {
    const guildId = member.guild.id;

    try {
      if (member.user.bot) {
        const cbDoc = await require('../Schemas/customBrandingSchema')
          .findOne({ guildId, enabled: true }).select('botClientId setupState').lean();
        if (cbDoc?.setupState === 'active' && cbDoc.botClientId === member.user.id) return;
      }
      const protection = await cache.wrap('antiraid', `config:${guildId}`,
        () => MassJoinProtection.findOne({ guildId }), 30);

      if (!protection || !protection.isEnabled) return;

      const currentTime = Date.now();
      const timeLimit = protection.timeLimit * 60 * 1000;
      const joinLimit = protection.massJoinLimit;

      let joinData = protection.joins || [];
      joinData = joinData.filter((join) => currentTime - join.time <= timeLimit);
      joinData.push({ userId: member.id, time: currentTime });
      protection.joins = joinData;
      await protection.save();

      if (joinData.length >= joinLimit) {
        const punishment = protection.punishment;

        const actionEmbed = new EmbedBuilder()
          .setColor(client.config.embedColor)
          .setTitle(`Mass Join Detected`)
          .setDescription(
            `**${joinData.length}** users have joined the with **${protection.timeLimit}** minutes.`
          )
          .setTimestamp();

        switch (punishment) {
          case "ban":
            for (const join of joinData) {
              const user = await member.guild.members
                .fetch(join.userId)
                .catch(() => null);
              if (user) await user.kick(`Mass Join Raid Detected.`);
            }
            break;
          case "mute":
            for (const join of joinData) {
              const user = await member.guild.members
                .fetch(join.userId)
                .catch(() => null);
              if (user)
                await user.timeout(5 * 60 * 1000, `Mass Join Raid Detected.`);
            }
            break;
          case "hideChannels":
            for (const channel of member.guild.channels.cache.values()) {
              channel.permissionOverwrites
                .edit(member.guild.roles.everyone, { ViewChannel: false })
                .catch(console.error);
            }
            break;
          case "lockChannels":
            for (const channel of member.guild.channels.cache.values()) {
              channel.permissionOverwrites
                .edit(member.guild.roles.everyone, { SendMessages: false })
                .catch(console.error);
            }
            break;
          default:
            break;
        }

        const logChannel = member.guild.channels.cache.get(
          protection.logChannelId
        );
        if (logChannel) logChannel.send({ embeds: [actionEmbed] });

        protection.joins = [];
        await protection.save();
      }
    } catch (error) {
      console.error(`[AntiRaid] Error handling mass join protection:`, error);
    }
  });
};