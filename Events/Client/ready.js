module.exports = {
  name: "clientReady",
  once: true,
  async execute(client) {
    console.log(`\x1b[32m[READY]\x1b[0m Logged in as ${client.user.tag} (${client.user.id})`);
    console.log(`\x1b[32m[READY]\x1b[0m Serving ${client.guilds.cache.size} guilds, ${client.users.cache.size} users`);

    if (typeof client.emit === 'function') {
      client.emit('resumeRotatingStatus');
    }
  },
};
