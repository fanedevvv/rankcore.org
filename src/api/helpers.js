'use strict';

// ─── Serializers ─────────────────────────────────────────────────────────────
// Shared across route modules — import with require('../helpers')

function serializeGuild(g) {
  if (!g) return null;
  return {
    id:                       g.id,
    name:                     g.name,
    icon:                     g.icon,
    iconURL:                  g.iconURL({ size: 256 }),
    banner:                   g.banner,
    memberCount:              g.memberCount,
    premiumSubscriptionCount: g.premiumSubscriptionCount,
    premiumTier:              g.premiumTier,
    verificationLevel:        g.verificationLevel,
    createdAt:                g.createdAt,
    systemChannelId:          g.systemChannelId,
    ownerId:                  g.ownerId,
  };
}

function serializeChannel(c) {
  return { id: c.id, name: c.name, type: c.type, rawPosition: c.rawPosition, parentId: c.parentId || null };
}

function serializeRole(r) {
  return {
    id: r.id, name: r.name, color: r.hexColor,
    position: r.rawPosition, managed: r.managed,
    hoist: r.hoist, mentionable: r.mentionable,
  };
}

function serializeMember(m) {
  return {
    id:        m.id,
    username:  m.user.username,
    avatarURL: m.user.displayAvatarURL({ size: 128 }),
    bot:       m.user.bot,
    nickname:  m.nickname,
    roleIds:   [...(m.roles?.cache?.keys() ?? [])],
  };
}

module.exports = { serializeGuild, serializeChannel, serializeRole, serializeMember };