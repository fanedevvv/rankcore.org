/**
 * Migration script: Encrypt existing plaintext ticket transcripts.
 *
 * Safe to run repeatedly — skips documents that are already encrypted.
 * Run once after deploying the schema + code changes.
 *
 * Usage: node ./scripts/migrate-transcript-encryption.js
 *
 * Environment variables required:
 *   mongodbURL          — MongoDB connection string
 *   TRANSCRIPT_ENCRYPT_KEY — 64 hex chars (AES-256-GCM key, recommended)
 *   (Falls back to CB_TOKEN_SECRET if TRANSCRIPT_ENCRYPT_KEY is not set)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const crypto   = require("crypto");

const ALGO = "aes-256-gcm";

function getKey() {
  const secret = process.env.TRANSCRIPT_ENCRYPT_KEY;
  if (secret && secret.length === 64) {
    return Buffer.from(secret, "hex");
  }
  const fallback = process.env.CB_TOKEN_SECRET;
  if (fallback && fallback.length === 64) {
    console.warn("  [WARN] TRANSCRIPT_ENCRYPT_KEY not set, deriving from CB_TOKEN_SECRET");
    return crypto.createHash("sha256").update(fallback + ":transcript").digest();
  }
  console.error("  [FAIL] Neither TRANSCRIPT_ENCRYPT_KEY nor CB_TOKEN_SECRET is set (both must be 64 hex chars)");
  return null;
}

function encryptMessages(messages) {
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = JSON.stringify(messages);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

async function main() {
  console.log("=".repeat(60));
  console.log("Transcript Encryption Migration");
  console.log("=".repeat(60));

  if (!mongoose.connection.readyState) {
    console.log("\nConnecting to MongoDB...");
    await mongoose.connect(process.env.mongodbURL);
    console.log("Connected.\n");
  }

  const Transcript = require("../Schemas/transcript");

  // Find all unencrypted transcripts that have Messages
  const docs = await Transcript.find({
    $or: [
      { Encrypted: { $ne: true } },
      { Encrypted: { $exists: false } },
    ],
    Messages: { $exists: true, $not: { $size: 0 } },
  }).lean();

  console.log(`Found ${docs.length} unencrypted transcript(s) with messages.\n`);

  if (docs.length === 0) {
    console.log("Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  let done = 0, failed = 0, skipped = 0;

  for (const doc of docs) {
    if (!doc.Messages || doc.Messages.length === 0) {
      skipped++;
      continue;
    }

    const encryptedData = encryptMessages(doc.Messages);
    if (!encryptedData) {
      console.error(`  [FAIL] TicketID=${doc.TicketID} — encryption failed (check keys)`);
      failed++;
      continue;
    }

    await Transcript.updateOne(
      { _id: doc._id },
      {
        $set: {
          Encrypted: true,
          EncryptedData: encryptedData,
          Messages: [],
        },
      }
    );
    done++;
  }

  console.log(`\nResults: ${done} encrypted, ${skipped} skipped (empty), ${failed} failed`);
  console.log("=".repeat(60));
  console.log("Migration complete.");
  console.log("=".repeat(60));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
