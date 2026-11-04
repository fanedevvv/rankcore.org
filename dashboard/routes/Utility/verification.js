const Verify = require("../../../Schemas/verificationSchema");
const { logEmbedSend, logVerifyAction } = require("../Utils/dashboardLoggers");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');
const router = require("express").Router();
const path = require("path");
const { cbSend } = require("../../lib/cbSend");
const PANEL_COOLDOWN_MS = 60 * 60 * 1000;

router.get("/guild/:id/verify", isAuth, checkDashboardAccess('verification'), (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/auth/verify.html")));
/* ======= GET CONFIG ======= */
router.get("/api/guild/:id/verify", isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    const data = await Verify.findOne({ Guild: req.params.id });
    res.json(data || {
      Channel: "",
      Role: "",
      unverifiedRole: "",
      Message: "",
      MessageContent: "Click the button below to verify!",
      Verified: [],
      Color: "#6C53FF",
      Thumbnail: "",
      Image: "",
      Footer: ""
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load verification config" });
  }
});

/* ======= SAVE CONFIG ======= */
router.post("/api/guild/:id/verify",isAuth, checkDashboardAccess('verification'), async (req, res) => {
  const {
    Channel, Role, unverifiedRole, MessageContent,
    Color, Thumbnail, Image, Footer
  } = req.body;

  if (!Channel || !Role) return res.status(400).json({ error: "Channel and Role are required" });

  try {
    const config = await Verify.findOneAndUpdate(
      { Guild: req.params.id },
      { Channel, Role, unverifiedRole, MessageContent, Color, Thumbnail, Image, Footer },
      { upsert: true, new: true }
    );
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: "Failed to save verification config" });
  }
});

/* ======= DELETE CONFIG ======= */
router.delete("/api/guild/:id/verify",isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    await Verify.findOneAndDelete({ Guild: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete verification config" });
  }
});

/* ======= SEND VERIFICATION MESSAGE ======= */
router.post("/api/guild/:id/verify/send", isAuth, checkDashboardAccess('verification'), async (req, res) => {
  try {
    const guildId = req.params.id;
    const config = await Verify.findOne({ Guild: guildId });

    if (!config) return res.status(400).json({ error: "No verification config found" });

    // --- Cooldown check ---
    if (config.LastPanelSent) {
      const elapsed = Date.now() - config.LastPanelSent.getTime();
      if (elapsed < PANEL_COOLDOWN_MS) {
        const remainingMin = Math.ceil((PANEL_COOLDOWN_MS - elapsed) / 60000);
        return res.status(429).json({
          error: `You can only send one verification panel every ${PANEL_COOLDOWN_MS / 60000} minutes.`,
          remaining: remainingMin
        });
      }
    }

    const guild = await req.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(config.Channel);
    if (!channel) return res.status(400).json({ error: "Channel not found" });

    const embedColor = config.Color
      ? parseInt(config.Color.replace("#", ""), 16)
      : 0x6C53FF;

    const embed = {
      color: embedColor,
      title: "Verification",
      description: config.MessageContent || "Click the button below to verify!",
      thumbnail: config.Thumbnail ? { url: config.Thumbnail } : undefined,
      image: config.Image ? { url: config.Image } : undefined,
      footer: config.Footer ? { text: config.Footer } : undefined
    };

    const { messageId: verifyMsgId } = await cbSend(req, guildId, channel, {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Verify", custom_id: "captchaenter" }
          ]
        }
      ]
    });
    const message = { id: verifyMsgId };

    // --- Save message + cooldown ---
    config.Message = message.id;
    config.LastPanelSent = new Date();
    await config.save();

    // --- LOG ---
    logVerifyAction({
      userId: req.user.id,
      guildId,
      channelId: channel.id,
      messageId: message.id,
      command: "dashboard_verify_send",
      embed,
      fields: [
        { name: "User ID", value: req.user.id, inline: true },
        { name: "Guild ID", value: guildId, inline: true },
        { name: "Channel ID", value: channel.id, inline: true },
        { name: "Message Content", value: embed.description ? `\`\`\`${embed.description.slice(0, 900)}\`\`\`` : "*None*" },
        { name: "Embed Config", value: `\`\`\`json\n${JSON.stringify(embed, null, 2).slice(0, 900)}\n\`\`\`` }
      ],
      footer: { text: `Message ID: ${message.id}` },
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, messageId: message.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send verification message" });
  }
});

module.exports = router;