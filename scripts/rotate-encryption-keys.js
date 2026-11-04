/**
 * Emergency key-rotation script.
 *
 * Decrypts all data encrypted with the current key(s), lets you provide (or
 * auto-generate) replacement key(s), updates .env, and re-encrypts everything.
 *
 * Usage: node ./scripts/rotate-encryption-keys.js
 *
 * Environment variables required:
 *   mongodbURL  — MongoDB connection string
 *   The current key(s) you intend to rotate must be set in .env or the
 *   environment so the script can decrypt existing data first.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const crypto   = require("crypto");
const fs       = require("fs");
const path     = require("path");
const readline = require("readline");

const ALGO = "aes-256-gcm";
const ENV_PATH = path.resolve(__dirname, "..", ".env");

// ── CLI helpers ─────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function heading(label) {
  console.log(`\n${"=".repeat(60)}\n${label}\n${"=".repeat(60)}`);
}

function success(label) {
  console.log(`  [OK] ${label}`);
}

// ── Key backup ──────────────────────────────────────────────────────────────────
// Auto-saves the current key to .key-backups/ before any rotation.
const BACKUP_DIR = path.resolve(__dirname, "..", ".key-backups");

function backupCurrentKey(name, value) {
  if (!value) return;
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const hostname = require("os").hostname();
  const filepath = path.join(BACKUP_DIR, `encryption-keys-${ts}.json`);

  // Append to a shared backup or create a new one
  const backup = {
    _backedUpAt: new Date().toISOString(),
    _hostname:   hostname,
    _note:       `Auto-backup before rotating ${name}`,
    _keys:       { [name]: value },
  };

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), { mode: 0o600 });
  console.log(`  [*] Current ${name} backed up to ${path.relative(__dirname, filepath)}`);
}

function skip(label) {
  console.log(`  [--] ${label}`);
}

// ── Crypto helpers ──────────────────────────────────────────────────────────────

function hexKey(secret) {
  if (!secret || secret.length !== 64) return null;
  return Buffer.from(secret, "hex");
}

function genKey() {
  return crypto.randomBytes(32).toString("hex");
}

// Standard format: "ivHex:aTagHex:ctHex"
function stdDecrypt(stored, key) {
  if (!stored || !key) return null;
  const parts = stored.split(":");
  if (parts.length < 3) return stored; // plaintext fallback
  const [ivHex, aTagHex, ...rest] = parts;
  const ctHex = rest.join(":");
  try {
    const iv = Buffer.from(ivHex, "hex");
    const aTag = Buffer.from(aTagHex, "hex");
    const ct = Buffer.from(ctHex, "hex");
    const d = crypto.createDecipheriv(ALGO, key, iv);
    d.setAuthTag(aTag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch { return null; }
}

function stdEncrypt(plaintext, key) {
  if (!plaintext || !key) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

// Verify-format: base64url(iv+tag+ct)
const VFY_IV_B = 12, VFY_TAG_B = 16;

function vfyDecrypt(b64, key) {
  if (!b64 || !key) return null;
  try {
    const buf = Buffer.from(b64, "base64url");
    const iv = buf.subarray(0, VFY_IV_B);
    const tag = buf.subarray(VFY_IV_B, VFY_IV_B + VFY_TAG_B);
    const ct = buf.subarray(VFY_IV_B + VFY_TAG_B);
    const d = crypto.createDecipheriv(ALGO, key, iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    if (/^\d{17,20}$/.test(pt)) return pt;
    try { return JSON.parse(pt); } catch { return pt; }
  } catch { return null; }
}

function vfyEncrypt(value, key) {
  const pt = typeof value === "object" ? JSON.stringify(value) : String(value);
  const iv = crypto.randomBytes(VFY_IV_B);
  const c = crypto.createCipheriv(ALGO, key, iv);
  const e1 = c.update(pt, "utf8");
  const e2 = c.final();
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, e1, e2]).toString("base64url");
}

function hmac256(value, key) {
  return crypto.createHmac("sha256", key).update(String(value), "utf8").digest("hex");
}

// ── .env updater ─────────────────────────────────────────────────────────────────

function readEnv() {
  try { return fs.readFileSync(ENV_PATH, "utf8"); } catch { return ""; }
}

function writeEnv(content) {
  fs.writeFileSync(ENV_PATH, content, "utf8");
  console.log(`  [*] .env updated`);
}

function setEnvVar(content, name, value) {
  const re = new RegExp(`^${name}=.*`, "m");
  const line = `${name}=${value}`;
  if (re.test(content)) return content.replace(re, line);
  return content + (content.endsWith("\n") ? "" : "\n") + line + "\n";
}

// ── Key rotation prompt ─────────────────────────────────────────────────────────

async function promptNewKey(keyName, currentValue) {
  console.log(`\n  Current ${keyName}: ${currentValue ? currentValue.slice(0, 16) + "…" : "(not set)"}`);
  const choice = await ask(`  Enter new ${keyName} (64 hex chars) or leave blank to auto-generate: `);
  const trimmed = choice.trim();
  if (trimmed.length === 64 && /^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (trimmed && trimmed.length !== 0) {
    console.log("  [WARN] Invalid hex key (must be exactly 64 hex chars). Auto-generating instead.");
  }
  const generated = genKey();
  console.log(`  Auto-generated: ${generated}`);
  return generated;
}

// ── Migration runners ───────────────────────────────────────────────────────────

async function rotateTranscriptKey(oldKey, newKey) {
  heading("TRANSCRIPT_ENCRYPT_KEY → transcript.EncryptedData");
  const Transcript = require("../Schemas/transcript");
  const docs = await Transcript.find({ Encrypted: true, EncryptedData: { $ne: null } }).lean();
  if (!docs.length) { skip("No encrypted transcripts found — key change recorded without migration"); return; }

  let successCount = 0;
  let failCount = 0;
  for (const doc of docs) {
    const pt = stdDecrypt(doc.EncryptedData, oldKey);
    if (pt === null) {
      console.error(`  [FAIL] TicketID=${doc.TicketID} — decrypt failed`);
      failCount++;
      continue;
    }
    const enc = stdEncrypt(JSON.stringify(pt), newKey);
    await Transcript.updateOne({ _id: doc._id }, { $set: { EncryptedData: enc } });
    successCount++;
  }
  if (successCount === 0 && failCount > 0) {
    console.error(`\n  [FATAL] All ${failCount} transcript(s) failed to decrypt — current key is wrong.`);
    throw new Error(`TRANSCRIPT_ENCRYPT_KEY mismatch — no data could be decrypted`);
  }
  success(`${successCount} transcript(s) re-encrypted, ${failCount} failed`);
}

async function rotateCbTokenKey(oldKey, newKey) {
  heading("CB_TOKEN_SECRET → custombrandings.encryptedToken");
  const CB = require("../Schemas/customBrandingSchema");
  const docs = await CB.find({ encryptedToken: { $ne: null } }).select("+encryptedToken").lean();
  if (!docs.length) { skip("No encrypted tokens found — key change recorded without migration"); return; }

  let successCount = 0;
  let failCount = 0;
  for (const doc of docs) {
    const pt = stdDecrypt(doc.encryptedToken, oldKey);
    if (pt === null) {
      console.error(`  [FAIL] guild=${doc.guildId} — decrypt failed`);
      failCount++;
      continue;
    }
    const enc = stdEncrypt(pt, newKey);
    await CB.updateOne({ _id: doc._id }, { $set: { encryptedToken: enc } });
    successCount++;
  }
  if (successCount === 0 && failCount > 0) {
    console.error(`\n  [FATAL] All ${failCount} token(s) failed to decrypt — current CB_TOKEN_SECRET is wrong.`);
    throw new Error("CB_TOKEN_SECRET mismatch — no data could be decrypted");
  }
  success(`${successCount} token(s) re-encrypted, ${failCount} failed`);
}

async function rotateWebhookKeys(oldKey, newKey) {
  heading("WEBHOOK_SECRET → webhook/webhookUrl fields");

  // WebhookSchema.webhookToken
  const Webhook = require("../Schemas/Webhookschema");
  let docs = await Webhook.find({ webhookToken: { $ne: null } }).select("+webhookToken").lean();
  for (const doc of docs) {
    const pt = stdDecrypt(doc.webhookToken, oldKey);
    if (pt === null) { console.error(`  [FAIL] Webhook _id=${doc._id} — decrypt failed`); continue; }
    await Webhook.updateOne({ _id: doc._id }, { $set: { webhookToken: stdEncrypt(pt, newKey) } });
  }
  success(`WebhookSchema.webhookToken: ${docs.length} re-encrypted`);

  // guildInviteConfig.webhookWelcome.webhookToken
  const Invite = require("../Schemas/guildInviteConfig");
  docs = await Invite.find({ "webhookWelcome.webhookToken": { $ne: null } }).select("+webhookWelcome.webhookToken").lean();
  for (const doc of docs) {
    const pt = stdDecrypt(doc.webhookWelcome.webhookToken, oldKey);
    if (pt === null) { console.error(`  [FAIL] guildInvite _id=${doc._id} — decrypt failed`); continue; }
    await Invite.updateOne({ _id: doc._id }, { $set: { "webhookWelcome.webhookToken": stdEncrypt(pt, newKey) } });
  }
  success(`guildInviteConfig.webhookToken: ${docs.length} re-encrypted`);

  // verificationSchema + validationschema webhookUrl
  for (const model of [require("../Schemas/verificationSchema"), require("../Schemas/validationschema")]) {
    docs = await model.find({ webhookUrl: { $ne: null } }).select("+webhookUrl").lean();
    for (const doc of docs) {
      const pt = stdDecrypt(doc.webhookUrl, oldKey);
      if (pt === null) { console.error(`  [FAIL] ${model.modelName} _id=${doc._id} — decrypt failed`); continue; }
      await model.updateOne({ _id: doc._id }, { $set: { webhookUrl: stdEncrypt(pt, newKey) } });
    }
    success(`${model.modelName}.webhookUrl: ${docs.length} re-encrypted`);
  }

  // counting.WebhookURL
  const Count = require("../Schemas/counting");
  docs = await Count.find({ WebhookURL: { $ne: null } }).select("+WebhookURL").lean();
  for (const doc of docs) {
    const pt = stdDecrypt(doc.WebhookURL, oldKey);
    if (pt === null) { console.error(`  [FAIL] counting _id=${doc._id} — decrypt failed`); continue; }
    await Count.updateOne({ _id: doc._id }, { $set: { WebhookURL: stdEncrypt(pt, newKey) } });
  }
  success(`counting.WebhookURL: ${docs.length} re-encrypted`);
}

async function rotateIpKey(oldKey, newKey) {
  heading("IP_ENCRYPT_KEY → requestlogs.ip, ratelimits.ipEnc");

  const { RequestLog } = require("../Schemas/requestlogs");
  let docs = await RequestLog.find({ ip: { $regex: /:/ } }).select("+ip").lean();
  for (const doc of docs) {
    const pt = stdDecrypt(doc.ip, oldKey);
    if (pt === null) { /* skip — may be plaintext */ continue; }
    await RequestLog.updateOne({ _id: doc._id }, { $set: { ip: stdEncrypt(pt, newKey) } });
  }
  success(`RequestLog.ip: ${docs.length} re-encrypted`);

  const RateLimit = require("../Schemas/RateLimit");
  docs = await RateLimit.find({ ipEnc: { $ne: null } }).select("+ipEnc").lean();
  for (const doc of docs) {
    const pt = stdDecrypt(doc.ipEnc, oldKey);
    if (pt === null) { console.error(`  [FAIL] RateLimit ipHash=${doc.ipHash} — decrypt failed`); continue; }
    await RateLimit.updateOne({ _id: doc._id }, { $set: { ipEnc: stdEncrypt(pt, newKey) } });
  }
  success(`RateLimit.ipEnc: ${docs.length} re-encrypted`);
}

async function rotateVerifyKeys(oldEncKey, oldHmacKey, newEncKey, newHmacKey) {
  heading("VERIFY_ENCRYPT_KEY + VERIFY_HMAC_KEY → verification_records");
  const Record = require("../Schemas/VerificationRecord");
  const docs = await Record.find({}).lean();
  if (!docs.length) { skip("No records found"); return; }

  for (const doc of docs) {
    const updates = {};

    // Decrypt ipEnc with old key, re-encrypt with new
    const ip = vfyDecrypt(doc.ipEnc, oldEncKey);
    if (ip === null) { console.error(`  [FAIL] Record _id=${doc._id} — ipEnc decrypt failed`); continue; }
    updates.ipEnc = vfyEncrypt(ip, newEncKey);
    updates.ipHmac = hmac256(typeof ip === "object" ? JSON.stringify(ip) : String(ip), newHmacKey);

    // userId
    const uid = vfyDecrypt(doc.userIdEnc, oldEncKey);
    if (uid === null) { console.error(`  [FAIL] Record _id=${doc._id} — userIdEnc decrypt failed`); continue; }
    updates.userIdEnc = vfyEncrypt(uid, newEncKey);
    updates.userIdHmac = hmac256(String(uid), newHmacKey);

    // threatEnc (optional)
    if (doc.threatEnc) {
      const threat = vfyDecrypt(doc.threatEnc, oldEncKey);
      if (threat !== null) updates.threatEnc = vfyEncrypt(threat, newEncKey);
    }

    // guild entries
    if (doc.guilds && doc.guilds.length) {
      updates.guilds = doc.guilds.map((g) => {
        const gid = vfyDecrypt(g.guildIdEnc, oldEncKey);
        return {
          ...g,
          guildIdEnc: gid !== null ? vfyEncrypt(gid, newEncKey) : g.guildIdEnc,
          guildIdHmac: gid !== null ? hmac256(String(gid), newHmacKey) : g.guildIdHmac,
        };
      });
    }

    await Record.updateOne({ _id: doc._id }, { $set: updates });
  }
  success(`${docs.length} record(s) re-encrypted and re-hmac'd`);
}

// ── Main ─────────────────────────────────────────────────────────────────────────

const KEY_TABLE = [
  { env: "TRANSCRIPT_ENCRYPT_KEY", label: "Transcript messages", run: rotateTranscriptKey },
  { env: "CB_TOKEN_SECRET",        label: "Custom branding tokens", run: rotateCbTokenKey },
  { env: "WEBHOOK_SECRET",         label: "Webhook credentials", run: rotateWebhookKeys },
  { env: "IP_ENCRYPT_KEY",         label: "IP addresses (logs + rate limits)", run: rotateIpKey },
  { env: "VERIFY_ENCRYPT_KEY",     label: "Verification records (privacy data)", run: rotateVerifyKeys,
    extra: "VERIFY_HMAC_KEY" },
];

async function main() {
  console.log("=".repeat(60));
  console.log("  Emergency Encryption-Key Rotation");
  console.log("=".repeat(60));

  // Connect
  if (!mongoose.connection.readyState) {
    console.log("\nConnecting to MongoDB...");
    await mongoose.connect(process.env.mongodbURL);
    console.log("Connected.");
  }

  // Show menu
  console.log("\nAvailable key(s) to rotate:\n");
  KEY_TABLE.forEach((k, i) => {
    const set = !!process.env[k.env];
    console.log(`  ${i + 1}. ${k.env}  ${set ? "(set)" : "(not set)"}  →  ${k.label}`);
    if (k.extra) console.log(`     (also requires ${k.extra})`);
  });

  const raw = await ask("\nEnter number(s) to rotate (comma-separated, or 'all'): ");
  const input = raw.trim().toLowerCase();

  let indices = [];
  if (input === "all") {
    indices = KEY_TABLE.map((_, i) => i);
  } else {
    for (const part of input.split(",")) {
      const n = parseInt(part.trim());
      if (n >= 1 && n <= KEY_TABLE.length) indices.push(n - 1);
    }
  }

  if (!indices.length) { console.log("Nothing selected."); process.exit(0); }

  let envContent = readEnv();

  for (const idx of indices) {
    const entry = KEY_TABLE[idx];
    const oldKeyRaw = process.env[entry.env];
    let oldKey = hexKey(oldKeyRaw);
    let oldHmac = entry.extra ? hexKey(process.env[entry.extra]) : null;

    if (!oldKey && !entry.extra) {
      console.log(`\n  [SKIP] ${entry.env} is not set — nothing to rotate.`);
      continue;
    }

    console.log(`\n── Rotating ${entry.env} ──`);

    // Decrypt & store in memory, then ask for new key
    // (the run function handles decrypt internally, so we need it for both old and new)
    // But run() uses oldKey/newKey from params, so we call it inside.
    const newKeyHex = await promptNewKey(entry.env, oldKeyRaw);
    const newKey = hexKey(newKeyHex);

    let newHmacHex, newHmac;
    if (entry.extra) {
      newHmacHex = await promptNewKey(entry.extra, process.env[entry.extra]);
      newHmac = hexKey(newHmacHex);
    }

    // Confirm
    const confirm = await ask(`\n  Rotate ${entry.env}${entry.extra ? " + " + entry.extra : ""}? This will re-encrypt all associated data. (yes/no): `);
    if (confirm.trim().toLowerCase() !== "yes") {
      console.log("  Skipped.");
      continue;
    }

    // Auto-backup current key before rotating
    backupCurrentKey(entry.env, oldKeyRaw);

    // Run migration — throws if no data could be decrypted with the current key
    try {
      if (entry.extra) {
        await entry.run(oldKey, oldHmac, newKey, newHmac);
      } else {
        await entry.run(oldKey, newKey);
      }
    } catch (migrationErr) {
      console.error(`\n  [ABORT] ${entry.env} rotation cancelled: ${migrationErr.message}`);
      console.error("  The .env has NOT been updated for this key.");
      console.error("  Restore the correct key from a backup and re-run.");
      continue; // skip .env update for this key
    }

    // Update .env
    envContent = setEnvVar(envContent, entry.env, newKeyHex);
    if (entry.extra && newHmacHex) {
      envContent = setEnvVar(envContent, entry.extra, newHmacHex);
    }
  }

  writeEnv(envContent);

  console.log("\n" + "=".repeat(60));
  console.log("  Key rotation complete.");
  console.log("  Restart the bot and dashboard for the new keys to take effect.");
  console.log("=".repeat(60));

  await mongoose.disconnect();
  rl.close();
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
