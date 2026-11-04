const GuildInviteConfig = require('../../../Schemas/guildInviteConfig');
const InviteStats = require('../../../Schemas/inviteSchema');
const InviteJoin = require('../../../Schemas/inviteJoinRecord');
const router = require("express").Router();
const path = require("path");
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { encryptWebhook, decryptWebhook } = require('../../../Utils/webhookCrypto');
const { EmbedBuilder, WebhookClient, PermissionsBitField } = require('discord.js');

// ── Page ─────────────────────────────────────────────────────────────────────
router.get("/guild/:id/invite-config", isAuth, checkDashboardAccess('overview'), (req, res) =>
  sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/invite.html"))
);

// ── GET Config ────────────────────────────────────────────────────────────────
router.get("/api/guild/:id/invite-config", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const data = await GuildInviteConfig.findOne({ guildId: req.params.id });
    res.json(data || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// ── POST Config ───────────────────────────────────────────────────────────────
router.post("/api/guild/:id/invite-config", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const {
      enabled, welcomeChannelId, welcomeMessage, welcomeEmbedMode, welcomeCooldown,
      leave, logChannelId, verboseLogs,
      fakeAccountAgeDays, alertFake, ignoreBots, countLeavesAsNegative,
      trackInviteCodes, allowVanity,
      leaderboardChannelId, leaderboardInterval, showFakeInLeaderboard,
      embed, webhookWelcome,
      autoRolesEnabled, autoRoles, rewardRoles,
      milestonesEnabled, milestoneChannelId, milestones, inviteMilestones,
      dmWelcome, inviteFilter, maxJoinsPerDay
    } = req.body;

    // Preserve existing encrypted webhookToken if client didn't send one
    if (webhookWelcome && !webhookWelcome.webhookToken) {
      const existing = await GuildInviteConfig.findOne({ guildId: req.params.id }).select('+webhookWelcome.webhookToken').lean();
      if (existing?.webhookWelcome?.webhookToken) {
        webhookWelcome.webhookToken = existing.webhookWelcome.webhookToken;
      }
    } else if (webhookWelcome?.webhookToken) {
      webhookWelcome.webhookToken = encryptWebhook(webhookWelcome.webhookToken);
    }

    await GuildInviteConfig.findOneAndUpdate(
      { guildId: req.params.id },
      {
        enabled, welcomeChannelId, welcomeMessage, welcomeEmbedMode, welcomeCooldown,
        leave, logChannelId, verboseLogs,
        fakeAccountAgeDays, alertFake, ignoreBots, countLeavesAsNegative,
        trackInviteCodes, allowVanity,
        leaderboardChannelId, leaderboardInterval, showFakeInLeaderboard,
        embed, webhookWelcome,
        autoRolesEnabled, autoRoles: autoRoles || [],
        rewardRoles: rewardRoles || [],
        milestonesEnabled, milestoneChannelId,
        milestones: milestones || [],
        inviteMilestones: inviteMilestones || [],
        dmWelcome, inviteFilter,
        maxJoinsPerDay
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// ── POST Send Test — join message + log line, as if the dashboard user had just joined ──
// Mirrors Events/Client/guildMemberAdd_invite.js, using the form values sent by the page.
const testCooldowns = new Map();
router.post("/api/guild/:id/invite-config/test", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const now = Date.now();
  const last = testCooldowns.get(req.user.id) || 0;
  if (now - last < 10_000)
    return res.status(429).json({ error: `Please wait ${Math.ceil((10_000 - (now - last)) / 1000)}s before testing again.` });

  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });

  const cfg = req.body || {};
  if (!cfg.welcomeChannelId && !cfg.logChannelId)
    return res.status(400).json({ error: "Pick a welcome channel or a log channel first." });

  const user  = req.user;
  const tag   = user.global_name || user.username;
  const stats = await InviteStats.findOne({ guildId: guild.id, userId: user.id }).lean();
  const invites = stats ? (stats.invites || 0) + (stats.bonus || 0) : 0;
  const avatar = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`;
  const applyVars = (str) => String(str || '')
    .replaceAll('{user}', `<@${user.id}>`)
    .replaceAll('{username}', user.username)
    .replaceAll('{inviter}', tag)
    .replaceAll('{inviterId}', user.id)
    .replaceAll('{invites}', String(invites))
    .replaceAll('{fake}', 'no')
    .replaceAll('{url}', 'discord.gg/test')
    .replaceAll('{memberCount}', String(guild.memberCount))
    .replaceAll('{server}', guild.name)
    .replaceAll('{code}', 'test');

  // has() is async on the standalone shim, sync on discord.js — await works for both
  const canSend = async (ch) => !!ch && !!(await ch.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.SendMessages));
  const sent = [];
  try {
    // Welcome channel
    if (cfg.welcomeChannelId) {
      const ch = guild.channels.cache.get(cfg.welcomeChannelId);
      if (!(await canSend(ch))) return res.status(400).json({ error: "Roco can't send messages in the welcome channel." });

      if (cfg.embed?.enabled) {
        const e = cfg.embed;
        const embed = new EmbedBuilder()
          .setColor(/^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#6C53FF')
          .setTitle(applyVars(e.title || 'Welcome!').slice(0, 256));
        if (e.description) embed.setDescription(applyVars(e.description).slice(0, 4096));
        if (e.footer)      embed.setFooter({ text: applyVars(e.footer).slice(0, 2048) });
        if (e.thumbnail === 'avatar') embed.setThumbnail(avatar);
        if (e.thumbnail === 'server' && guild.iconURL()) embed.setThumbnail(guild.iconURL());
        if (e.image && /^https?:\/\//.test(e.image)) embed.setImage(e.image);
        if (e.showStats) embed.addFields(
          { name: 'Regular', value: String(stats?.regular ?? 0), inline: true },
          { name: 'Fake',    value: String(stats?.fake ?? 0),    inline: true },
          { name: 'Left',    value: String(stats?.left ?? 0),    inline: true },
        );

        // Webhook mode needs the saved (encrypted) token of the selected webhook
        let webhook = null;
        if (cfg.webhookWelcome?.enabled && cfg.webhookWelcome.webhookId) {
          const saved = await GuildInviteConfig.findOne({ guildId: guild.id }).select('+webhookWelcome.webhookToken').lean();
          const w = saved?.webhookWelcome;
          if (w?.webhookId === cfg.webhookWelcome.webhookId && w.webhookToken)
            webhook = new WebhookClient({ id: w.webhookId, token: decryptWebhook(w.webhookToken) });
        }
        if (webhook) {
          await webhook.send({
            embeds: [embed],
            username: applyVars(cfg.webhookWelcome.username || 'Welcome').slice(0, 80),
            avatarURL: cfg.webhookWelcome.avatarUrl || undefined,
          });
        } else {
          await ch.send({ embeds: [embed.toJSON()] });
        }
      } else {
        await ch.send({ content: applyVars(cfg.welcomeMessage || 'Welcome {user}!').slice(0, 2000) });
      }
      sent.push('welcome message');
    }

    // Log channel
    if (cfg.logChannelId) {
      const log = guild.channels.cache.get(cfg.logChannelId);
      if (await canSend(log)) {
        let msg = `<:files:1555544445565407352> **${tag}** joined — invited by **${tag}** (\`${user.id}\`) · *test*`;
        if (cfg.verboseLogs) msg += `\n> Code: \`test\` | Members: \`${guild.memberCount}\``;
        await log.send({ content: msg });
        sent.push('log line');
      }
    }

    testCooldowns.set(req.user.id, now);
    res.json({ success: true, sent: sent.join(' + ') });
  } catch (err) {
    console.error('[invite test]', err);
    res.status(500).json({ error: "Couldn't send the test message. Check Roco's permissions in that channel." });
  }
});

// ── POST Bonus Invites ────────────────────────────────────────────────────────
router.post("/api/guild/:id/invite-bonus", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== 'number') return res.status(400).json({ error: 'Invalid params' });

    await InviteStats.findOneAndUpdate(
      { guildId: req.params.id, userId },
      { $inc: { bonus: amount, invites: amount }, $set: { lastUpdated: Date.now() } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to apply bonus' });
  }
});

// ── POST Reset ────────────────────────────────────────────────────────────────
router.post("/api/guild/:id/invite-reset", isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const { type } = req.body;
    const guildId = req.params.id;

    if (type === 'stats') {
      await InviteStats.deleteMany({ guildId });
      await InviteJoin.deleteMany({ guildId });
    } else if (type === 'config') {
      await GuildInviteConfig.findOneAndDelete({ guildId });
    } else {
      return res.status(400).json({ error: 'Invalid reset type' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset' });
  }
});

module.exports = router;