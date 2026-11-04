"use strict";

const crypto = require("crypto");

const ALGO = "aes-256-gcm";

function getKey() {
  const secret = process.env.TRANSCRIPT_ENCRYPT_KEY;
  if (secret && secret.length === 64) {
    return Buffer.from(secret, "hex");
  }
  const fallback = process.env.CB_TOKEN_SECRET;
  if (fallback && fallback.length === 64) {
    return crypto.createHash("sha256").update(fallback + ":transcript").digest();
  }
  throw new Error(
    "[transcriptCrypto] TRANSCRIPT_ENCRYPT_KEY must be a 64-character hex string (32 bytes). " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

function encryptMessages(messages) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = JSON.stringify(messages);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptMessages(stored) {
  const key = getKey();
  const [ivHex, authTagHex, ctHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ctHex) {
    throw new Error("[transcriptCrypto] Malformed encrypted data");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

module.exports = { encryptMessages, decryptMessages };
