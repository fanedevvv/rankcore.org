const express  = require("express");
const stripe   = require("stripe")(process.env.STRIPE_SECRET_KEY || 'sk_not_configured');
const crypto   = require("crypto");
const router   = express.Router();
const { isAuth } = require("../../middleware");

const PremiumToken     = require("../../../Schemas/premiumTokenSchema");
const PremiumRateLimit = require("../../../Schemas/premiumRateLimitSchema");

// ── Constants ─────────────────────────────────────────────────────────────────
const TOKEN_RATE_WINDOW_MS = 60_000; // 1 minute
const TOKEN_RATE_MAX       = 5;      // max requests per window per IP
const TOKEN_TTL_MS         = 2 * 60 * 1000; // token valid for 2 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

/** SHA-256 hash of a raw token string. Stored in DB; never the raw value. */
function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// ── Per-IP rate limiter (MongoDB-backed) ──────────────────────────────────────
// Uses findOneAndUpdate with $inc for an atomic counter increment.
// Safe across all PM2 workers — no in-process Map involved.
async function tokenRateLimit(req, res, next) {
  const ip  = req.ip || "unknown";
  const now = new Date();
  const windowEnd = new Date(now.getTime() + TOKEN_RATE_WINDOW_MS);

  try {
    // Atomically:
    //   • If no document exists for this IP → insert one with count=1 and a TTL
    //   • If a document exists            → increment count only
    //     (windowExpiresAt is NOT updated on increment — the window is fixed
    //      from the first request, not sliding)
    const ipHash = hashIp(ip);
    const rec = await PremiumRateLimit.findOneAndUpdate(
      { ipHash },
      {
        $inc:         { count: 1 },
        $setOnInsert: { windowExpiresAt: windowEnd, ipEnc: null },
      },
      {
        upsert:        true,
        new:           true,
        setDefaultsOnInsert: true,
      }
    );

    if (rec.count > TOKEN_RATE_MAX) {
      return res.status(429).json({ error: "Too many requests. Try again in a minute." });
    }

    next();
  } catch (err) {
    // If the rate-limit check itself fails, fail open with a warning rather
    // than hard-blocking legitimate users.  A monitoring alert should fire.
    console.error("[Premium] Rate-limit check failed:", err.message);
    next();
  }
}

// ── GET /api/premium/token ─────────────────────────────────────────────────────
// Issues a cryptographically random one-time token.
// Only the SHA-256 hash is persisted; the raw token is sent to the client once
// via a cookie and is never stored server-side.
router.get("/api/premium/token", isAuth, tokenRateLimit, async (req, res) => {
  try {
    const raw       = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await PremiumToken.create({
      tokenHash,
      userId:    req.user.id,   // bind token to the authenticated user
      expiresAt,
    });

    res.cookie("_pgt", raw, {
      httpOnly: true,
      secure:   true,
      sameSite: "strict",
      maxAge:   TOKEN_TTL_MS,
    });

    res.json({ ok: true, token: raw });
  } catch (err) {
    console.error("[Premium] Failed to issue token:", err.message);
    res.status(500).json({ error: "Failed to issue token" });
  }
});

// ── POST /api/premium/upgrade ──────────────────────────────────────────────────
// Validates and atomically consumes the one-time token, then returns Stripe URLs.
router.post("/api/premium/upgrade", isAuth, async (req, res) => {
  const raw = req.body?.token || req.cookies?._pgt;

  if (!raw || typeof raw !== "string") {
    return res.status(403).json({ error: "Invalid or expired token" });
  }

  const tokenHash = hashToken(raw);

  try {
    // findOneAndDelete is atomic — no TOCTOU race between find and delete.
    // We also assert userId to ensure the token belongs to the requester.
    const record = await PremiumToken.findOneAndDelete({
      tokenHash,
      userId: req.user.id,
    });

    if (!record) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    // Belt-and-suspenders expiry check (TTL index fires ~60 s late at worst)
    if (new Date() > record.expiresAt) {
      return res.status(403).json({ error: "Token expired — please refresh the page" });
    }

    res.clearCookie("_pgt");

    const sessionOptions = (priceId) => ({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      custom_fields: [
        {
          key:   "discord_user_id",
          label: { type: "custom", custom: "Your Discord User ID" },
          type:  "text",
          text:  { minimum_length: 17, maximum_length: 20 },
        },
        {
          key:      "discord_guild_id",
          label:    { type: "custom", custom: "Your Server ID (optional)" },
          type:     "text",
          optional: true,
          text:     { minimum_length: 17, maximum_length: 20 },
        },
      ],
      metadata:    { price_id: priceId },
      success_url: `${process.env.DASHBOARD_DOMAIN}/webhooks/stripe/success`,
      cancel_url:  `${process.env.DASHBOARD_DOMAIN}/webhooks/stripe/cancel`,
      expires_at:  Math.floor(Date.now() / 1000) + 60 * 30,
    });

    const [monthly, yearly] = await Promise.all([
      stripe.checkout.sessions.create(sessionOptions(process.env.StripePriceID)),
      stripe.checkout.sessions.create(sessionOptions(process.env.StripePriceIDYearly)),
    ]);

    res.json({ monthly: monthly.url, yearly: yearly.url });
  } catch (err) {
    console.error("[Premium] Failed to generate checkout sessions:", err.message);
    res.status(500).json({ error: "Failed to generate checkout links" });
  }
});

module.exports = router;