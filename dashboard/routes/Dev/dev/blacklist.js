"use strict";

// blacklist.js — user blacklist, server blacklist, bot servers

const router          = require("express").Router();
const Blacklist       = require("../../../../Schemas/blacklistSchema");
const ServerBlacklist = require("../../../../Schemas/serverBlacklistSchema");
const { devLog, secureDevApi } = require("./shared");
const { apiPost } = require("../../../lib/botClient");

/**
 * Tell the bot process (which has real Discord.js access) to send a
 * blacklist embed in the guild and then leave. The dashboard shim's
 * guild.members.me is always null so we can't do this locally.
 */
async function notifyAndLeave(guild, _client, reason) {
  return apiPost(`/internal/guild/${guild.id}/blacklist-leave`, { reason });
}
/* ─────────────────────────────────────────────
   USER BLACKLIST
───────────────────────────────────────────── */

router.get("/api-dev/blacklist/users", ...secureDevApi, async (req, res) => {
  res.json(await Blacklist.find().lean());
});

router.post("/api-dev/blacklist/users", ...secureDevApi, async (req, res) => {
  const { userId, reason } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID required" });

  const exists = await Blacklist.findOne({ userId });
  if (exists) {
    await Blacklist.deleteOne({ userId });
    devLog("USER_BLACKLIST_REMOVE", { userId }, req.user);
    return res.json({ success: true, action: "removed" });
  }

  const finalReason = reason || "No reason provided";
  await Blacklist.create({ userId, reason: finalReason });
  devLog("USER_BLACKLIST_ADD", { userId, reason: finalReason }, req.user);

  // Kick the bot out of every guild where this user is the owner
  if (req.client) {
    const sharedGuilds = req.client.guilds.cache.filter(g => g.ownerId === userId);
    for (const guild of sharedGuilds.values()) {
      console.log(`[DEV] Leaving guild ${guild.name} (${guild.id}) — owner ${userId} is now user-blacklisted`);
      await notifyAndLeave(guild, req.client, `The server owner (**${guild.name}**) has been blacklisted from using ${req.client.user.username}. Reason: ${finalReason}`);
    }
  }

  res.json({ success: true, action: "added" });
});

/* ─────────────────────────────────────────────
   SERVER BLACKLIST
───────────────────────────────────────────── */

router.get("/api-dev/blacklist/servers", ...secureDevApi, async (req, res) => {
  res.json(await ServerBlacklist.find().lean());
});

router.post("/api-dev/blacklist/servers", ...secureDevApi, async (req, res) => {
  const { serverId, reason } = req.body;
  if (!serverId) return res.status(400).json({ error: "Server ID required" });

  const exists = await ServerBlacklist.findOne({ serverId });
  if (exists) {
    await ServerBlacklist.deleteOne({ serverId });
    devLog("SERVER_BLACKLIST_REMOVE", { serverId }, req.user);
    return res.json({ success: true, action: "removed" });
  }

  const finalReason = reason || "No reason provided";
  await ServerBlacklist.create({ serverId, reason: finalReason });
  devLog("SERVER_BLACKLIST_ADD", { serverId, reason: finalReason }, req.user);

  const guild = req.client?.guilds?.cache?.get(serverId);
  if (guild) {
    console.log(`[DEV] Leaving blacklisted guild ${guild.name} (${serverId}) — by ${req.user?.username}`);
    await notifyAndLeave(guild, req.client, finalReason);
  }

  res.json({ success: true, action: "added" });
});

/* ─────────────────────────────────────────────
   BOT SERVERS
───────────────────────────────────────────── */

router.get("/api-dev/botservers", ...secureDevApi, (req, res) => {
  res.json(
    req.client.guilds.cache.map(g => ({
      id:          g.id,
      name:        g.name,
      memberCount: g.memberCount,
      icon:        g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
    }))
  );
});

router.post("/api-dev/botservers/leave", ...secureDevApi, async (req, res) => {
  const { serverId } = req.body;
  const guild = req.client.guilds.cache.get(serverId);
  if (!guild) return res.status(404).json({ error: "Bot is not in that server" });

  await guild.leave();
  console.log(`[DEV] Left guild ${guild.name} (${serverId}) — by ${req.user?.username}`);
  devLog("GUILD_LEAVE", { serverId, guildName: guild.name }, req.user);
  res.json({ success: true });
});

module.exports = router;