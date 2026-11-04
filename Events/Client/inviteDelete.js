module.exports = {
  name: 'inviteDelete',
  async execute(invite, client) {
    try {
      const inviteCache = require('../../Utils/inviteCache');
      const guildId = invite.guild.id;
      const map = inviteCache.get(guildId);
      map.delete(invite.code);
      inviteCache.set(guildId, map);
    } catch (err) {
      client?.logs?.error && client.logs.error('inviteDelete handler error', err);
    }
  }
};
