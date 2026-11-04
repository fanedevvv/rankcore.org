#!/usr/bin/env node
/**
 * backup-encryption-keys.js
 *
 * Reads all encryption keys from .env and writes them to a timestamped
 * backup file in .key-backups/. Run this regularly (cron / pm2 startup)
 * to ensure keys can be recovered after accidental loss.
 *
 * Usage: node scripts/backup-encryption-keys.js
 * Options:
 *   --path /absolute/path   Custom backup directory (default: .key-backups/)
 *   --quiet                 Suppress output (for cron)
 *   --retain N              Keep only the N most recent backups (default: 30)
 *
 * The backup file is JSON with restricted permissions (0600).
 */

require("dotenv").config();
const fs   = require("fs");
const path = require("path");

const BACKUP_DIR = path.resolve(__dirname, "..", ".key-backups");
const QUIET = process.argv.includes("--quiet");
const log = QUIET ? () => {} : console.log;

function getArg(name, def) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : def;
}
const RETAIN = getArg("--retain", 30);

// All known encryption key env var names
const KEY_NAMES = [
  "CB_TOKEN_SECRET",
  "TRANSCRIPT_ENCRYPT_KEY",
  "WEBHOOK_SECRET",
  "IP_ENCRYPT_KEY",
  "VERIFY_ENCRYPT_KEY",
  "VERIFY_HMAC_KEY",
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pruneOldBackups(backupDir) {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith("encryption-keys-") && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length <= RETAIN) return;

  for (const f of files.slice(RETAIN)) {
    fs.rmSync(path.join(backupDir, f));
    log(`  Pruned old backup: ${f}`);
  }
}

function main() {
  const backupDir = process.argv.includes("--path")
    ? path.resolve(process.argv[process.argv.indexOf("--path") + 1])
    : BACKUP_DIR;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const keys = {};
  let foundAny = false;
  for (const name of KEY_NAMES) {
    const val = process.env[name];
    if (val) {
      keys[name] = val;
      foundAny = true;
    }
  }

  if (!foundAny) {
    log("No encryption keys found in environment. Nothing to back up.");
    process.exit(0);
  }

  const backup = {
    _backedUpAt: new Date().toISOString(),
    _hostname:   require("os").hostname(),
    _keys:       keys,
  };

  const filename = `encryption-keys-${timestamp()}.json`;
  const filepath = path.join(backupDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), { mode: 0o600 });
  log(`Backed up ${Object.keys(keys).length} key(s) to ${filepath}`);

  // Clean up old backups, keep only the N most recent
  pruneOldBackups(backupDir);
}

main();
