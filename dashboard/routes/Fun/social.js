const express  = require('express');
const router   = express.Router();
const { EmbedBuilder } = require('discord.js');

const YouTubeNotification = require('../../../Schemas/youtubeSchema');
const TwitchNotification  = require('../../../Schemas/twitchSchema');
const TwitterNotification = require('../../../Schemas/twitterSchema');

// Pulled in from the event files so we can resolve IDs at setup time
// rather than on every poll tick — keeps the poller fast.
const { resolveChannelId: resolveYouTubeChannelId } = require('../../../Events/Others/youtubeNotification');

const path = require('path');
const { isAuth, sendHTMLWithNonce, checkDashboardAccess } = require('../../middleware');
const { getLimits, limitError } = require('../Utils/limits');

// ─── Page routes ──────────────────────────────────────────────────────────────

// Unified social page — available to all tiers (free gets 1 YT + 1 Twitch slot)
router.get('/guild/:id/social', isAuth, checkDashboardAccess('overview'), (req, res) => {
  sendHTMLWithNonce(res, path.join(__dirname, '../../views/features/social.html'));
});

// Legacy redirects — old bookmarks / sidebar links still work
router.get('/guild/:id/youtube', isAuth, checkDashboardAccess('overview'), (req, res) => {
  res.redirect(301, `/guild/${req.params.id}/social`);
});
router.get('/guild/:id/twitch', isAuth, checkDashboardAccess('overview'), (req, res) => {
  res.redirect(301, `/guild/${req.params.id}/social`);
});

// ─── YouTube API ──────────────────────────────────────────────────────────────

// GET all YouTube configs for a guild
router.get('/api/guild/:id/social/youtube', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const configs = await YouTubeNotification.find({ Guild: req.params.id }).lean();
    res.json(configs);
  } catch (err) {
    console.error('[Social API] GET youtube:', err.message);
    res.status(500).json({ error: 'Failed to fetch YouTube configs.' });
  }
});

// POST create a new YouTube config
router.post('/api/guild/:id/social/youtube', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const { channelId, youtubeUrl, message, pingRole, notifyUploads, notifyStreams } = req.body;

  if (!channelId || !youtubeUrl || !message) {
    return res.status(400).json({ error: 'channelId, youtubeUrl, and message are required.' });
  }

  try {
    const lim      = await getLimits(req.user?.id, req.params.id);
    const existing = await YouTubeNotification.find({ Guild: req.params.id });

    if (existing.length >= lim.youtubeFeeds) {
      return res.status(400).json({
        error: limitError(lim, 'YouTube alerts'),
        limit: lim.youtubeFeeds,
        tier:  lim.tier,
      });
    }

    // Pick the next available slot number
    const used    = new Set(existing.map(c => c.SetupNumber));
    const slotNum = Array.from({ length: lim.youtubeFeeds }, (_, i) => i + 1).find(n => !used.has(n)) ?? existing.length + 1;

    // Resolve the channel ID now so the poller never has to do it per tick
    const apiKey = process.env.YOUTUBE_API_KEY;
    let resolvedChannelId = null;
    if (apiKey) {
      resolvedChannelId = await resolveYouTubeChannelId(youtubeUrl, apiKey).catch(() => null);
    }

    const config = await YouTubeNotification.create({
      Guild:             req.params.id,
      Channel:           channelId,
      YouTubeChannel:    youtubeUrl,
      ResolvedChannelId: resolvedChannelId,
      Message:           message,
      PingRole:          pingRole || null,
      NotifyUploads:     notifyUploads !== false,
      NotifyStreams:      notifyStreams !== false,
      SetupNumber:       slotNum,
    });

    res.status(201).json({ ...config.toObject(), _limits: { used: existing.length + 1, max: lim.youtubeFeeds, tier: lim.tier } });
  } catch (err) {
    console.error('[Social API] POST youtube:', err.message);
    res.status(500).json({ error: 'Failed to create YouTube alert.' });
  }
});

// DELETE a YouTube config by MongoDB _id
router.delete('/api/guild/:id/social/youtube/:docId', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const result = await YouTubeNotification.deleteOne({ _id: req.params.docId, Guild: req.params.id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Config not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Social API] DELETE youtube:', err.message);
    res.status(500).json({ error: 'Failed to delete YouTube alert.' });
  }
});

// POST send a test YouTube notification
router.post('/api/guild/:id/social/youtube/:docId/test', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const config = await YouTubeNotification.findOne({ _id: req.params.docId, Guild: req.params.id });
    if (!config) return res.status(404).json({ error: 'Config not found.' });

    const client = req.client;
    let channel;
    try { channel = await client.channels.fetch(config.Channel); }
    catch { return res.status(400).json({ error: 'Could not fetch the Discord channel. Check it still exists.' }); }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setAuthor({ name: 'Test Channel', iconURL: 'https://i.imgur.com/iKFGRiS.png' })
      .setTitle('🧪 Test Notification — YouTube Upload')
      .setURL('https://www.youtube.com')
      .setDescription(`${config.Message}\n\n📁 **New Upload!**\n> This is a test notification from RankCore. Your YouTube alerts are working correctly.`)
      .addFields({ name: '▶ Watch Now', value: 'https://www.youtube.com', inline: false })
      .setThumbnail('https://i.imgur.com/iKFGRiS.png')
      .setTimestamp()
      .setFooter({ text: 'YouTube Notifications • RankCore' });

    await channel.send({
      content: config.PingRole ? `<@&${config.PingRole}>` : null,
      embeds:  [embed],
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Social API] POST youtube test:', err.message);
    res.status(500).json({ error: 'Failed to send test notification.' });
  }
});

// GET limits for the social page (called by the frontend to show slot counts)
router.get('/api/guild/:id/social/limits', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const lim = await getLimits(req.user?.id, req.params.id);
    res.json({
      youtubeFeeds: lim.youtubeFeeds,
      twitchFeeds:  lim.twitchFeeds,
      tier:         lim.tier,
      tierName:     lim.tierName,
      tierEmoji:    lim.tierEmoji,
      isPremium:    lim.isPremium,
    });
  } catch (err) {
    console.error('[Social API] GET limits:', err.message);
    res.status(500).json({ error: 'Failed to fetch limits.' });
  }
});

// ─── Twitch API ───────────────────────────────────────────────────────────────

// GET all Twitch configs for a guild
router.get('/api/guild/:id/social/twitch', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const configs = await TwitchNotification.find({ Guild: req.params.id }).lean();
    res.json(configs);
  } catch (err) {
    console.error('[Social API] GET twitch:', err.message);
    res.status(500).json({ error: 'Failed to fetch Twitch configs.' });
  }
});

// POST create a new Twitch config
router.post('/api/guild/:id/social/twitch', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  const { channelId, streamerUrl, message, pingRole, notifyStreamEnd } = req.body;

  if (!channelId || !streamerUrl || !message) {
    return res.status(400).json({ error: 'channelId, streamerUrl, and message are required.' });
  }
  if (!streamerUrl.includes('twitch.tv/')) {
    return res.status(400).json({ error: 'Invalid Twitch URL. Must include twitch.tv/' });
  }

  try {
    const lim      = await getLimits(req.user?.id, req.params.id);
    const existing = await TwitchNotification.find({ Guild: req.params.id });

    if (existing.length >= lim.twitchFeeds) {
      return res.status(400).json({
        error: limitError(lim, 'Twitch alerts'),
        limit: lim.twitchFeeds,
        tier:  lim.tier,
      });
    }

    // Pick the next available slot number
    const used    = new Set(existing.map(c => c.SetupNumber));
    const slotNum = Array.from({ length: lim.twitchFeeds }, (_, i) => i + 1).find(n => !used.has(n)) ?? existing.length + 1;

    const config = await TwitchNotification.create({
      Guild:           req.params.id,
      Channel:         channelId,
      Streamer:        streamerUrl,
      Message:         message,
      PingRole:        pingRole || null,
      NotifyStreamEnd: !!notifyStreamEnd,
      SetupNumber:     slotNum,
    });

    res.status(201).json({ ...config.toObject(), _limits: { used: existing.length + 1, max: lim.twitchFeeds, tier: lim.tier } });
  } catch (err) {
    console.error('[Social API] POST twitch:', err.message);
    res.status(500).json({ error: 'Failed to create Twitch alert.' });
  }
});

// DELETE a Twitch config by MongoDB _id
router.delete('/api/guild/:id/social/twitch/:docId', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const result = await TwitchNotification.deleteOne({ _id: req.params.docId, Guild: req.params.id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Config not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('[Social API] DELETE twitch:', err.message);
    res.status(500).json({ error: 'Failed to delete Twitch alert.' });
  }
});

// POST send a test Twitch notification
router.post('/api/guild/:id/social/twitch/:docId/test', isAuth, checkDashboardAccess('overview'), async (req, res) => {
  try {
    const config = await TwitchNotification.findOne({ _id: req.params.docId, Guild: req.params.id });
    if (!config) return res.status(404).json({ error: 'Config not found.' });

    const client = req.client;
    let channel;
    try { channel = await client.channels.fetch(config.Channel); }
    catch { return res.status(400).json({ error: 'Could not fetch the Discord channel. Check it still exists.' }); }

    const streamerName = config.Streamer.replace(/https?:\/\/(www\.)?twitch\.tv\//,'').split('/')[0];

    const embed = new EmbedBuilder()
      .setColor('#9147FF')
      .setTitle(`🧪 Test Notification — ${streamerName} is LIVE!`)
      .setURL(`https://twitch.tv/${streamerName}`)
      .setDescription(`${config.Message}\n\n🔴 **TEST STREAM**\n🎮 Playing **Test Category**\n👥 **1,337** viewers\n\nThis is a test notification from RankCore. Your Twitch alerts are working correctly.`)
      .addFields({ name: '📺 Watch Now', value: `https://twitch.tv/${streamerName}`, inline: false })
      .setTimestamp()
      .setFooter({ text: 'Twitch Notifications • RankCore' });

    await channel.send({
      content: config.PingRole ? `<@&${config.PingRole}>` : null,
      embeds:  [embed],
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Social API] POST twitch test:', err.message);
    res.status(500).json({ error: 'Failed to send test notification.' });
  }
});

// ─── Legacy API compatibility ─────────────────────────────────────────────────
// Old dashboard pages called /api/guild/:id/twitch and /api/guild/:id/youtube.
// Redirect them to the new paths so nothing breaks during transition.

router.get('/api/guild/:id/twitch',         isAuth, (req, res) => res.redirect(307, `/api/guild/${req.params.id}/social/twitch`));
router.post('/api/guild/:id/twitch',        isAuth, (req, res) => res.redirect(307, `/api/guild/${req.params.id}/social/twitch`));
router.delete('/api/guild/:id/twitch/:did', isAuth, (req, res) => res.redirect(307, `/api/guild/${req.params.id}/social/twitch/${req.params.did}`));
router.get('/api/guild/:id/youtube',         isAuth, (req, res) => res.redirect(307, `/api/guild/${req.params.id}/social/youtube`));
router.post('/api/guild/:id/youtube',        isAuth, (req, res) => res.redirect(307, `/api/guild/${req.params.id}/social/youtube`));
router.delete('/api/guild/:id/youtube/:num', isAuth, (req, res) => res.redirect(307, `/api/guild/${req.params.id}/social/youtube/${req.params.num}`));

// ─── Twitter discontinued ─────────────────────────────────────────────────────
// Any attempt to use Twitter endpoints returns a clear explanation.
router.all('/api/guild/:id/twitter*', isAuth, (req, res) => {
  res.status(410).json({
    error: 'Twitter/X notifications have been discontinued.',
    reason: 'The Twitter/X API free tier no longer supports reliable polling for Discord bots. Use YouTube or Twitch notifications instead.',
  });
});

module.exports = router;