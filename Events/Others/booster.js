const { Events, EmbedBuilder } = require("discord.js");
const BoosterMessage = require("../../Schemas/boosterChannel");
const { Card } = require("welcomify");

/**
 * Build a welcomify card with retry on 429 (CDN rate-limit).
 * @param {Card} card
 * @param {number} retries
 * @returns {Promise<Buffer>}
 */
async function buildWithRetry(card, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await card.build();
    } catch (err) {
      const is429 = err?.message?.includes("429") || err?.statusCode === 429 || err?.status === 429;
      if (is429 && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}

function applyVars(str, member) {
  if (!str) return str;
  return str
    .replace(/{user}/g, member.user.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{boosts}/g, member.guild.premiumSubscriptionCount)
    .replace(/{boostCount}/g, member.guild.premiumSubscriptionCount)
    .replace(/{boostTier}/g, member.guild.premiumTier);
}

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    // Only fire on new boost
    if (oldMember.premiumSince || !newMember.premiumSince) return;

    const data = await BoosterMessage.findOne({ guildId: newMember.guild.id });
    if (!data) return;

    const channel = newMember.guild.channels.cache.get(data.channelId);
    if (!channel) return;

    const member = newMember;
    const sendOptions = {};

    // --- Image Card ---
    if (data.isImage) {
      let displayName = member.user.username;
      if (displayName.length > 10) displayName = displayName.slice(0, 10) + "...";

      const card = new Card()
        .setTitle("Thanks Booster!")
        .setName(displayName)
        .setAvatar(member.user.displayAvatarURL({ extension: "png", size: 128 }))
        .setMessage(`The server now has ${member.guild.premiumSubscriptionCount} boosts`)
        .setBackground(data.image || "https://i.imgur.com/GMuBRQo.jpeg")
        .setColor("FF73FA");

      sendOptions.files = [{ attachment: await buildWithRetry(card), name: "boost-card.png" }];
    }

    // --- Embed ---
    if (data.isEmbed) {
      const embed = new EmbedBuilder().setColor(data.color || "#FF73FA");

      if (data.author) {
        embed.setAuthor({
          name: applyVars(data.author, member),
          iconURL: data.authorIcon || undefined,
        });
      }
      if (data.title) {
        embed.setTitle(applyVars(data.title, member));
        if (data.titleUrl) embed.setURL(data.titleUrl);
      }
      if (data.description) embed.setDescription(applyVars(data.description, member));
      if (data.thumbnail) embed.setThumbnail(data.thumbnail);
      if (data.embedImage) embed.setImage(data.embedImage);
      if (data.footer) {
        embed.setFooter({
          text: applyVars(data.footer, member),
          iconURL: data.footerIcon || undefined,
        });
      }
      if (data.timestamp) embed.setTimestamp();

      sendOptions.embeds = [embed];
    }

    // --- Plain Message ---
    if (data.message?.trim()) {
      sendOptions.content = applyVars(data.message, member);
    }

    if (sendOptions.content || sendOptions.embeds || sendOptions.files) {
      await channel.send(sendOptions).catch(console.error);
    }

    // --- DM Booster ---
    if (data.dmEnabled && data.dmMessage?.trim()) {
      const dmEmbed = new EmbedBuilder()
        .setColor(data.color || "#FF73FA")
        .setDescription(applyVars(data.dmMessage, member))
        .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL({ dynamic: true }) || undefined });

      member.user.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  },
};