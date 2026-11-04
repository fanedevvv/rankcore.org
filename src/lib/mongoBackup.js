'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 30;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.gz'))
      .sort();

    if (files.length > MAX_BACKUPS) {
      const toRemove = files.slice(0, files.length - MAX_BACKUPS);
      for (const file of toRemove) {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        console.log(`[Backup] Removed old backup: ${file}`);
      }
    }
  } catch (err) {
    console.error('[Backup] Error cleaning old backups:', err.message);
  }
}

async function createBackup() {
  ensureBackupDir();

  const timestamp = getTimestamp();
  const outFile = path.join(BACKUP_DIR, `noxx-${timestamp}.archive.gz`);

  const mongoUri = process.env.mongodbURL || 'mongodb://127.0.0.1:27017/noxx';

  try {
    const url = new URL(mongoUri);
    const db = (url.pathname || '/noxx').replace('/', '');
    const host = url.hostname || '127.0.0.1';
    const port = url.port || '27017';

    const args = [
      `--host=${host}`,
      `--port=${port}`,
      `--db=${db}`,
      `--archive=${outFile}`,
      '--gzip',
    ];

    if (url.username && url.password) {
      args.push(`--username=${url.username}`);
      args.push(`--password=${url.password}`);
      args.push('--authenticationDatabase=admin');
    }

    console.log(`[Backup] Starting mongodump to ${outFile}…`);

    await new Promise((resolve, reject) => {
      const proc = spawn('mongodump', args, { stdio: 'pipe' });

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`[Backup] Completed successfully: ${outFile}`);
          const stat = fs.statSync(outFile);
          console.log(`[Backup] Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
          resolve();
        } else {
          reject(new Error(`mongodump exited with code ${code}: ${stderr}`));
        }
      });
      proc.on('error', reject);
    });

    cleanOldBackups();
  } catch (err) {
    console.error('[Backup] mongodump failed:', err.message);
  }
}

function scheduleDailyBackup(hour = 4, minute = 0) {
  // Disabled where mongodump isn't available (Pterodactyl container) — the host
  // runs the daily backup into the encrypted volume instead.
  if (process.env.DISABLE_INAPP_BACKUP === '1') {
    console.log('[Backup] In-app backup disabled (DISABLE_INAPP_BACKUP=1).');
    return;
  }
  const now = new Date();
  const scheduled = new Date(now);
  scheduled.setUTCHours(hour, minute, 0, 0);

  if (scheduled.getTime() <= now.getTime()) {
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
  }

  const delayMs = scheduled.getTime() - now.getTime();
  console.log(`[Backup] First backup scheduled in ${Math.round(delayMs / 1000 / 60)} minutes (daily at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} UTC)`);

  const scheduleNext = () => {
    setTimeout(() => {
      createBackup();
      setTimeout(scheduleNext, 24 * 60 * 60 * 1000);
    }, delayMs);
  };

  scheduleNext();
}

module.exports = { createBackup, scheduleDailyBackup, BACKUP_DIR };
