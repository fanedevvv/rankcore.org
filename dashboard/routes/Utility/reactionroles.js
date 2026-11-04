const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');
const { getLimits, limitError } = require("../Utils/limits");

/* ========== REACTION ROLES ROUTES (NEW) ========== */
const ReactionRole = require("../../../Schemas/reactionrole");

router.get("/guild/:id/reactionrole", isAuth, checkDashboardAccess('reaction'), (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/reactionrole.html")));

// 2. Get All
router.get("/api/guild/:id/reactionrole", isAuth, checkDashboardAccess('reaction'), async (req, res) => {
  try {
    const data = await ReactionRole.find({ Guild: req.params.id });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reaction roles" });
  }
});

// 3. Create
router.post("/api/guild/:id/reactionrole", isAuth, checkDashboardAccess('reaction'), async (req, res) => {
  const { channelId, messageId, emoji, roleId } = req.body;

  if (!channelId || !messageId || !emoji || !roleId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const guild = req.client.guilds.cache.get(req.params.id);
  const channel = guild?.channels.cache.get(channelId);

  if (!channel) {
    return res.status(400).json({ error: "Channel not found" });
  }

  try {
    const lim = await getLimits(req.user?.id, req.params.id);
    const count = await ReactionRole.countDocuments({ Guild: req.params.id });
    if (count >= lim.reactionRoles) return res.status(400).json({ error: limitError(lim, 'reaction roles') });

    const message = channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);
    if (!message) {
      return res.status(400).json({ error: "Message not found in that channel" });
    }

    const existing = await ReactionRole.findOne({ 
      Guild: req.params.id, 
      Message: messageId, 
      Emoji: emoji 
    });

    if (existing) {
      return res.status(400).json({ error: "This reaction role already exists" });
    }

    try {
      await message.react(emoji);
    } catch (reactErr) {
      return res.status(400).json({ error: "Bot failed to react. Is the emoji valid/accessible?" });
    }

    await ReactionRole.create({
      Guild: req.params.id,
      Message: messageId,
      Emoji: emoji,
      Role: roleId,
      Channel: channelId
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create reaction role" });
  }
});

// 4. Delete
router.delete(
  "/api/guild/:guildId/reactionrole/:rrId",
  isAuth, checkDashboardAccess('reaction'),
  async (req, res) => {
    try {
      await ReactionRole.deleteOne({
        _id: req.params.rrId,
        Guild: req.params.guildId
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete reaction role" });
    }
  }
);

module.exports = router;