const { Events } = require('discord.js');
const antiLinkEvent = require('../Events/Others/antiLinkEvent.js');

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return; // Ignore bot messages
    try {
      await antiLinkEvent(message);
    } catch (error) {
      console.error('[AntiLink] Error executing antiLinkEvent:', error);
    }
  });
};