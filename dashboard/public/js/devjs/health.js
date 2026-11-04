// devjs/health.js — Bot health chart & live metrics
import { secureFetch } from './core.js';

let _chart    = null;
let _chartRAF = null;
let _data     = { labels: [], heap: [], rss: [], ping: [] };

export async function loadHealth() {
  try {
    const r = await secureFetch('/api-dev/health');
    if (!r.ok) return;
    const { history, current } = await r.json();

    // Update live stat pills
    set('hl-ping',   current.ping != null ? `${current.ping} ms` : '—');
    set('hl-guilds', current.guilds?.toLocaleString() ?? '—');
    set('hl-heap',   `${current.heapUsed} MB`);
    set('hl-rss',    `${current.rss} MB`);
    set('hl-uptime', formatUptime(current.uptime));

    // Color ping pill
    const pingEl = document.getElementById('hl-ping');
    if (pingEl) {
      const p = current.ping;
      pingEl.style.color = p == null ? 'var(--yellow)' : p < 100 ? 'var(--accent)' : p < 200 ? 'var(--yellow)' : 'var(--red)';
    }

    // Build chart data
    _data.labels = history.map(h => {
      const d = new Date(h.ts);
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    });
    _data.heap = history.map(h => h.heapUsed);
    _data.rss  = history.map(h => h.rss);
    _data.ping = history.map(h => h.load1 * 100); // Load * 100 as proxy

    drawChart();
  } catch (_) {}
}

function drawChart() {
  const canvas = document.getElementById('healthCanvas');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const labels = _data.labels;
  const heap   = _data.heap;
  const rss    = _data.rss;

  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width  = W;
  canvas.height = H;

  if (!labels.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font      = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Collecting data…', W / 2, H / 2);
    return;
  }

  ctx.clearRect(0, 0, W, H);

  const pad   = { top: 20, right: 20, bottom: 36, left: 52 };
  const gW    = W - pad.left - pad.right;
  const gH    = H - pad.top  - pad.bottom;
  const maxY  = Math.max(...rss, 100) * 1.1;
  const n     = labels.length;

  const xOf  = i  => pad.left + (i / (n - 1 || 1)) * gW;
  const yOf  = v  => pad.top  + gH - (v / maxY) * gH;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * gH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + gW, y); ctx.stroke();
    ctx.fillStyle  = 'rgba(255,255,255,0.25)';
    ctx.font       = '9px monospace';
    ctx.textAlign  = 'right';
    ctx.fillText(`${Math.round(maxY * (1 - i/4))} MB`, pad.left - 6, y + 3);
  }

  // RSS fill
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(rss[0]));
  rss.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
  ctx.lineTo(xOf(n-1), pad.top + gH);
  ctx.lineTo(xOf(0),   pad.top + gH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(99,102,241,0.15)';
  ctx.fill();

  // RSS line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(99,102,241,0.8)';
  ctx.lineWidth   = 2;
  rss.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
  ctx.stroke();

  // Heap fill
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(heap[0]));
  heap.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
  ctx.lineTo(xOf(n-1), pad.top + gH);
  ctx.lineTo(xOf(0),   pad.top + gH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(239,68,68,0.12)';
  ctx.fill();

  // Heap line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(239,68,68,0.9)';
  ctx.lineWidth   = 2;
  heap.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
  ctx.stroke();

  // X-axis labels (show every ~8)
  ctx.fillStyle  = 'rgba(255,255,255,0.2)';
  ctx.font       = '8px monospace';
  ctx.textAlign  = 'center';
  const step = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i < n; i += step) {
    ctx.fillText(labels[i], xOf(i), H - 6);
  }

  // Legend
  const legY = pad.top - 6;
  ctx.fillStyle = 'rgba(239,68,68,0.9)'; ctx.fillRect(pad.left, legY, 10, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
  ctx.fillText('Heap Used', pad.left + 14, legY + 4);
  ctx.fillStyle = 'rgba(99,102,241,0.8)'; ctx.fillRect(pad.left + 90, legY, 10, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('RSS', pad.left + 104, legY + 4);
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}