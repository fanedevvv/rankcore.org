module.exports = {
  name: 'inviteCreate',
  async execute(invite, client) {
    try {
      const inviteCache = require('../../Utils/inviteCache');
      const guildId = invite.guild.id;
      const map = inviteCache.get(guildId);
      map.set(invite.code, {
        code: invite.code,
        uses: invite.uses ?? 0,
        inviterId: invite.inviter?.id ?? null,
        maxUses: invite.maxUses ?? null,
        createdAt: invite.createdTimestamp ?? null
      });
      inviteCache.set(guildId, map);
    } catch (err) {
      client?.logs?.error && client.logs.error('inviteCreate handler error', err);
    }
  }
};
