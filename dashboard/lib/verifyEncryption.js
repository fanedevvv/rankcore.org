'use strict';
/**
 * verifyEncryption.js
 * ────────────────────────────────────────────────────────────────────────────
 * AES-256-GCM symmetric encryption + HMAC-SHA256 blind-index helpers.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   VERIFY_ENCRYPT_KEY   – 64 hex chars (256-bit master key for AES)
 *   VERIFY_HMAC_KEY      – 64 hex chars (256-bit HMAC key, SEPARATE from enc key)
 *
 * THREAT MODEL:
 *   • Every field stored in MongoDB is either AES-256-GCM ciphertext or a
 *     one-way HMAC blind-index.  Raw IPs, user IDs, fingerprints are NEVER
 *     written to the database in plaintext.
 *   • HMAC blind-indexes allow equality lookups (e.g. "has this IP been seen
 *     before?") without exposing the value.
 *   • Each encrypt() call uses a fresh 96-bit random IV — same plaintext
 *     produces different ciphertext every time.
 *   • The 128-bit GCM auth tag is stored with the ciphertext and verified
 *     on every decrypt(), preventing silent tampering.
 */

const crypto = require('crypto');

// ── Key loading ───────────────────────────────────────────────────────────────

function loadKey(envVar) {
  const hex = process.env[envVar];
  if (!hex || hex.length !== 64) {
    throw new Error(
      `[verifyEncryption] ${envVar} must be a 64-character hex string (256-bit key). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
  }
  return Buffer.from(hex, 'hex');
}

let _encKey  = null;
let _hmacKey = null;

function getEncKey()  { return _encKey  || (_encKey  = loadKey('VERIFY_ENCRYPT_KEY')); }
function getHmacKey() { return _hmacKey || (_hmacKey = loadKey('VERIFY_HMAC_KEY')); }

// ── AES-256-GCM encrypt / decrypt ────────────────────────────────────────────

const ALGO        = 'aes-256-gcm';
const IV_BYTES    = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES   = 16;   // 128-bit auth tag

/**
 * Encrypts a value (string or object) to a base64 payload:
 *   <iv:12 bytes> | <authTag:16 bytes> | <ciphertext>
 * encoded as base64url for safe storage.
 */
function encrypt(value) {
  const key       = getEncKey();
  const plaintext = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const iv        = crypto.randomBytes(IV_BYTES);
  const cipher    = crypto.createCipheriv(ALGO, key, iv);

  const enc1 = cipher.update(plaintext, 'utf8');
  const enc2 = cipher.final();
  const tag  = cipher.getAuthTag();

  // Pack: iv(12) + tag(16) + ciphertext
  const payload = Buffer.concat([iv, tag, enc1, enc2]);
  return payload.toString('base64url');
}

/**
 * Decrypts a base64url payload produced by encrypt().
 * Returns the original string, or parsed JSON if it was an object.
 * Throws on auth-tag mismatch (tampering detected).
 */
function decrypt(b64) {
  const key     = getEncKey();
  const payload = Buffer.from(b64, 'base64url');

  const iv         = payload.subarray(0, IV_BYTES);
  const tag        = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const dec1 = decipher.update(ciphertext);
  const dec2 = decipher.final();
  const plaintext = Buffer.concat([dec1, dec2]).toString('utf8');

  // Discord snowflakes (17-20 digit strings) must NEVER go through JSON.parse
  // — JSON.parse converts them to Numbers, losing precision beyond 2^53.
  if (/^\d{17,20}$/.test(plaintext)) return plaintext;

  // Try to parse as JSON, otherwise return as string
  try { return JSON.parse(plaintext); } catch { return plaintext; }
}

// ── HMAC blind-index ─────────────────────────────────────────────────────────

/**
 * Produces a deterministic HMAC-SHA256 hex digest of a value.
 * Used as a searchable index without storing the plaintext.
 * Using a separate key from the encryption key prevents
 * cross-function key reuse attacks.
 */
function hmac(value) {
  const key = getHmacKey();
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalises an IPv4-mapped IPv6 address (::ffff:1.2.3.4 → 1.2.3.4)
 * and trims whitespace.
 */
function normalizeIp(ip) {
  if (!ip) return null;
  const s = String(ip).trim();
  // IPv4-mapped IPv6
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? mapped[1] : s;
}

/**
 * Extracts the real client IP from an Express request, respecting
 * common reverse-proxy headers (X-Forwarded-For, CF-Connecting-IP).
 * IMPORTANT: only trust these headers if your server sits behind a
 * known proxy — set TRUST_PROXY=1 in your environment if so.
 */
function getClientIp(req) {
  const trustProxy = process.env.TRUST_PROXY === '1';

  if (trustProxy) {
    const cf  = req.headers['cf-connecting-ip'];
    if (cf) return normalizeIp(cf.split(',')[0]);

    const xff = req.headers['x-forwarded-for'];
    if (xff) return normalizeIp(xff.split(',')[0]);
  }

  return normalizeIp(req.ip || req.connection?.remoteAddress);
}

module.exports = { encrypt, decrypt, hmac, normalizeIp, getClientIp };