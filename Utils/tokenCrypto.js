"use strict";

/**
 * tokenCrypto.js
 *
 * AES-256-GCM encryption/decryption for bot tokens stored at rest.
 * Requires CB_TOKEN_SECRET env var — a 32-byte (64 hex char) secret key.
 *
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format:  "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */

const crypto = require("crypto");

const ALGO = "aes-256-gcm";

function getKey() {
  const secret = process.env.CB_TOKEN_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error(
      "[tokenCrypto] CB_TOKEN_SECRET must be a 64-character hex string (32 bytes). " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(secret, "hex");
}

/**
 * Encrypt a plaintext token string.
 * @param {string} token
 * @returns {string}  "<iv>:<authTag>:<ciphertext>" — all hex
 */
function encryptToken(token) {
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV for GCM

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypt a stored token string.
 * @param {string} stored  "<iv>:<authTag>:<ciphertext>" — all hex
 * @returns {string}  plaintext token
 */
function decryptToken(stored) {
  const key = getKey();
  const [ivHex, authTagHex, ctHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ctHex) {
    throw new Error("[tokenCrypto] Malformed stored token — expected iv:authTag:ciphertext");
  }

  const iv         = Buffer.from(ivHex, "hex");
  const authTag    = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

module.exports = { encryptToken, decryptToken };
