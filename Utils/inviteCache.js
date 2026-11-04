class InviteCache {
  constructor() {
    this._cache = new Map();
  }
  set(guildId, invitesMap) {
    this._cache.set(guildId, invitesMap);
  }
  get(guildId) {
    return this._cache.get(guildId) || new Map();
  }
  has(guildId) {
    return this._cache.has(guildId);
  }
  removeGuild(guildId) {
    this._cache.delete(guildId);
  }

  /** Snapshot a server's invite use counts so the next join can be attributed. */
  async warm(guild) {
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return false; // no Manage Server permission
    const map = new Map();
    invites.forEach(inv => map.set(inv.code, { code: inv.code, uses: inv.uses ?? 0, inviterId: inv.inviter?.id ?? null }));
    this._cache.set(guild.id, map);
    const vanity = await guild.fetchVanityData().catch(() => null);
    if (vanity) this._cache.set(`${guild.id}:vanity`, vanity.uses ?? 0);
    return true;
  }
}
module.exports = new InviteCache();
