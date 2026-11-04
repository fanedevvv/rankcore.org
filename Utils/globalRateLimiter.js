const crypto = require("crypto");
const RateLimit = require("../Schemas/RateLimit");

// Drop stale ip_1 index on startup — was left by an old schema version and
// causes E11000 duplicate key errors when ip is null (unauthenticated requests
// from localhost/proxies where req.ip may resolve to undefined → fallback → null).
RateLimit.collection?.dropIndex("ip_1").catch(() => {});

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function encryptIp(ip) {
  const key = process.env.IP_ENCRYPT_KEY;
  if (!key || key.length !== 64) return null;
  const algo = "aes-256-gcm";
  const k = Buffer.from(key, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algo, k, iv);
  const enc = Buffer.concat([cipher.update(ip, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

function ipInCidr(ip, cidr) {
  const [range, bits] = cidr.split("/");
  const mask = -1 << (32 - bits);
  const ipToLong = (ip) =>
    ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0);
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

function isWhitelisted(ip, whitelist = []) {
  return whitelist.some((entry) => {
    if (entry.includes("/")) return ipInCidr(ip, entry);
    return entry === ip;
  });
}

function globalRateLimiter({
  windowMs = 60000,
  max = 30,
  strikeLimit = 10,
  tempBlock = 60000,
  whitelist = [],
} = {}) {
  return async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    if (isWhitelisted(ip, whitelist)) return next();

    const now = Date.now();
    const ipHash = sha256(ip);
    let data;

    try {
      data = await RateLimit.findOne({ ipHash });
    } catch {
      return next();
    }

    if (!data) {
      try {
        data = await RateLimit.findOneAndUpdate(
          { ipHash },
          { $setOnInsert: { ipHash, ipEnc: encryptIp(ip) } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch {
        // Race: another request created the doc between findOne and upsert — proceed
        data = await RateLimit.findOne({ ipHash }).catch(() => null);
      }
      if (!data) return next();
    }

    if (data.banned) {
      return res.status(403).json({
        error: "Your IP is permanently banned due to repeated abuse.",
      });
    }

    if (data.blockedUntil && now < data.blockedUntil.getTime()) {
      return res.status(429).json({ error: "Too many requests. Slow down." });
    }

    if (now - data.first.getTime() > windowMs) {
      data.count = 1;
      data.first = new Date(now);
      data.blockedUntil = null;
      await data.save();
      return next();
    }

    data.count++;

    if (data.count > max * 2) {
      data.strikes++;
      data.blockedUntil = new Date(now + tempBlock);

      if (data.strikes >= strikeLimit) {
        data.banned = true;
        await data.save();
        return res.status(403).json({
          error: "You have been permanently banned due to repeated abuse.",
        });
      }

      await data.save();
      return res.status(429).json({
        error: `Abusive activity detected. Strike ${data.strikes}/${strikeLimit}. Blocked for ${
          tempBlock / 1000
        }s.`,
      });
    }

    await data.save();
    next();
  };
}

module.exports = globalRateLimiter;
