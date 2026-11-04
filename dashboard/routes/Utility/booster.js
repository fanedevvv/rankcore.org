const BoosterMessage = require("../../../Schemas/boosterChannel");
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { Card } = require("welcomify");
const { cbSend } = require("../../lib/cbSend");

function applyVars(str, user, guild) {
  if (!str) return str;
  return str
    .replace(/{user}/g, `<@${user.id}>`)
    .replace(/{username}/g, user.username)
    .replace(/{server}/g, guild.name)
    .replace(/{boosts}/g, guild.premiumSubscriptionCount)
    .replace(/{boostCount}/g, guild.premiumSubscriptionCount)
    .replace(/{boostTier}/g, guild.premiumTier);
}

const FIELDS = [
  "channelId", "message", "isEmbed", "isImage",
  "author", "authorIcon", "title", "titleUrl", "description",
  "color", "thumbnail", "embedImage", "footer", "footerIcon",
  "timestamp", "image", "dmEnabled", "dmMessage",
];

/**
 * Build a welcomify card with retry on 429 (Discord CDN rate-limit).
 * Uses exponential backoff: 1s → 2s → 4s.
 */
async function buildWithRetry(card, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await card.build();
    } catch (err) {
      const is429 = err?.message?.includes('429') || err?.statusCode === 429 || err?.status === 429;
      if (is429 && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
}


router.get("/guild/:id/booster", isAuth, checkDashboardAccess('booster'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/booster.html"))
);

router.get("/api/guild/:id/booster", isAuth, checkDashboardAccess('booster'), async (req, res) => {
  const data = await BoosterMessage.findOne({ guildId: req.params.id });
  res.json(data || null);
});

router.post("/api/guild/:id/booster", isAuth, checkDashboardAccess('booster'), async (req, res) => {
  const body = req.body;
  const update = { guildId: req.params.id };
  for (const f of FIELDS) {
    if (body[f] !== undefined) update[f] = body[f];
    else if (typeof update[f] === "boolean") update[f] = false;
    else update[f] = body[f] || "";
  }
  await BoosterMessage.findOneAndUpdate({ guildId: req.params.id }, update, { upsert: true });
  res.json({ success: true });
});

router.delete("/api/guild/:id/booster", isAuth, checkDashboardAccess('booster'), async (req, res) => {
  await BoosterMessage.deleteOne({ guildId: req.params.id });
  res.json({ success: true });
});

const cooldowns = new Map();

router.post("/api/guild/:id/booster/test", isAuth, checkDashboardAccess('booster'), async (req, res) => {
  const COOLDOWN = 10000;
  const userId = req.user.id;
  const now = Date.now();

  if (cooldowns.has(userId)) {
    const remaining = COOLDOWN - (now - cooldowns.get(userId));
    if (remaining > 0)
      return res.status(429).json({ error: `Please wait ${Math.ceil(remaining / 1000)}s before testing again.` });
  }

  const saved = await BoosterMessage.findOne({ guildId: req.params.id }).lean();
  const data  = saved ?? (Object.keys(req.body || {}).length ? req.body : null);
  if (!data || !data.channelId) {
    return res.status(400).json({ error: "Please select a booster channel before testing." });
  }

  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });

  const channel = guild.channels.cache.get(data.channelId);
  if (!channel || !(await channel.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)))
    return res.status(400).json({ error: "Invalid channel or missing permissions" });

  const user = req.user;
  const sendOptions = {};

  if (data.isImage) {
    const card = new Card()
      .setTitle("Thanks Booster!")
      .setName(user.username)
      .setAvatar(user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`)
      .setMessage(`The server now has ${guild.premiumSubscriptionCount} boosts`)
      .setBackground(data.image || "https://i.imgur.com/GMuBRQo.jpeg")
      .setColor("FF73FA");
    sendOptions.files = [{ attachment: await buildWithRetry(card), name: "boost-card.png" }];
  }

  if (data.isEmbed) {
    const embed = new EmbedBuilder().setColor(data.color || "#FF73FA");
    if (data.author) embed.setAuthor({ name: applyVars(data.author, user, guild), iconURL: data.authorIcon || undefined });
    if (data.title) { embed.setTitle(applyVars(data.title, user, guild)); if (data.titleUrl) embed.setURL(data.titleUrl); }
    if (data.description) embed.setDescription(applyVars(data.description, user, guild));
    if (data.thumbnail) embed.setThumbnail(data.thumbnail);
    if (data.embedImage) embed.setImage(data.embedImage);
    if (data.footer) embed.setFooter({ text: applyVars(data.footer, user, guild), iconURL: data.footerIcon || undefined });
    if (data.timestamp) embed.setTimestamp();
    sendOptions.embeds = [embed];
  }

  if (data.message?.trim()) sendOptions.content = applyVars(data.message, user, guild);

  if (!sendOptions.content && !sendOptions.embeds && !sendOptions.files)
    return res.status(400).json({ error: "Nothing configured to send" });

  try {
    await cbSend(req, req.params.id, channel, sendOptions);
    cooldowns.set(userId, now);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send boost message" });
  }
});

module.exports = router;