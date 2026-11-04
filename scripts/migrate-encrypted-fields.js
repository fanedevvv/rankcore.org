/**
 * Migration script: Encrypt existing plaintext sensitive fields.
 *
 * This script is safe to run repeatedly — it skips documents that already
 * have encrypted values.  Run it once after deploying the schema changes.
 *
 * Usage: node ./scripts/migrate-encrypted-fields.js
 *
 * Environment variables required:
 *   mongodbURL       — MongoDB connection string
 *   WEBHOOK_SECRET   — 64 hex chars (AES-256-GCM key for webhook credentials)
 *   IP_ENCRYPT_KEY   — 64 hex chars (AES-256-GCM key for IP encryption)
 *   (All already set in your production .env)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const crypto   = require("crypto");

// ── Encryption utilities (inline to avoid import-path issues when run standalone) ──

function getKey(envVar, name) {
  const secret = process.env[envVar];
  if (!secret || secret.length !== 64) {
    console.warn(`[SKIP] ${envVar} not set or invalid — skipping ${name} migration`);
    return null;
  }
  return Buffer.from(secret, "hex");
}

function encryptAesGcm(plaintext, envVar, name) {
  if (!plaintext) return null;
  const key = getKey(envVar, name);
  if (!key) return null;
  const algo = "aes-256-gcm";
  const iv   = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// AES-256-GCM (base64url) — matches dashboard/lib/verifyEncryption.js format
const VFY_ALGO      = 'aes-256-gcm';
const VFY_IV_BYTES  = 12;
const VFY_TAG_BYTES = 16;

function getVerifyEncKey() {
  const hex = process.env.VERIFY_ENCRYPT_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

function getVerifyHmacKey() {
  const hex = process.env.VERIFY_HMAC_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

function encryptVerify(plaintext) {
  const key = getVerifyEncKey();
  if (!key) return null;
  const val   = typeof plaintext === 'object' ? JSON.stringify(plaintext) : String(plaintext);
  const iv    = crypto.randomBytes(VFY_IV_BYTES);
  const cipher = crypto.createCipheriv(VFY_ALGO, key, iv);
  const enc   = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
  const tag   = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]);
  return payload.toString('base64url');
}

function decryptVerify(b64) {
  const key = getVerifyEncKey();
  if (!key) return null;
  try {
    const payload = Buffer.from(b64, 'base64url');
    const iv  = payload.subarray(0, VFY_IV_BYTES);
    const tag = payload.subarray(VFY_IV_BYTES, VFY_IV_BYTES + VFY_TAG_BYTES);
    const ct  = payload.subarray(VFY_IV_BYTES + VFY_TAG_BYTES);
    const dec = crypto.createDecipheriv(VFY_ALGO, key, iv);
    dec.setAuthTag(tag);
    const plaintext = Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
    // Discord snowflakes must stay as strings — JSON.parse loses precision
    if (/^\d{17,20}$/.test(plaintext)) return plaintext;
    try { return JSON.parse(plaintext); } catch { return plaintext; }
  } catch { return null; }
}

function hmacVerify(value) {
  const key = getVerifyHmacKey();
  if (!key) return null;
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex');
}

// Matches "ivHex(24):authTagHex(32):ciphertextHex"
const ENCRYPTED_RE = /^[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/i;
const HASH64_RE    = /^[a-f0-9]{64}$/i;

function isEncrypted(val)  { return val && ENCRYPTED_RE.test(val); }
function isHashed(val)     { return val && HASH64_RE.test(val); }

// ── Migrations ──────────────────────────────────────────────────────────────────

async function migrateWebhookTokens() {
  const Webhook = require("../Schemas/Webhookschema");
  const docs = await Webhook.find({}).select("+webhookToken").lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    if (!doc.webhookToken) { skipped++; continue; }
    if (isEncrypted(doc.webhookToken)) { skipped++; continue; }
    const enc = encryptAesGcm(doc.webhookToken, "WEBHOOK_SECRET", "WebhookSchema.webhookToken");
    if (!enc) return;
    await Webhook.updateOne({ _id: doc._id }, { $set: { webhookToken: enc } });
    done++;
  }
  console.log(`  WebhookSchema.webhookToken: ${done} encrypted, ${skipped} skipped`);
}

async function migrateGuildInviteWebhookTokens() {
  const GuildInvite = require("../Schemas/guildInviteConfig");
  const docs = await GuildInvite.find({ "webhookWelcome.webhookToken": { $exists: true } })
    .select("+webhookWelcome.webhookToken").lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    const token = doc.webhookWelcome?.webhookToken;
    if (!token) { skipped++; continue; }
    if (isEncrypted(token)) { skipped++; continue; }
    const enc = encryptAesGcm(token, "WEBHOOK_SECRET", "guildInviteConfig.webhookToken");
    if (!enc) return;
    await GuildInvite.updateOne(
      { _id: doc._id },
      { $set: { "webhookWelcome.webhookToken": enc } }
    );
    done++;
  }
  console.log(`  guildInviteConfig.webhookToken: ${done} encrypted, ${skipped} skipped`);
}

async function migrateVerifyWebhookUrls(model, label) {
  const Verify = model;
  const docs = await Verify.find({}).select("+webhookUrl").lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    if (!doc.webhookUrl) { skipped++; continue; }
    if (isEncrypted(doc.webhookUrl)) { skipped++; continue; }
    const enc = encryptAesGcm(doc.webhookUrl, "WEBHOOK_SECRET", `${label}.webhookUrl`);
    if (!enc) return;
    await Verify.updateOne({ _id: doc._id }, { $set: { webhookUrl: enc } });
    done++;
  }
  console.log(`  ${label}.webhookUrl: ${done} encrypted, ${skipped} skipped`);
}

async function migrateCountingWebhookURL() {
  const Count = require("../Schemas/counting");
  const docs = await Count.find({}).select("+WebhookURL").lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    if (!doc.WebhookURL) { skipped++; continue; }
    if (isEncrypted(doc.WebhookURL)) { skipped++; continue; }
    const enc = encryptAesGcm(doc.WebhookURL, "WEBHOOK_SECRET", "counting.WebhookURL");
    if (!enc) return;
    await Count.updateOne({ _id: doc._id }, { $set: { WebhookURL: enc } });
    done++;
  }
  console.log(`  counting.WebhookURL: ${done} encrypted, ${skipped} skipped`);
}

async function migrateRequestLogIps() {
  const { RequestLog } = require("../Schemas/requestlogs");
  const docs = await RequestLog.find({ ip: { $exists: true, $ne: null } })
    .select("+ip").lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    if (!doc.ip) { skipped++; continue; }
    if (isEncrypted(doc.ip)) { skipped++; continue; }
    const enc = encryptAesGcm(doc.ip, "IP_ENCRYPT_KEY", "requestlogs.ip");
    if (!enc) return;
    await RequestLog.updateOne({ _id: doc._id }, { $set: { ip: enc } });
    done++;
  }
  console.log(`  requestlogs.ip: ${done} encrypted, ${skipped} skipped`);
}

async function migrateRateLimitIps() {
  const RateLimit = require("../Schemas/RateLimit");
  // Old documents have `ip` field (plaintext). New schema uses `ipHash` + `ipEnc`.
  const docs = await RateLimit.find({ ip: { $exists: true } }).lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    if (!doc.ip) { skipped++; continue; }
    // Already migrated if ipHash exists and contains a hash
    if (doc.ipHash && isHashed(doc.ipHash)) { skipped++; continue; }
    const ipHash = sha256(doc.ip);
    const ipEnc  = encryptAesGcm(doc.ip, "IP_ENCRYPT_KEY", "RateLimit.ip");
    await RateLimit.updateOne(
      { _id: doc._id },
      { $set: { ipHash, ipEnc: ipEnc || null }, $unset: { ip: "" } }
    );
    done++;
  }
  console.log(`  RateLimit: ${done} hashed/encrypted, ${skipped} skipped`);
}

async function migratePremiumRateLimitIps() {
  const PremiumRL = require("../Schemas/premiumRateLimitSchema");
  const docs = await PremiumRL.find({ ip: { $exists: true } }).lean();
  let done = 0, skipped = 0;
  for (const doc of docs) {
    if (!doc.ip) { skipped++; continue; }
    if (doc.ipHash && isHashed(doc.ipHash)) { skipped++; continue; }
    const ipHash = sha256(doc.ip);
    await PremiumRL.updateOne(
      { _id: doc._id },
      { $set: { ipHash }, $unset: { ip: "" } }
    );
    done++;
  }
  console.log(`  premiumRateLimit: ${done} hashed, ${skipped} skipped`);
}

async function migrateVerificationRecordGuildIds() {
  const Record = require("../Schemas/VerificationRecord");
  const docs = await Record.find({ "guilds.guildIdEnc": { $exists: true } }).lean();
  let count = { done: 0, skipped: 0, failed: 0, fixed: 0 };
  for (const doc of docs) {
    const guilds = doc.guilds || [];
    for (let i = 0; i < guilds.length; i++) {
      const entry = guilds[i];
      if (!entry.guildIdEnc) { count.failed++; continue; }
      const decrypted = decryptVerify(entry.guildIdEnc);
      if (!decrypted) { count.failed++; continue; }
      const decStr = String(decrypted);
      if (!/^\d{17,20}$/.test(decStr)) { count.failed++; continue; }

      // If guildId is missing OR has precision loss (wrong digits), update it
      const needsUpdate = !entry.guildId || entry.guildId !== decStr;
      if (needsUpdate) {
        await Record.updateOne(
          { _id: doc._id },
          { $set: { [`guilds.${i}.guildId`]: decStr } }
        );
        if (entry.guildId) count.fixed++;
        else count.done++;
      } else {
        count.skipped++;
      }
    }
  }
  const { done, skipped, failed, fixed } = count;
  console.log(`  VerificationRecord guildId: ${done} backfilled, ${skipped} ok, ${failed} undecryptable, ${fixed} precision-fixed`);
}

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("Encrypted Fields Migration");
  console.log("=".repeat(60));

  if (!mongoose.connection.readyState) {
    console.log("\nConnecting to MongoDB...");
    await mongoose.connect(process.env.mongodbURL);
    console.log("Connected.\n");
  }

  console.log("── Webhook credentials (AES-256-GCM via WEBHOOK_SECRET) ──");
  if (process.env.WEBHOOK_SECRET?.length === 64) {
    await migrateWebhookTokens();
    await migrateGuildInviteWebhookTokens();
    await migrateVerifyWebhookUrls(require("../Schemas/verificationSchema"), "verificationSchema");
    await migrateVerifyWebhookUrls(require("../Schemas/validationschema"), "validationschema");
    await migrateCountingWebhookURL();
  } else {
    console.log("  [SKIP] WEBHOOK_SECRET not set or invalid");
  }

  console.log("\n── IP addresses (AES-256-GCM via IP_ENCRYPT_KEY + SHA-256) ──");
  await migrateRequestLogIps();
  await migrateRateLimitIps();
  await migratePremiumRateLimitIps();

  console.log("\n── VerificationRecord guildId backfill (AES-256-GCM via VERIFY_ENCRYPT_KEY) ──");
  if (process.env.VERIFY_ENCRYPT_KEY?.length === 64 && process.env.VERIFY_HMAC_KEY?.length === 64) {
    await migrateVerificationRecordGuildIds();
  } else {
    console.log("  [SKIP] VERIFY_ENCRYPT_KEY or VERIFY_HMAC_KEY not set or invalid");
  }

  console.log("\n" + "=".repeat(60));
  console.log("Migration complete.");
  console.log("=".repeat(60));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
