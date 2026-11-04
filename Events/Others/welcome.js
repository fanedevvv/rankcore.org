const { Events, EmbedBuilder } = require("discord.js");
const WelcomeMessage = require("../../Schemas/welcomeMessageSchema");
const { buildMemberCard } = require("../../Utils/memberCardBuilder");
const cache = require('../../src/lib/cache');
const joinInvites = require('../../Utils/joinInvites');

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
  name: Events.GuildMemberAdd,
  async execute(member) {
    const data = await cache.wrap('welcome', `config:${member.guild.id}`,
      () => WelcomeMessage.findOne({ guildId: member.guild.id }).lean(), 120);
    if (!data) return;

    const channel = member.guild.channels.cache.get(data.channelId);
    if (!channel) return;

    // Who invited them — published by the invite tracker for this same join
    const inv = data.showInvites ? await joinInvites.waitFor(member.guild.id, member.id) : null;

    const sendOptions = {};

    // --- Image Card (native canvas — no third-party HTTP) ---
    if (data.isImage) {
      try {
        const avatarUrl = member.user.avatar
          ? member.user.displayAvatarURL({ extension: "png", size: 256 })
          : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(member.user.id) >> 22n) % 6}.png`;

        const cardBuf = await buildMemberCard({
          type:        "welcome",
          username:    member.user.globalName || member.user.username,
          avatarUrl,
          memberCount: member.guild.memberCount,
          background:  data.image || null,
        });

        sendOptions.files = [{ attachment: cardBuf, name: "welcome-card.png" }];
      } catch (err) {
        console.error("[welcome] card build failed:", err.message);
      }
    }

    // --- Embed ---
    // Plain @names for places where Discord doesn't render mentions
    const names = { [member.id]: member.displayName, ...(inv?.inviterId ? { [inv.inviterId]: inv.inviterName } : {}) };
    if (data.isEmbed) {
      const embed = new EmbedBuilder().setColor(data.color || "#53FF6C");

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

    // --- Mention user ---
    if (data.mentionUser)
      sendOptions.content = (sendOptions.content ? sendOptions.content + "\n" : "") + member.user.toString();

    // --- Invite info as a line when there's no embed to hold it ---
    if (data.showInvites && !sendOptions.embeds) {
      sendOptions.content = (sendOptions.content ? sendOptions.content + "\n" : "") + (ib => `-# ${ib.title} ${ib.text.replace(/\n+/g, " ")}`)(joinInvites.inviteBlock(data, inv, s => applyVars(s, member, inv)));
    }
    // Never ping the inviter — only the new member, plus any roles/everyone in the message itself
    if (data.showInvites) sendOptions.allowedMentions = { parse: ["roles", "everyone"], users: [member.id] };

    if (sendOptions.content || sendOptions.embeds || sendOptions.files)
      await channel.send(sendOptions).catch(console.error);

    // --- DM user ---
    if (data.dmEnabled && data.dmMessage?.trim()) {
      const dmEmbed = new EmbedBuilder()
        .setColor(data.color || "#53FF6C")
        .setDescription(applyVars(data.dmMessage, member, inv))
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) || undefined });

      member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  },
};