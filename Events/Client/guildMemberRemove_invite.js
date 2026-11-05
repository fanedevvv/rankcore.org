const InviteStats = require('../../Schemas/inviteSchema');
const GuildConfig = require('../../Schemas/guildInviteConfig');
const JoinModel = require('../../Schemas/inviteJoinRecord');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    try {
      const guildId = member.guild.id;
      const guildConfig = await GuildConfig.findOne({ guildId });
      if (!guildConfig) return;
      if (guildConfig.ignoreBots && member.user.bot) return;

      // ── Leave message ─────────────────────────────────────────────────────
      if (guildConfig.leave?.enabled && guildConfig.leave?.message) {
        const channelId = guildConfig.leave.channelId || guildConfig.welcomeChannelId;
        const ch = channelId ? member.guild.channels.cache.get(channelId) : null;
        if (ch) {
          const content = guildConfig.leave.message
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{memberCount}/g, String(member.guild.memberCount))
            .replace(/{server}/g, member.guild.name);
          ch.send({ content }).catch(() => null);
        }
      }

      // ── Invite decrement ──────────────────────────────────────────────────
      const joinRecord = await JoinModel.findOne({ guildId, joinedId: member.id });
      if (!joinRecord?.inviterId) return;

      const inviterId = joinRecord.inviterId;

      if (guildConfig.countLeavesAsNegative) {
        await InviteStats.findOneAndUpdate(
          { guildId, userId: inviterId },
          { $inc: { invites: -1, left: 1 }, $set: { lastUpdated: Date.now() } }
        );
      } else {
        await InviteStats.findOneAndUpdate(
          { guildId, userId: inviterId },
          { $inc: { left: 1 }, $set: { lastUpdated: Date.now() } }
        );
      }

      // ── Log ───────────────────────────────────────────────────────────────
      if (guildConfig.logChannelId) {
        const log = member.guild.channels.cache.get(guildConfig.logChannelId);
        if (log) {
          const countMsg = guildConfig.countLeavesAsNegative ? ' (−1 invite)' : '';
          const msg = `<:files:1567796970964394044> **${member.user.tag}** left — decrementing invites of <@${inviterId}>${countMsg}`;
          log.send({ content: msg }).catch(() => null);
        }
      }

    } catch (err) {
      console.error(`guildMemberRemove invite error [${member.guild?.id}] [${member.id}]:`, err.stack || err);
      client?.logs?.warn?.(`guildMemberRemove invite error [${member.guild?.id}] [${member.id}]`, err.stack || err);
    }
  }
};