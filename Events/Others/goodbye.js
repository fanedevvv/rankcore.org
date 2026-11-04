const { Events, EmbedBuilder, PermissionsBitField } = require("discord.js");
const GoodbyeMessage = require("../../Schemas/goodbyeMessageSchema");
const { buildMemberCard } = require("../../Utils/memberCardBuilder");
const cache = require('../../src/lib/cache');
const joinInvites = require('../../Utils/joinInvites');
const InviteJoin = require('../../Schemas/inviteJoinRecord');
const InviteStats = require('../../Schemas/inviteSchema');

function applyVars(str, member, inv) {
  if (!str) return str;
  return joinInvites.applyInviteVars(str, inv)
    .replace(/{user}/g, member.user.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{members}/g, member.guild.memberCount)
    .replace(/{memberCount}/g, member.guild.memberCount);
}

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    const data = await cache.wrap('goodbye', `config:${member.guild.id}`,
      () => GoodbyeMessage.findOne({ guildId: member.guild.id }).lean(), 120);
    if (!data || !data.channelId) return;

    const channel = member.guild.channels.cache.get(data.channelId);
    if (!channel) return;

    const me = member.guild.members.me;
    if (!me || !channel.permissionsFor(me)?.has(PermissionsBitField.Flags.SendMessages)) return;

    // Who invited them — saved by the invite tracker when they joined
    let inv = null;
    if (data.showInvites) {
      const rec = await InviteJoin.findOne({ guildId: member.guild.id, joinedId: member.id }).lean().catch(() => null);
      if (rec) {
        const stats = rec.inviterId
          ? await InviteStats.findOne({ guildId: member.guild.id, userId: rec.inviterId }).lean().catch(() => null)
          : null;
        const inviterUser = rec.inviterId ? await member.client.users.fetch(rec.inviterId).catch(() => null) : null;
        inv = { inviterId: rec.inviterId, inviterName: inviterUser?.username ?? null,
                code: rec.code, isVanity: !rec.inviterId && !!rec.code,
                ...joinInvites.statsInfo(stats) };
      }
    }

    const sendOptions = {};

    // --- Image Card (native canvas — no third-party HTTP) ---
    if (data.isImage) {
      try {
        const avatarUrl = member.user.avatar
          ? member.user.displayAvatarURL({ extension: "png", size: 256 })
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(member.user.id) >> 22n) % 6}.png`;

        const cardBuf = await buildMemberCard({
          type:        "goodbye",
          username:    member.user.globalName || member.user.username,
          avatarUrl,
          memberCount: member.guild.memberCount,
          background:  data.image || null,
        });

        sendOptions.files = [{ attachment: cardBuf, name: "goodbye-card.png" }];
      } catch (err) {
        console.error("[goodbye] card build failed:", err.message);
      }
    }

    // --- Embed ---
    // Plain @names for places where Discord doesn't render mentions
    const names = { [member.id]: member.displayName, ...(inv?.inviterId ? { [inv.inviterId]: inv.inviterName } : {}) };
    if (data.isEmbed) {
      const embed = new EmbedBuilder().setColor(data.color || "#F87171");

      if (data.author)      embed.setAuthor({ name: joinInvites.unmention(applyVars(data.author, member, inv), names), iconURL: data.authorIcon || undefined });
      if (data.title)     { embed.setTitle(joinInvites.unmention(applyVars(data.title, member, inv), names)); if (data.titleUrl) embed.setURL(data.titleUrl); }
      if (data.description) embed.setDescription(applyVars(data.description, member, inv));
      if (data.thumbnail)   embed.setThumbnail(data.thumbnail);
      if (data.embedImage)  embed.setImage(data.embedImage);
      if (data.footer)      embed.setFooter({ text: joinInvites.unmention(applyVars(data.footer, member, inv), names), iconURL: data.footerIcon || undefined });
      if (data.timestamp)   embed.setTimestamp();
      if (data.showInvites) { const ib = joinInvites.inviteBlock(data, inv, s => applyVars(s, member, inv)); embed.addFields({ name: joinInvites.unmention(ib.title, names), value: ib.text }); }

      sendOptions.embeds = [embed];
    }

    // --- Plain message ---
    if (data.message?.trim()) sendOptions.content = applyVars(data.message, member, inv);

    if (data.showInvites && !sendOptions.embeds) {
      sendOptions.content = (sendOptions.content ? sendOptions.content + "\n" : "") + (ib => `-# ${ib.title} ${ib.text.replace(/\n+/g, " ")}`)(joinInvites.inviteBlock(data, inv, s => applyVars(s, member, inv)));
    }
    // Never ping the inviter
    if (data.showInvites) sendOptions.allowedMentions = { parse: ["roles", "everyone"], users: [] };

    if (!sendOptions.content && !sendOptions.embeds?.length && !sendOptions.files?.length) return;

    await channel.send(sendOptions).catch(console.error);

    // --- DM on leave ---
    if (data.dmEnabled && data.dmMessage?.trim()) {
      const dmEmbed = new EmbedBuilder()
        .setColor(data.color || "#F87171")
        .setDescription(applyVars(data.dmMessage, member, inv))
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) || undefined });

      member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  },
};