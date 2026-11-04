"use strict";

const crypto = require("crypto");

const ALGO = "aes-256-gcm";

function getKey() {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error(
      "[webhookCrypto] WEBHOOK_SECRET must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(secret, "hex");
}

function encryptWebhook(plaintext) {
  if (!plaintext) return null;
  const key = getKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

function decryptWebhook(stored) {
  if (!stored) return null;
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length < 3) return stored;
  const [ivHex, authTagHex, ...rest] = parts;
  const ctHex = rest.join(":");
  const iv         = Buffer.from(ivHex, "hex");
  const authTag    = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

module.exports = { encryptWebhook, decryptWebhook };
