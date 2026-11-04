// Native fetch (Node 18+); node-fetch v3 is ESM-only and can't be require()d on Node 21
const fetch = globalThis.fetch;
const uptimeSchema = require('../../Schemas/uptimeSchema');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const dns = require('dns').promises;
const net = require('net');

// ── SSRF Protection ───────────────────────────────────────────────────────────
// Block requests to private/loopback/link-local IP ranges.
const PRIVATE_IP_RANGES = [
  /^127\./,                          // loopback
  /^10\./,                           // RFC1918
  /^192\.168\./,                     // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,     // RFC1918
  /^169\.254\./,                     // link-local (AWS metadata, etc.)
  /^::1$/,                           // IPv6 loopback
  /^fc00:/,                          // IPv6 unique local
  /^fe80:/,                          // IPv6 link-local
];

async function isSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false; // unparseable
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) return false;

  // Resolve hostname to IP and check it isn't private
  let addresses;
  try {
    addresses = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    return false; // unresolvable host
  }

  for (const { address } of addresses) {
    if (PRIVATE_IP_RANGES.some(re => re.test(address))) return false;
  }

  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

const inMemory = {
  consecutiveFails: new Map()
};

// Webhook logging
const LOG_WEBHOOK_URL = process.env.UPTIME_LOG_WEBHOOK;

const sendWebhookLog = async (client, title, description, color = '#ffffff') => {
  if (!LOG_WEBHOOK_URL) return;

  try {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    await axios.post(LOG_WEBHOOK_URL, { embeds: [embed.toJSON()] });
  } catch (err) {
    console.error('[Webhook] Failed to send log embed'); // intentionally omit URL to avoid leaking it in logs
  }
};

// Ping logic
const pingUrl = async (url, timeout = 10000) => {
  try {
    const start = Date.now();
    const res = await axios.get(url, { timeout, validateStatus: null });
    return {
      ok: res.status >= 200 && res.status < 400,
      time: Date.now() - start,
      statusCode: res.status
    };
  } catch (err) {
    return { ok: false, time: 0, error: err.message };
  }
};

// <:announcement:1555544345740967956> Unified alert sender (channel > DM)
const sendAlert = async (client, doc, embed) => {
  // Channel first
  if (doc.AlertChannel) {
    const guild = client.guilds.cache.get(doc.Guild);
    const channel = guild?.channels.cache.get(doc.AlertChannel);
    if (channel?.isTextBased()) {
      return channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  // Fallback to DM
  if (doc.AlertDM) {
    const user = await client.users.fetch(doc.User).catch(() => null);
    if (user) {
      return user.send({ embeds: [embed] }).catch(() => {});
    }
  }
};

module.exports = async (client) => {
  const loop = async () => {
    const nowStr = new Date().toLocaleString();
    
    await sendWebhookLog(client, 'Uptime Check Started', nowStr, '#00aaff');

    const all = await uptimeSchema.find();
    

    for (const doc of all) {
      try {
        const key = doc._id.toString();
        const lastPingTime = doc.LastPing ? new Date(doc.LastPing).getTime() : 0;
        const intervalMs = (doc.Interval || 5) * 60 * 1000;

        if (Date.now() - lastPingTime < intervalMs) continue;

        const previousStatus = doc.LastStatus;

        // ── SSRF guard ───────────────────────────────────────────────────────
        if (!(await isSafeUrl(doc.URL))) {
          console.warn(`[Uptime] Blocked unsafe URL for doc ${doc._id}: ${doc.URL}`);
          continue;
        }

        const result = await pingUrl(doc.URL);

        doc.TotalPings++;
        doc.LastPing = new Date();

        doc.RecentPings.push({
          time: doc.LastPing,
          status: result.ok ? 'online' : 'offline',
          response: result.time
        });
        if (doc.RecentPings.length > 10) doc.RecentPings.shift();

        if (!result.ok) {
          doc.FailedPings++;
          const fails = (inMemory.consecutiveFails.get(key) || 0) + 1;
          inMemory.consecutiveFails.set(key, fails);

          if (fails === 3) {
            const embed = new EmbedBuilder()
              .setColor('#ff5555')
              .setTitle('<:error:1555544434601369620> Website DOWN')
              .setDescription(
                `<:1430986227909263442:1555544212756242532> ${doc.URL}\n` +
                `Checked: ${doc.LastPing.toLocaleString()}\n` +
                `Reason: ${result.error || 'Failed to respond'}`
              );

            await sendAlert(client, doc, embed);
          }

          doc.LastStatus = 'offline';
        } else {
          inMemory.consecutiveFails.set(key, 0);

          if (previousStatus === 'offline') {
            const embed = new EmbedBuilder()
              .setColor('#22bb33')
              .setTitle('<a:tickyy:1555544712687915008> Website RECOVERED')
              .setDescription(
                `<:1430986227909263442:1555544212756242532> ${doc.URL}\n` +
                `Response: ${result.time}ms\n` +
                `Checked: ${doc.LastPing.toLocaleString()}`
              );

            await sendAlert(client, doc, embed);
          }

          doc.LastStatus = 'online';
        }

        doc.UptimePercent = doc.TotalPings
          ? Math.max(0, ((doc.TotalPings - doc.FailedPings) / doc.TotalPings) * 100)
          : 100;

        await doc.save();
      } catch (err) {
        console.error('[Uptime] Error:', err);
        await sendWebhookLog(
          client,
          '<:crossy:1555544390221562048> Uptime Error',
          `Error checking ${doc.URL}\n\`\`\`${err.message}\`\`\``,
          '#ff0000'
        );
      }
    }

    const endStr = new Date().toLocaleString();
    await sendWebhookLog(client, 'Uptime Check Finished', endStr, '#00aaff');
  };

  setInterval(loop, 60 * 1000);
  setTimeout(loop, 5000);
};
