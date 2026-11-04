const { Events, EmbedBuilder } = require('discord.js');
const YouTubeNotification = require('../../Schemas/youtubeSchema');

// ─── Constants ───────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000;           // Check every 30 seconds
const MAX_NOTIFIED_IDS = 200;              // Keep more IDs to reduce churn on restart
const YOUTUBE_RED = '#FF0000';

// ─── YouTube API helpers ──────────────────────────────────────────────────────

/**
 * Resolves a YouTube channel URL to its canonical channel ID.
 * Called once at setup time, result is stored in the DB.
 */
async function resolveChannelId(url, apiKey) {
  if (url.includes('/channel/')) {
    return url.split('/channel/')[1].split(/[?/]/)[0];
  }
  if (url.includes('/@')) {
    const handle = url.split('/@')[1].split(/[?/]/)[0];
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`
    );
    const data = await res.json();
    return data.items?.[0]?.id ?? null;
  }
  // Treat it as a raw channel ID
  return url.trim() || null;
}

/**
 * Fetches the 10 most recent videos/streams for a channel ID.
 * Returns an array of { videoId, title, publishedAt, thumbnail, isLive, url }.
 */
async function fetchLatestContent(channelId, apiKey) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&key=${apiKey}`
  );
  const data = await res.json();

  if (!data.items) return [];

  return data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    publishedAt: new Date(item.snippet.publishedAt),
    thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? null,
    channelTitle: item.snippet.channelTitle,
    description: item.snippet.description?.slice(0, 200) || '',
    isLive: item.snippet.liveBroadcastContent === 'live',
    isUpcoming: item.snippet.liveBroadcastContent === 'upcoming',
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

// ─── Embed builders ───────────────────────────────────────────────────────────

function buildVideoEmbed(video, customMessage) {
  return new EmbedBuilder()
    .setColor(YOUTUBE_RED)
    .setAuthor({ name: video.channelTitle, iconURL: 'https://i.imgur.com/iKFGRiS.png' })
    .setTitle(video.title)
    .setURL(video.url)
    .setDescription(`${customMessage}\n\n<:files:1555544445565407352> **New Upload!**\n${video.description ? `> ${video.description}` : ''}`)
    .setThumbnail(video.thumbnail)
    .addFields({ name: '▶ Watch Now', value: video.url, inline: false })
    .setTimestamp(video.publishedAt)
    .setFooter({ text: 'YouTube Notifications • Roco' });
}

function buildStreamEmbed(video, customMessage) {
  return new EmbedBuilder()
    .setColor('#FF4500')
    .setAuthor({ name: video.channelTitle, iconURL: 'https://i.imgur.com/iKFGRiS.png' })
    .setTitle(`🔴 ${video.title}`)
    .setURL(video.url)
    .setDescription(`${customMessage}\n\n🔴 **LIVE NOW!**\n${video.description ? `> ${video.description}` : ''}`)
    .setThumbnail(video.thumbnail)
    .addFields({ name: '📺 Watch Live', value: video.url, inline: false })
    .setTimestamp()
    .setFooter({ text: 'YouTube Live Notifications • Roco' });
}

// ─── Poller ───────────────────────────────────────────────────────────────────

async function pollYouTube(client) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return console.error('[YouTubeNotif] YOUTUBE_API_KEY not set!');

  let configs;
  try {
    configs = await YouTubeNotification.find();
  } catch (err) {
    return console.error('[YouTubeNotif] DB error fetching configs:', err.message);
  }

  for (const config of configs) {
    try {
      // ── Resolve channel ID once and cache it ──────────────────────────────
      if (!config.ResolvedChannelId) {
        const resolved = await resolveChannelId(config.YouTubeChannel, apiKey);
        if (!resolved) {
          console.warn(`[YouTubeNotif] Could not resolve channel ID for: ${config.YouTubeChannel}`);
          continue;
        }
        config.ResolvedChannelId = resolved;
        await config.save();
      }

      const videos = await fetchLatestContent(config.ResolvedChannelId, apiKey);
      if (!videos.length) continue;

      // ── Seed LastNotified on very first poll for this config ──────────
      // If LastNotified has never been set, initialise it to the most-recent
      // video's publishedAt.  This means an existing config that just upgraded
      // will NOT re-fire for every historical video in the results.
      if (!config.LastNotified) {
        const newestDate = videos.reduce((max, v) => v.publishedAt > max ? v.publishedAt : max, new Date(0));
        config.LastNotified = newestDate;
        await config.save();
        console.log(`[YouTubeNotif] Seeded LastNotified for config ${config._id} to ${newestDate.toISOString()}`);
        continue; // Skip notification on the seeding run
      }

      // Build a set of already-notified IDs for fast lookup
      const notifiedSet = new Set(config.NotifiedVideoIds);

      // Track whether we need to save this config
      let dirty = false;

      for (const video of videos) {
        const { videoId, isLive, isUpcoming } = video;

        // Skip upcoming streams (not live yet, not a regular upload)
        if (isUpcoming) continue;

        // ── publishedAt guard ─────────────────────────────────────────────
        // Never notify for a video published BEFORE this config's LastNotified
        // timestamp.  This is the safety net when IDs fall off the NotifiedVideoIds
        // cap after a restart — old videos are suppressed by date, not just by ID.
        if (!isLive && config.LastNotified instanceof Date) {
          if (video.publishedAt <= config.LastNotified) continue;
        }

        // ── Live stream handling ──────────────────────────────────────────
        if (isLive) {
          if (!config.NotifyStreams) continue;
          // Only notify once per unique stream ID
          if (config.ActiveStreamId === videoId) continue;
          if (notifiedSet.has(videoId)) continue;
        } else {
          // ── Regular upload handling ───────────────────────────────────
          if (!config.NotifyUploads) continue;
          if (notifiedSet.has(videoId)) continue;
        }

        // ── Fetch Discord channel ─────────────────────────────────────────
        let discordChannel;
        try {
          discordChannel = await client.channels.fetch(config.Channel);
        } catch {
          console.error(`[YouTubeNotif] Cannot fetch Discord channel ${config.Channel}`);
          break; // Skip all videos for this config if channel is unreachable
        }
        if (!discordChannel) break;

        // ── Build and send notification ───────────────────────────────────
        const embed = isLive
          ? buildStreamEmbed(video, config.Message)
          : buildVideoEmbed(video, config.Message);

        const pingContent = config.PingRole ? `<@&${config.PingRole}>` : null;

        try {
          await discordChannel.send({
            content: pingContent,
            embeds: [embed],
          });
        } catch (err) {
          console.error(`[YouTubeNotif] Failed to send to ${config.Channel}: ${err.message}`);
          continue;
        }

        // ── Mark as notified ──────────────────────────────────────────────
        notifiedSet.add(videoId);
        if (isLive) config.ActiveStreamId = videoId;

        // Advance the high-water mark so this video's date is never re-sent
        // even if its ID ages off the NotifiedVideoIds cap after a restart.
        if (!isLive) {
          if (!config.LastNotified || video.publishedAt > config.LastNotified) {
            config.LastNotified = video.publishedAt;
          }
        }

        dirty = true;
      }

      // Clear active stream ID if it's no longer live
      if (config.ActiveStreamId) {
        const stillLive = videos.some(v => v.videoId === config.ActiveStreamId && v.isLive);
        if (!stillLive) {
          config.ActiveStreamId = null;
          dirty = true;
        }
      }

      if (dirty) {
        // Trim notified IDs array to prevent unbounded growth
        config.NotifiedVideoIds = [...notifiedSet].slice(-MAX_NOTIFIED_IDS);
        config.LastChecked = new Date();
        await config.save();
      }
    } catch (err) {
      console.error(`[YouTubeNotif] Unhandled error for config ${config._id}:`, err.message);
    }
  }
}

// ─── Module export ────────────────────────────────────────────────────────────

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Without an API key every poll would fail — log once instead of every 30s
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('[YouTubeNotif] YOUTUBE_API_KEY not set — YouTube notifications are disabled.');
      return;
    }
    console.log('[YouTubeNotif] Poller started — interval:', POLL_INTERVAL_MS / 1000, 'seconds');

    // Run immediately on startup, then on interval
    await pollYouTube(client);
    setInterval(() => pollYouTube(client), POLL_INTERVAL_MS);
  },

  // Exported so the /youtube command can call resolveChannelId at setup time
  resolveChannelId,
};