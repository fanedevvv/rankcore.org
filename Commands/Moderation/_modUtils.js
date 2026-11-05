/**
 * _modUtils.js
 * Shared utilities for all RankCore moderation commands.
 * All DM notifications use Components V2 (ContainerBuilder).
 */

const {
  PermissionsBitField,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require("discord.js");
const { ACCENT } = require("../../Utils/v2helpers");

// ─── Case Number Generator ────────────────────────────────────────────────────
// Generates a short, human-readable case ID: #A1B2C
function generateCase() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "#";
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Permission Check ─────────────────────────────────────────────────────────
/**
 * Returns an error string if a check fails, or null if all good.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('discord.js').GuildMember|null} targetMember
 * @param {bigint} perm
 * @returns {string|null}
 */
function canModerate(interaction, targetMember, perm) {
  if (!interaction.member.permissions.has(perm))
    return `<:restrict:1567797003638022166> You need the **${readablePerm(perm)}** permission.`;
  if (!targetMember)
    return `<:restrict:1567797003638022166> That user is not in this server.`;
  if (targetMember.id === interaction.user.id)
    return `<:restrict:1567797003638022166> You can't moderate yourself.`;
  if (targetMember.id === interaction.guild.ownerId)
    return `<:restrict:1567797003638022166> You can't moderate the server owner.`;
  if (!targetMember.moderatable)
    return `<:restrict:1567797003638022166> I can't moderate that member — check my role position.`;
  if (
    interaction.guild.ownerId !== interaction.user.id &&
    interaction.member.roles.highest.position <= targetMember.roles.highest.position
  ) return `<:restrict:1567797003638022166> Their highest role is equal to or above yours.`;
  return null;
}

function readablePerm(perm) {
  const map = {
    [PermissionsBitField.Flags.BanMembers]:       "Ban Members",
    [PermissionsBitField.Flags.KickMembers]:      "Kick Members",
    [PermissionsBitField.Flags.ModerateMembers]:  "Moderate Members (Timeout)",
    [PermissionsBitField.Flags.ManageMessages]:   "Manage Messages",
    [PermissionsBitField.Flags.ManageChannels]:   "Manage Channels",
    [PermissionsBitField.Flags.ManageNicknames]:  "Manage Nicknames",
    [PermissionsBitField.Flags.ManageRoles]:      "Manage Roles",
  };
  return map[perm] || "Required Permission";
}

// ─── DM Notification (V2) ─────────────────────────────────────────────────────
const DM_ACCENTS = {
  ban: ACCENT.error, kick: ACCENT.warning, timeout: ACCENT.warning,
  warn: ACCENT.warning, unban: ACCENT.success, untimeout: ACCENT.success,
};
const DM_TITLES = {
  ban:      "## <:ban:1567796952538554458>  You have been banned",
  kick:     "## <:ban:1567796952538554458>  You have been kicked",
  timeout:  "## <:n_music:1567796993403658261>  You have been timed out",
  warn:     "## <:error:1567796968758050868>  You received a warning",
  unban:    "## <a:tickyy:1567797045253644368>  You have been unbanned",
  untimeout:"## <:n_music:1567796993403658261>  Your timeout has been removed",
};
const DM_FOOTERS = {
  ban:      "-# You may appeal by contacting a server administrator.",
  kick:     "-# You can rejoin unless further action is taken.",
  timeout:  "-# Your timeout will expire automatically. Please follow the rules.",
  warn:     "-# Please review the server rules to avoid further action.",
  unban:    "-# You may now rejoin the server.",
  untimeout:"-# You may send messages again.",
};

/**
 * Send a V2-styled DM to a user about a moderation action.
 * @param {import('discord.js').User} user
 * @param {import('discord.js').Guild} guild
 * @param {'ban'|'kick'|'timeout'|'warn'|'unban'|'untimeout'} action
 * @param {string} reason
 * @param {object} [extra] - optional { duration, expires (unix), caseNumber, moderator }
 * @returns {Promise<boolean>} true if DM was sent
 */
async function dmUser(user, guild, action, reason, extra = {}) {
  const accentColor = DM_ACCENTS[action] ?? ACCENT.info;

  let bodyLines = `**Server** — ${guild.name}\n**Reason** — ${reason}`;
  if (extra.moderator)  bodyLines += `\n**Moderator** — ${extra.moderator}`;
  if (extra.duration)   bodyLines += `\n**Duration** — ${extra.duration}`;
  if (extra.expires)    bodyLines += `\n**Expires** — <t:${extra.expires}:R>`;
  if (extra.caseNumber) bodyLines += `\n**Case** — ${extra.caseNumber}`;

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(DM_TITLES[action] || `## <:n_info:1567796991419744417> Moderation Action`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyLines))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(DM_FOOTERS[action] || "-# Contact a server administrator if you have questions."));

  try {
    await user.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return true;
  } catch {
    return false;
  }
}

// ─── Duration Helpers ─────────────────────────────────────────────────────────
/**
 * Parse a duration string like "10m", "2h", "3d" into seconds.
 * @param {string} str
 * @returns {number|null}
 */
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([smhdw])$/i);
  if (!match) return null;
  const units = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
  return parseInt(match[1]) * (units[match[2].toLowerCase()] || 0);
}

/**
 * Format a duration in seconds to a human-readable string.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 60)     return `${seconds}s`;
  if (seconds < 3600)   return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
}

module.exports = {
  generateCase,
  canModerate,
  dmUser,
  parseDuration,
  formatDuration,
};
