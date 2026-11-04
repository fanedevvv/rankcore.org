"use strict";

const GoodbyeMessage = require("../../../Schemas/goodbyeMessageSchema");
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { EmbedBuilder, PermissionsBitField } = require("discord.js");
const { buildMemberCard } = require("../../../Utils/memberCardBuilder");
const { cbSend } = require("../../lib/cbSend");
const joinInvites = require("../../../Utils/joinInvites");
const InviteStats = require("../../../Schemas/inviteSchema");

function applyVars(str, user, guild, inv) {
  if (!str) return str;
  return joinInvites.applyInviteVars(str, inv)
    .replace(/{user}/g, `<@${user.id}>`)
    .replace(/{username}/g, user.username)
    .replace(/{server}/g, guild.name)
    .replace(/{members}/g, guild.memberCount)
    .replace(/{memberCount}/g, guild.memberCount);
}

const FIELDS = [
  "channelId", "message", "isEmbed", "isImage",
  "author", "authorIcon", "title", "titleUrl", "description",
  "color", "thumbnail", "embedImage", "footer", "footerIcon",
  "timestamp", "image", "dmEnabled", "dmMessage", "showInvites", "inviteTitle", "inviteText",
];

// ── Dashboard page ────────────────────────────────────────────────────────────
router.get("/guild/:id/goodbye", isAuth, checkDashboardAccess('goodbye'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/goodbye.html")));

// ── GET config ────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/goodbye", isAuth, checkDashboardAccess('goodbye'), async (req, res) => {
  try {
    const data = await GoodbyeMessage.findOne({ guildId: req.params.id });
    res.json(data || {});
  } catch (err) {
    console.error("[goodbye GET]", err);
    res.status(500).json({ error: "Failed to fetch goodbye config" });
  }
});

// ── SAVE config ───────────────────────────────────────────────────────────────
router.post("/api/guild/:id/goodbye", isAuth, checkDashboardAccess('goodbye'), async (req, res) => {
  try {
    const update = { guildId: req.params.id };
    for (const f of FIELDS) {
      if (req.body[f] !== undefined) update[f] = req.body[f];
      else if (typeof update[f] === "boolean") update[f] = false;
      else update[f] = req.body[f] || "";
    }
    await GoodbyeMessage.findOneAndUpdate({ guildId: req.params.id }, update, { upsert: true, new: true });
    res.json({ success: true });
  } catch (err) {
    console.error("[goodbye POST]", err);
    res.status(500).json({ error: "Failed to save goodbye config" });
  }
});

// ── DELETE / DISABLE ──────────────────────────────────────────────────────────
router.delete("/api/guild/:id/goodbye", isAuth, checkDashboardAccess('goodbye'), async (req, res) => {
  try {
    await GoodbyeMessage.deleteOne({ guildId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error("[goodbye DELETE]", err);
    res.status(500).json({ error: "Failed to disable goodbye system" });
  }
});

// ── TEST ──────────────────────────────────────────────────────────────────────
const goodbyeCooldowns = new Map();

router.post("/api/guild/:id/goodbye/test", isAuth, checkDashboardAccess('goodbye'), async (req, res) => {
  const COOLDOWN = 10000;
  const userId = req.user.id;
  const now = Date.now();

  if (goodbyeCooldowns.has(userId)) {
    const remaining = COOLDOWN - (now - goodbyeCooldowns.get(userId));
    if (remaining > 0)
      return res.status(429).json({ error: `Please wait ${Math.ceil(remaining / 1000)}s before testing again.` });
  }

  const saved = await GoodbyeMessage.findOne({ guildId: req.params.id }).lean();
  const data  = saved ?? (Object.keys(req.body || {}).length ? req.body : null);
  if (!data || !data.channelId)
    return res.status(400).json({ error: "Please select a goodbye channel before testing." });

  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });

  const channel = guild.channels.cache.get(data.channelId);
  if (!channel || !(await channel.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages)))
    return res.status(400).json({ error: "Invalid channel or missing permissions" });

  const user = req.user;
  let inv = null;
  if (data.showInvites) {
    const stats = await InviteStats.findOne({ guildId: guild.id, userId: user.id }).lean().catch(() => null);
    inv = { inviterId: user.id, inviterName: user.username, code: "test", ...joinInvites.statsInfo(stats), fakeAccount: false };
  }
  const sendOptions = {};

  // --- Image card (native canvas — no third-party HTTP) ---
  if (data.isImage) {
    try {
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`;

      const cardBuf = await buildMemberCard({
        type:        "goodbye",
        username:    user.global_name || user.username,
        avatarUrl,
        memberCount: guild.memberCount,
        background:  data.image || null,
      });

      sendOptions.files = [{ attachment: cardBuf, name: "goodbye-card.png" }];
    } catch (err) {
      console.error("[goodbye test] card build failed:", err.message);
    }
  }

  // --- Embed ---
  // Plain @names for places where Discord doesn't render mentions
  const names = { [user.id]: user.global_name || user.username, ...(inv?.inviterId ? { [inv.inviterId]: inv.inviterName } : {}) };
  if (data.isEmbed) {
    const embed = new EmbedBuilder().setColor(data.color || "#F87171");
    if (data.author)      embed.setAuthor({ name: joinInvites.unmention(applyVars(data.author, user, guild, inv), names), iconURL: data.authorIcon || undefined });
    if (data.title)     { embed.setTitle(joinInvites.unmention(applyVars(data.title, user, guild, inv), names)); if (data.titleUrl) embed.setURL(data.titleUrl); }
    if (data.description) embed.setDescription(applyVars(data.description, user, guild, inv));
    if (data.thumbnail)   embed.setThumbnail(data.thumbnail);
    if (data.embedImage)  embed.setImage(data.embedImage);
    if (data.footer)      embed.setFooter({ text: joinInvites.unmention(applyVars(data.footer, user, guild, inv), names), iconURL: data.footerIcon || undefined });
    if (data.timestamp)   embed.setTimestamp();
    if (data.showInvites) { const ib = joinInvites.inviteBlock(data, inv, s => applyVars(s, user, guild, inv)); embed.addFields({ name: joinInvites.unmention(ib.title, names), value: ib.text }); }
    sendOptions.embeds = [embed];
  }

  // --- Plain message ---
  if (data.message?.trim()) sendOptions.content = applyVars(data.message, user, guild, inv);
  if (data.showInvites && !sendOptions.embeds)
    sendOptions.content = (sendOptions.content ? sendOptions.content + "\n" : "") + (ib => `-# ${ib.title} ${ib.text.replace(/\n+/g, " ")}`)(joinInvites.inviteBlock(data, inv, s => applyVars(s, user, guild, inv)));

  if (!sendOptions.content && !sendOptions.embeds?.length && !sendOptions.files?.length)
    return res.status(400).json({ error: "Nothing configured to send — add a message, embed, or image card." });

  try {
    await cbSend(req, req.params.id, channel, sendOptions);
    goodbyeCooldowns.set(userId, now);
    res.json({ success: true });
  } catch (err) {
    console.error("[goodbye test send]", err);
    res.status(500).json({ error: "Failed to send goodbye message" });
  }
});

module.exports = router;