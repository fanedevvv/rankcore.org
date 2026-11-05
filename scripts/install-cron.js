#!/usr/bin/env node
/**
 * install-cron.js
 *
 * Installs a daily cron job to back up encryption keys.
 * Run once after setup.
 *
 * Usage: node scripts/install-cron.js
 *
 * This appends a line to the current user's crontab.
 * To remove later: crontab -e and delete the line.
 */

const { execSync } = require("child_process");
const path         = require("path");

const PROJECT_DIR = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(PROJECT_DIR, "scripts", "backup-encryption-keys.js");

// Runs at 3:00 AM daily — quiet mode, retains 30 most recent backups.
// Uses the absolute node path: cron's PATH does not include nvm installs.
const CRON_LINE = `0 3 * * * cd "${PROJECT_DIR}" && "${process.execPath}" "${SCRIPT_PATH}" --quiet --retain 30\n`;

try {
  // Get existing crontab
  let existing = "";
  try {
    existing = execSync("crontab -l 2>/dev/null", { encoding: "utf8" });
  } catch {
    // no existing crontab
  }

  // Check if already installed
  if (existing.includes(SCRIPT_PATH)) {
    console.log("Cron job already installed. No changes made.");
    console.log(`  ${CRON_LINE.trim()}`);
    process.exit(0);
  }

  // Append and install
  const newCron = existing + "\n# RankCore encryption key backup (daily)\n" + CRON_LINE;
  execSync(`crontab -`, { input: newCron, encoding: "utf8" });

  console.log("Daily encryption key backup installed in crontab:\n");
  console.log(`  ${CRON_LINE.trim()}\n`);
  console.log(`Backups go to: ${path.join(PROJECT_DIR, ".key-backups")}/`);
  console.log("Old backups beyond the 30 most recent are auto-pruned.");
} catch (err) {
  console.error("Failed to install cron:", err.message);
  console.error("\nManually add this line to your crontab (crontab -e):");
  console.error(`  ${CRON_LINE.trim()}`);
  process.exit(1);
}
