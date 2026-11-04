"use strict";

// owners.js — owner management (list, add, remove)

const router    = require("express").Router();
const getOwners = require("../../../../Utils/getOwners");
const { secureDevApi } = require("./shared");

const PERMANENT_OWNER = process.env.OWNER_ID;

router.get("/api-dev/owners", ...secureDevApi, async (req, res) => {
  try {
    const ownerIds = await getOwners();
    const enriched = await Promise.all(
      ownerIds.map(async (id) => {
        try {
          const user      = await req.client.users.fetch(id, { force: false });
          const username  = user.username ?? null;
          const avatarUrl =
            typeof user.displayAvatarURL === "function"
              ? user.displayAvatarURL({ size: 128 })
              : (user.avatarURL ?? `https://cdn.discordapp.com/embed/avatars/${parseInt(id) % 5}.png`);
          return { id, username, discriminator: user.discriminator ?? "0", avatar: avatarUrl, isPermanent: id === PERMANENT_OWNER };
        } catch {
          return { id, username: null, avatar: null, isPermanent: id === PERMANENT_OWNER };
        }
      })
    );
    res.json({ owners: enriched, isOwnerAdmin: req.user?.id === PERMANENT_OWNER });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/api-dev/owners", ...secureDevApi, async (req, res) => {
  if (req.user?.id !== PERMANENT_OWNER) {
    return res.status(403).json({ error: "Only the bot owner can add or remove developers." });
  }

  const { userId, action } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID required" });
  if (!["add", "remove"].includes(action)) return res.status(400).json({ error: "action must be 'add' or 'remove'" });
  if (action === "remove" && userId === PERMANENT_OWNER) {
    return res.status(403).json({ error: "Cannot remove the permanent owner" });
  }

  try {
    const OwnerSchema = require("../../../../Schemas/owner.js");
    let doc = await OwnerSchema.findOne();
    if (!doc) doc = await OwnerSchema.create({ owners: [PERMANENT_OWNER] });

    if (action === "add") {
      if (!doc.owners.includes(userId)) doc.owners.push(userId);
    } else {
      doc.owners = doc.owners.filter(id => id !== userId);
      if (!doc.owners.includes(PERMANENT_OWNER)) doc.owners.push(PERMANENT_OWNER);
    }

    await doc.save();
    console.log(`[DEV] Owner ${action}: ${userId} — by ${req.user?.username}`);
    res.json({ success: true, owners: doc.owners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;