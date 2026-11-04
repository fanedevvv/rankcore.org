const inviteCache = require('../../Utils/inviteCache');

// Without a snapshot taken before someone joins, the first join after a restart
// can't be attributed to an invite. Take one for every server once the bot is ready.
module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    let ok = 0;
    for (const guild of client.guilds.cache.values()) {
      if (await inviteCache.warm(guild)) ok++;
    }
    console.log(`[invites] cached invites for ${ok}/${client.guilds.cache.size} servers`);
  },
};
