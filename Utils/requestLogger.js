const { RequestLog, ExcludedUser } = require("../Schemas/requestlogs");
const axios = require("axios");
const crypto = require("crypto");

const WEBHOOK_URL = process.env.WEB_REQUEST_LOG_WEBHOOK;

const webhookQueue = [];
let sending = false;

const rateLimitMap = new Map();
const MIN_LOG_INTERVAL = 5000;

let _rateLimitedUntil = 0;

function encryptIp(ip) {
  const key = process.env.IP_ENCRYPT_KEY;
  if (!key || key.length !== 64) return ip;
  const algo = "aes-256-gcm";
  const k = Buffer.from(key, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algo, k, iv);
  const enc = Buffer.concat([cipher.update(ip, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

async function processQueue() {
  if (sending || webhookQueue.length === 0) return;
  sending = true;

  while (webhookQueue.length > 0) {
    const waitMs = _rateLimitedUntil - Date.now();
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));

    const { embed, mongoDoc } = webhookQueue.shift();
    if (!WEBHOOK_URL) continue; // request-log webhook not configured
    try {
      const discordResp = await axios.post(WEBHOOK_URL, { embeds: [embed] });
      if (discordResp.data?.id) {
        mongoDoc.webhookMessageId = discordResp.data.id;
        await mongoDoc.save();
      }
    } catch (err) {
      if (err?.response?.status === 429) {
        const retryAfterMs = ((err.response.data?.retry_after ?? 1) * 1000) + 500;
        _rateLimitedUntil = Date.now() + retryAfterMs;
        webhookQueue.unshift({ embed, mongoDoc });
        console.warn(`[requestLogger] Webhook rate limited — backing off ${retryAfterMs}ms`);
        break;
      }
      if (err?.response?.status !== 400) {
        console.error("Failed to send Discord webhook:", err?.response?.status ?? err.message);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  sending = false;
}

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", async () => {
    let userId = req.user?.id;

    if (userId) {
      const excluded = await ExcludedUser.findOne({ userId });
      if (excluded) return;
    }

    const duration = Date.now() - start;

    let ip = req.ip || req.socket?.remoteAddress || "Unknown IP";
    ip = String(ip).replace(/^::ffff:/, "");

    const rateKey = userId || ip;
    const lastLogged = rateLimitMap.get(rateKey) || 0;
    if (Date.now() - lastLogged < MIN_LOG_INTERVAL) return;
    rateLimitMap.set(rateKey, Date.now());

    const logData = {
      method: req.method,
      status: res.statusCode,
      duration,
      route: req.originalUrl || req.url,
      ip: encryptIp(ip),
      userId: req.user?.id || null,
      username: req.user?.username || null,
    };

    const embed = {
      title: "HTTP Request Log",
      color: 0x6b6b6b,
      fields: [
        { name: "Method", value: logData.method, inline: true },
        { name: "Status", value: `${logData.status}`, inline: true },
        { name: "Route", value: logData.route, inline: false },
        { name: "Duration", value: `${logData.duration}ms`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };

    if (req.user) {
      embed.fields.push(
        { name: "User ID", value: logData.userId, inline: true },
        { name: "Username", value: logData.username, inline: true }
      );
    }

    try {
      const mongoDoc = await RequestLog.create(logData);
      webhookQueue.push({ embed, mongoDoc });
      processQueue();
    } catch (err) {
      console.error("Failed to log request:", err);
    }
  });

  next();
};
