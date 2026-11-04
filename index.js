/**
 * Roco launcher — entry point for the Pterodactyl server (MAIN_FILE=index.js).
 *
 * Pterodactyl runs a single command per server, so this file supervises the
 * three processes that PM2 used to run (see ecosystem.config.js):
 *   bot        — bot.js
 *   dashboard  — src/standalone/dashboard-standalone.js
 *   cb         — src/standalone/cb-manager-standalone.js
 *
 * Each process restarts on crash with exponential back-off; their output is
 * prefixed and streamed to the Pterodactyl console. Stopping the server
 * (SIGTERM/SIGINT) stops all three cleanly.
 */
'use strict';

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;

const APPS = [
  { name: 'bot',       script: 'bot.js',                                  env: { DASHBOARD_MODE: 'standalone', CB_STANDALONE: 'true' } },
  { name: 'dashboard', script: 'src/standalone/dashboard-standalone.js',  env: { LOG_PROCESS_NAME: 'DASHBOARD' } },
  { name: 'cb',        script: 'src/standalone/cb-manager-standalone.js', env: { LOG_PROCESS_NAME: 'CB-MANAGER' } },
];

const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS  = 60_000;
const STABLE_MS     = 60_000; // a run this long resets the back-off

let stopping = false;
const children = new Map();

function pipeWithPrefix(stream, name, out) {
  let buf = '';
  stream.on('data', chunk => {
    buf += chunk;
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) out.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => { if (buf) out.write(`[${name}] ${buf}\n`); });
}

function start(app, attempt = 0) {
  if (stopping) return;
  const startedAt = Date.now();
  const child = spawn(process.execPath, ['--enable-source-maps', path.join(ROOT, app.script)], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', ...app.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.set(app.name, child);
  pipeWithPrefix(child.stdout, app.name, process.stdout);
  pipeWithPrefix(child.stderr, app.name, process.stderr);
  console.log(`[launcher] started ${app.name} (pid ${child.pid})`);

  child.on('exit', (code, signal) => {
    children.delete(app.name);
    if (stopping) return;
    const ranFor = Date.now() - startedAt;
    const next = ranFor > STABLE_MS ? 0 : attempt + 1;
    const delay = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, next - 1), MAX_DELAY_MS);
    console.error(`[launcher] ${app.name} exited (code ${code}, signal ${signal}) — restarting in ${delay / 1000}s`);
    setTimeout(() => start(app, next), delay);
  });
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[launcher] ${signal} received — stopping all processes…`);
  for (const child of children.values()) child.kill('SIGTERM');
  // Give processes time to drain, then force-exit
  const timer = setTimeout(() => {
    for (const child of children.values()) child.kill('SIGKILL');
    process.exit(0);
  }, 10_000);
  const check = setInterval(() => {
    if (children.size === 0) { clearInterval(check); clearTimeout(timer); process.exit(0); }
  }, 200);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// The CB manager comes first so the bot can reach it right away
start(APPS[2]);
setTimeout(() => start(APPS[0]), 1_500);
setTimeout(() => start(APPS[1]), 3_000);
