const { Events, EmbedBuilder } = require('discord.js');
const TwitchNotification = require('../../Schemas/twitchSchema');

// ─── Constants ────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000;   // Check every 30 seconds
const TWITCH_PURPLE = '#9147FF';

// ─── Token management ─────────────────────────────────────────────────────────
// Twitch uses OAuth2 App Access Tokens, which expire. Cache + refresh automatically.
let cachedToken = null;
let tokenExpiry = 0;

async function getTwitchToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET not set in environment!');
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ─── Twitch API helpers ───────────────────────────────────────────────────────

/**
 * Returns stream data if the user is live, or null if offline.
 * { id, title, gameName, viewerCount, startedAt, thumbnailUrl }
 */
async function getStreamInfo(username) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = await getTwitchToken();

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
    {
      headers: {
        'Client-Id': clientId,
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const stream = data.data?.[0];
  if (!stream) return null;

  return {
    id: stream.id,
    title: stream.title,
    gameName: stream.game_name,
    viewerCount: stream.viewer_count,
    startedAt: new Date(stream.started_at),
    thumbnailUrl: stream.thumbnail_url
      ?.replace('{width}', '1280')
      ?.replace('{height}', '720'),
    userName: stream.user_name,
    userLogin: stream.user_login,
  };
}

/**
 * Fetches the Twitch user's profile picture for the embed.
 */
async function getUserAvatar(username) {
  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const token = await getTwitchToken();
    const res = await fetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
      { headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.data?.[0]?.profile_image_url ?? null;
  } catch {
    return null;
  }
}

// ─── Embed builders ───────────────────────────────────────────────────────────

function buildLiveEmbed(stream, avatarUrl, customMessage) {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle(`🔴 ${stream.userName} is LIVE!`)
    .setURL(`https://www.twitch.tv/${stream.userLogin}`)
    .setDescription(
      `${customMessage}\n\n**${stream.title}**\n` +
      (stream.gameName ? `🎮 Playing **${stream.gameName}**\n` : '') +
      `👥 **${stream.viewerCount.toLocaleString()}** viewers`
    )
    .addFields({ name: '📺 Watch Now', value: `https://www.twitch.tv/${stream.userLogin}`, inline: false })
    .setTimestamp(stream.startedAt)
    .setFooter({ text: 'Twitch Live Notifications • RankCore' });

  if (stream.thumbnailUrl) embed.setImage(stream.thumbnailUrl);
  if (avatarUrl) embed.setThumbnail(avatarUrl);

  return embed;
}

function buildStreamEndedEmbed(username) {
  return new EmbedBuilder()
    .setColor('#555555')
    .setTitle(`⚫ ${username} has gone offline`)
    .setDescription(`The stream has ended. Thanks for watching!`)
    .setTimestamp()
    .setFooter({ text: 'Twitch Live Notifications • RankCore' });
}

// ─── Poller ───────────────────────────────────────────────────────────────────

// In-memory live status cache to avoid hammering the DB on every tick
const liveStatusCache = new Map(); // configId → boolean

async function pollTwitch(client) {
  let configs;
  try {
    configs = await TwitchNotification.find();
  } catch (err) {
    return console.error('[TwitchNotif] DB error fetching configs:', err.message);
  }

  for (const config of configs) {
    try {
      const username = config.Streamer.replace('https://www.twitch.tv/', '').split('/')[0];

      const streamInfo = await getStreamInfo(username);
      const isCurrentlyLive = !!streamInfo;
      const configId = config._id.toString();

      // ── Stream went live ──────────────────────────────────────────────────
      if (isCurrentlyLive && !config.IsLiveNotified && config.NotifiedStreamId !== streamInfo.id) {
        let discordChannel;
        try {
          discordChannel = await client.channels.fetch(config.Channel);
        } catch {
          console.error(`[TwitchNotif] Cannot fetch Discord channel ${config.Channel}`);
          continue;
        }
        if (!discordChannel) continue;

        const avatarUrl = await getUserAvatar(username);
        const embed = buildLiveEmbed(streamInfo, avatarUrl, config.Message);
        const pingContent = config.PingRole ? `<@&${config.PingRole}>` : null;

        try {
          await discordChannel.send({ content: pingContent, embeds: [embed] });
        } catch (err) {
          console.error(`[TwitchNotif] Failed to send to ${config.Channel}: ${err.message}`);
          continue;
        }

        config.IsLiveNotified = true;
        config.NotifiedStreamId = streamInfo.id;
        config.LastChecked = new Date();
        await config.save();
        liveStatusCache.set(configId, true);
      }

      // ── Stream ended ──────────────────────────────────────────────────────
      if (!isCurrentlyLive && config.IsLiveNotified) {
        if (config.NotifyStreamEnd) {
          let discordChannel;
          try {
            discordChannel = await client.channels.fetch(config.Channel);
          } catch { /* skip offline embed if channel unreachable */ }

          if (discordChannel) {
            const embed = buildStreamEndedEmbed(username);
            await discordChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }

        config.IsLiveNotified = false;
        config.NotifiedStreamId = null;
        config.LastChecked = new Date();
        await config.save();
        liveStatusCache.set(configId, false);
      }
    } catch (err) {
      console.error(`[TwitchNotif] Error for config ${config._id}:`, err.message);
    }
  }
}

// ─── Module export ────────────────────────────────────────────────────────────

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log('[TwitchNotif] Poller started — interval:', POLL_INTERVAL_MS / 1000, 'seconds');

    await pollTwitch(client);
    setInterval(() => pollTwitch(client), POLL_INTERVAL_MS);
  },
};