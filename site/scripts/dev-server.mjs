import { spawn } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const command = process.argv[2];
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const stateFile = path.join(os.tmpdir(), 'yakuza-my-vite-dev.pid');
const host = '0.0.0.0';
const port = '3009';

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getExistingPid() {
  if (!existsSync(stateFile)) {
    return null;
  }

  const rawPid = readFileSync(stateFile, 'utf8').trim();
  const pid = Number.parseInt(rawPid, 10);

  if (!Number.isInteger(pid) || !isProcessRunning(pid)) {
    try {
      unlinkSync(stateFile);
    } catch {
      // Ignore stale state cleanup failures.
    }

    return null;
  }

  return pid;
}

function stopServer() {
  const pid = getExistingPid();

  if (!pid) {
    console.log('No running Vite dev server was found.');
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    console.error(`Failed to stop Vite dev server: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    unlinkSync(stateFile);
  } catch {
    // Ignore stale state cleanup failures.
  }

  console.log(`Stopped Vite dev server (pid ${pid}).`);
}

if (command === 'stop') {
  stopServer();
  process.exit(process.exitCode ?? 0);
}

if (getExistingPid()) {
  console.log(`Vite dev server is already running. Open http://localhost:${port}/`);
  process.exit(0);
}

const child = spawn(process.execPath, [viteBin, '--host', host, '--port', port, '--strictPort'], {
  cwd: rootDir,
  detached: true,
  stdio: 'ignore',
});

child.unref();
writeFileSync(stateFile, `${child.pid}\n`, 'utf8');

console.log(`Started Vite dev server in the background on http://localhost:${port}/`);
console.log(`It will keep running after you close this terminal. Use npm run dev:stop to stop it.`);