#!/usr/bin/env node
/**
 * restore-encryption-keys.js
 *
 * Lists available key backups and restores a selected one to .env.
 *
 * Usage: node scripts/restore-encryption-keys.js           # interactive pick
 *        node scripts/restore-encryption-keys.js <file>     # restore specific backup
 *        node scripts/restore-encryption-keys.js --list     # just list backups
 */

require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const readline = require("readline");

const BACKUP_DIR = path.resolve(__dirname, "..", ".key-backups");
const ENV_PATH   = path.resolve(__dirname, "..", ".env");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse();
}

function restoreToEnv(backupFile) {
  const data = JSON.parse(fs.readFileSync(backupFile, "utf8"));
  const keys = data._keys;
  if (!keys || !Object.keys(keys).length) {
    console.error("No keys found in backup file.");
    process.exit(1);
  }

  let env = fs.readFileSync(ENV_PATH, "utf8");

  for (const [name, value] of Object.entries(keys)) {
    const re = new RegExp(`^${name}=.*`, "m");
    const line = `${name}=${value}`;
    if (re.test(env)) {
      env = env.replace(re, line);
    } else {
      env += (env.endsWith("\n") ? "" : "\n") + line + "\n";
    }
  }

  fs.writeFileSync(ENV_PATH, env, "utf8");
  console.log(`Restored ${Object.keys(keys).length} key(s) from ${path.basename(backupFile)}`);
}

async function main() {
  const backups = listBackups();

  if (process.argv.includes("--list")) {
    if (!backups.length) { console.log("No backups found."); return; }
    for (const f of backups) {
      const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), "utf8"));
      const names = Object.keys(data._keys || {}).join(", ");
      console.log(`  ${f}  —  ${names}`);
    }
    return;
  }

  // Specific file provided as argument
  const argFile = process.argv[2];
  if (argFile && !argFile.startsWith("--")) {
    const filepath = path.resolve(argFile);
    if (!fs.existsSync(filepath)) {
      console.error(`File not found: ${filepath}`);
      process.exit(1);
    }
    restoreToEnv(filepath);
    return;
  }

  if (!backups.length) {
    console.log("No backups found in .key-backups/");
    process.exit(1);
  }

  console.log("\nAvailable backups:");
  for (let i = 0; i < backups.length; i++) {
    const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, backups[i]), "utf8"));
    const ts = data._backedUpAt || backups[i];
    const names = Object.keys(data._keys || {}).join(", ");
    console.log(`  ${i + 1}. ${backups[i]}`);
    console.log(`     Backed up: ${ts}`);
    console.log(`     Keys: ${names}\n`);
  }

  const choice = await ask("Enter number to restore (or 0 to cancel): ");
  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= backups.length) {
    console.log("Cancelled.");
    process.exit(0);
  }

  restoreToEnv(path.join(BACKUP_DIR, backups[idx]));
}

main().catch(console.error).finally(() => rl.close());
