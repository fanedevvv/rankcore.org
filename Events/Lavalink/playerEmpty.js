const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'playerEmpty',
  async execute(client, player) {
    const autoplay = player.data.get("autoplay");
    if (autoplay) return;

    
    if (!player || !player.textId) {
      console.error(`Player or TextId is undefined`);
      return;
    }

    const channel = client.channels.cache.get(player.textId);
    if (!channel) {
      console.error(`Could not find channel with ID: ${player.textId}`);
      return;
    }
    
    if (player.data.get("stay")) return;

    const embed = new EmbedBuilder()
      .setColor(client.config.embedColor)
      .setTitle(`Music Playback Ended`)
      .setDescription(`The song has ended.\nThe queue is now empty and the player is now stopped.`)
      .setFooter({ text: `Thanks For Listening <:Red_Heart:1555544329605615758>`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
    }

    const nowPlayingMessage = channel.messages.cache.get(player.nowPlayingMessageId) ?? await channel.messages.fetch(player.nowPlayingMessageId).catch(() => null);
    if (nowPlayingMessage) {
      await nowPlayingMessage.edit({ components: [] });
    }
  },
};