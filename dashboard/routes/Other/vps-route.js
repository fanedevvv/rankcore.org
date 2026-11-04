/**
 * vps-route.js — /api/status/vps route
 * ──────────────────────────────────────
 * Add this to your main Express app:
 *
 *   const vpsRoute = require('./vps-route');
 *   app.use('/api/status/vps', vpsRoute);
 *
 * Required env vars:
 *   CB_HOST          IP / hostname of the secondary VPS (from your .env)
 *
 * Optional env vars:
 *   VPS_AGENT_PORT   Port the agent runs on              (default: 7843)
 *   VPS_AGENT_TOKEN  Shared secret token for agent auth  (must match agent's token)
 *   VPS_MAIN_NAME    Display name for this server        (default: "Main Server")
 *   VPS_CB_NAME      Display name for the CB server      (default: "CB Server")
 *   VPS_MAIN_REGION  Region label for main server        (default: "")
 *   VPS_CB_REGION    Region label for CB server          (default: "")
 */

'use strict';

const express      = require('express');
const os           = require('os');
const http         = require('http');
const { execSync } = require('child_process');

const router = express.Router();

const AGENT_PORT  = parseInt(process.env.VPS_AGENT_PORT  || '7843', 10);
const TOKEN       = process.env.VPS_AGENT_TOKEN           || null;
const MAIN_NAME   = process.env.VPS_MAIN_NAME             || 'Main Server';
const CB_NAME     = process.env.VPS_CB_NAME               || 'CB Server';
const { execFileSync } = require('child_process');

const MAIN_REGION = process.env.VPS_MAIN_REGION           || '';
const CB_REGION   = process.env.VPS_CB_REGION             || '';

// ── Shell helper ──────────────────────────────────────────────────────────────
function sh(cmd, timeout = 3000) {
  try {
    return execFileSync('/bin/sh', ['-c', cmd], { timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// ── CPU usage (two /proc/stat samples, 500ms apart) ───────────────────────────
function readCpuTimes() {
  try {
    const line = require('fs').readFileSync('/proc/stat', 'utf8').split('\n')[0];
    const parts = line.trim().split(/\s+/).slice(1).map(Number);
    const idle  = parts[3] + (parts[4] || 0);
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
  } catch {
    return null;
  }
}

async function getCpuPercent() {
  const t1 = readCpuTimes();
  if (!t1) return null;
  await new Promise(r => setTimeout(r, 500));
  const t2 = readCpuTimes();
  if (!t2) return null;
  const dIdle  = t2.idle  - t1.idle;
  const dTotal = t2.total - t1.total;
  if (dTotal === 0) return 0;
  return Math.round((1 - dIdle / dTotal) * 100 * 10) / 10;
}

// ── Collect stats for THIS server ─────────────────────────────────────────────
async function collectOwnStats() {
  const cpus     = os.cpus();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const loadAvg  = os.loadavg();

  const cpuPercent = await getCpuPercent();

  // Disk
  let disk = { total: 0, used: 0, free: 0, usedPct: 0 };
  const dfOut = sh("df -k / 2>/dev/null | tail -1");
  if (dfOut) {
    const p = dfOut.split(/\s+/);
    disk.total   = (parseInt(p[1]) || 0) * 1024;
    disk.used    = (parseInt(p[2]) || 0) * 1024;
    disk.free    = (parseInt(p[3]) || 0) * 1024;
    disk.usedPct = disk.total ? Math.round(disk.used / disk.total * 100) : 0;
  }

  // Additional mounts
  let mounts = [];
  const dfAllOut = sh("df -k --output=target,size,used,avail,pcent 2>/dev/null | tail -n +2");
  if (dfAllOut) {
    mounts = dfAllOut.split('\n').slice(0, 6).map(line => {
      const p = line.trim().split(/\s+/);
      return { mount: p[0], total: (parseInt(p[1])||0)*1024, used: (parseInt(p[2])||0)*1024, usedPct: parseInt(p[4])||0 };
    }).filter(m => m.mount && !m.mount.startsWith('/sys') && !m.mount.startsWith('/dev') && !m.mount.startsWith('/run') && !m.mount.startsWith('/proc'));
  }

  // Network I/O
  let netIO = { rxBytes: 0, txBytes: 0 };
  const netDevOut = sh("cat /proc/net/dev 2>/dev/null");
  if (netDevOut) {
    for (const line of netDevOut.split('\n').slice(2)) {
      const p = line.trim().split(/\s+/);
      const iface = (p[0] || '').replace(':', '');
      if (iface && iface !== 'lo') {
        netIO.rxBytes += parseInt(p[1])  || 0;
        netIO.txBytes += parseInt(p[9])  || 0;
      }
    }
  }

  const distro = sh("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"'") || os.type();
  const kernel = sh("uname -r 2>/dev/null") || os.release();

  // CPU temp
  let cpuTemp = null;
  const rawTemp = sh("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null");
  if (rawTemp && /^\d+$/.test(rawTemp)) cpuTemp = Math.round(parseInt(rawTemp) / 100) / 10;

  // Swap
  let swap = { total: 0, used: 0 };
  const swapOut = sh("free -b 2>/dev/null | grep Swap");
  if (swapOut) {
    const p = swapOut.split(/\s+/);
    swap.total = parseInt(p[1]) || 0;
    swap.used  = parseInt(p[2]) || 0;
  }

  // Process / thread count
  const processCount = parseInt(sh("ps aux 2>/dev/null | wc -l") || '0') - 1;
  const threadCount  = parseInt(sh("ls /proc/*/task 2>/dev/null | wc -l") || '0');

  // TCP connections
  let tcpConns = null;
  const tcpOut = sh("ss -s 2>/dev/null | grep 'TCP:' | head -1");
  if (tcpOut) {
    const m = tcpOut.match(/estab\s+(\d+)/i) || tcpOut.match(/(\d+)\s+estab/i);
    if (m) tcpConns = parseInt(m[1]);
  }

  // Open file descriptors
  let openFds = null;
  const fdOut = sh("cat /proc/sys/fs/file-nr 2>/dev/null");
  if (fdOut) {
    const parts = fdOut.split(/\s+/);
    if (parts[0]) openFds = parseInt(parts[0]) || null;
  }

  // Logged-in users
  let loggedUsers = null;
  const whoOut = sh("who 2>/dev/null | wc -l");
  if (whoOut) loggedUsers = parseInt(whoOut) || 0;

  // Last boot time
  let bootTime = null;
  const uptimeSecOut = sh("cat /proc/uptime 2>/dev/null");
  if (uptimeSecOut) {
    const secs = parseFloat(uptimeSecOut.split(' ')[0]);
    if (!isNaN(secs)) bootTime = Date.now() - Math.round(secs * 1000);
  }

  // Top processes
  let topProcs = [];
  const topOut = sh("ps aux --sort=-%cpu 2>/dev/null | awk 'NR>=2 && NR<=6 {printf \"%s\\t%s\\t%s\\t%s\\n\",$1,$3,$4,$11}'");
  if (topOut) {
    topProcs = topOut.split('\n').map(line => {
      const p = line.split('\t');
      return {
        user: p[0],
        cpu:  parseFloat(p[1]) || 0,
        mem:  parseFloat(p[2]) || 0,
        cmd:  (p[3] || '').split('/').pop().substring(0, 32),
      };
    }).filter(p => p.cmd);
  }

  // PM2 processes
  let pm2Procs = [];
  const pm2Out = sh("pm2 jlist 2>/dev/null", 5000);
  if (pm2Out) {
    try {
      const list = JSON.parse(pm2Out);
      pm2Procs = list.map(p => ({
        name:     p.name,
        status:   p.pm2_env?.status,
        cpu:      p.monit?.cpu,
        memory:   p.monit?.memory,
        uptime:   p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
        restarts: p.pm2_env?.restart_time,
        pid:      p.pid,
      }));
    } catch {}
  }

  // ── Sanitise: never expose the real hostname (it may contain the server name/IP)
  //    We replace it with a safe masked label derived from the role (set by caller).
  return {
    // hostname intentionally omitted — set to masked value by caller
    platform:     os.platform(),
    arch:         os.arch(),
    os:           distro,
    kernel,
    uptime:       os.uptime() * 1000,
    bootTime,
    cpuModel:     cpus[0]?.model?.trim().replace(/\s+/g, ' ') || 'Unknown',
    cpuCores:     cpus.length,
    cpuFreqMHz:   cpus[0]?.speed || null,
    cpuPercent,
    loadAvg:      { '1m': Math.round(loadAvg[0]*100)/100, '5m': Math.round(loadAvg[1]*100)/100, '15m': Math.round(loadAvg[2]*100)/100 },
    cpuTemp,
    memory: {
      total:    totalMem,
      used:     totalMem - freeMem,
      free:     freeMem,
      usedPct:  Math.round((totalMem - freeMem) / totalMem * 100),
    },
    swap,
    disk,
    mounts,
    netIO,
    processCount,
    threadCount,
    tcpConns,
    openFds,
    loggedUsers,
    topProcs,
    pm2Procs,
    nodeVersion:  process.version,
    agentVersion: 'built-in',
    timestamp:    Date.now(),
  };
}

// ── Fetch stats from remote agent ─────────────────────────────────────────────
function fetchRemoteStats(host, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port:     AGENT_PORT,
      path:     `/stats${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ''}`,
      method:   'GET',
      timeout:  timeoutMs,
      headers:  TOKEN ? { 'x-agent-token': TOKEN } : {},
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => {
        try   { resolve(JSON.parse(body)); }
        catch { reject(new Error('Invalid JSON from agent')); }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Agent request timed out')); });
    req.on('error',   err => reject(err));
    req.end();
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  // CB server is now co-located on this machine — fall back to loopback if CB_HOST unset.
  const cbHost = process.env.CB_HOST || '127.0.0.1';

  const [ownResult, cbResult] = await Promise.allSettled([
    collectOwnStats(),
    fetchRemoteStats(cbHost),
  ]);

  // ── Build main server payload — strip hostname, never expose IP ──────────
  const mainStats = ownResult.status === 'fulfilled'
    ? {
        ...ownResult.value,
        hostname: null,          // real hostname never sent to client
        status:   'online',
        name:     MAIN_NAME,
        role:     'main',
        region:   MAIN_REGION,
      }
    : { status: 'error', name: MAIN_NAME, role: 'main', region: MAIN_REGION, error: ownResult.reason?.message };

  // ── Build CB server payload — strip hostname AND the host IP ─────────────
  const cbStats = cbResult.status === 'fulfilled'
    ? {
        ...cbResult.value,
        hostname: null,          // real hostname never sent to client
        host:     null,          // CB_HOST IP never sent to client
        status:   'online',
        name:     CB_NAME,
        role:     'cb',
        region:   CB_REGION,
      }
    : {
        status:   'offline',
        name:     CB_NAME,
        role:     'cb',
        region:   CB_REGION,
        host:     null,          // never expose IP even in error state
        // Sanitise error message — agent connection errors contain the IP
        error:    cbResult.reason?.message
          ?.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '[redacted]')
          ?.replace(cbHost, '[redacted]') || 'Could not connect to stats agent',
      };

  res.json({
    servers:   [mainStats, cbStats],
    fetchedAt: Date.now(),
  });
});

module.exports = router;