// devjs/consolelogs.js — Live bot console log viewer (READ-ONLY)
// ─────────────────────────────────────────────────────────────────────────────
// This module ONLY reads log output from the bot. It does NOT:
//  - Execute any code or shell commands on the server
//  - Write to any log files or VPS filesystem
//  - Accept user input as commands
//
// Data flow: SSE stream / REST poll → display only.
// Uses SSE (/api-dev/logs/stream) for real-time tail.
// Falls back to polling /api-dev/logs/recent if SSE fails.

import { _csrf, escapeHtml } from './core.js';

// ─── State ────────────────────────────────────────────────────────────────────

let   _sse          = null;
let   _pollTimer    = null;
let   _paused       = false;
let   _filter       = '';
let   _levelFilter  = 'all';
let   _autoScroll   = true;
let   _lineCount    = 0;
const MAX_LINES     = 500;   // cap DOM nodes

// ─── Log level detection ──────────────────────────────────────────────────────

const LEVELS = [
  { key: 'error',  pattern: /\b(error|err|exception|fatal|uncaught|unhandled)\b/i, color: '#ed4245', bg: 'rgba(237,66,69,0.08)',  label: 'ERR'  },
  { key: 'warn',   pattern: /\b(warn|warning|deprecated)\b/i,                      color: '#faa61a', bg: 'rgba(250,166,26,0.07)', label: 'WARN' },
  { key: 'debug',  pattern: /\b(debug|verbose)\b/i,                                color: '#7289da', bg: 'rgba(88,101,242,0.07)', label: 'DBG'  },
  { key: 'info',   pattern: /\b(info|ready|started|connected|listening)\b/i,        color: '#57f287', bg: 'rgba(87,242,135,0.06)', label: 'INFO' },
];

function detectLevel(line) {
  for (const lvl of LEVELS) {
    if (lvl.pattern.test(line)) return lvl;
  }
  return { key: 'log', color: '#b9bbbe', bg: 'transparent', label: 'LOG' };
}

// ─── Timestamp prefix strip / normalise ──────────────────────────────────────

// PM2 prefixes lines like: "2024-01-15T10:22:33: " or "10:22:33 AM  "
const STRIP_TS = /^[\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2}([\.,]\d+)?Z?\s*:\s*/;

function parseLine(raw) {
  const text      = raw.replace(STRIP_TS, '').trim();
  const level     = detectLevel(text);
  const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  return { text, level, timestamp, raw };
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function getConsole() { return document.getElementById('consoleOutput'); }
function getStatus()  { return document.getElementById('consoleStatus'); }

function setStatus(text, color = '#72767d') {
  const el = getStatus();
  if (el) { el.textContent = text; el.style.color = color; }
}

function setConnBadge(state) {
  const b = document.getElementById('consoleBadge');
  if (!b) return;
  const map = {
    live:       { text: '● LIVE',        color: '#57f287', bg: 'rgba(87,242,135,0.1)',   border: 'rgba(87,242,135,0.25)'  },
    connecting: { text: '◌ CONNECTING',  color: '#faa61a', bg: 'rgba(250,166,26,0.08)',  border: 'rgba(250,166,26,0.2)'   },
    polling:    { text: '⟳ POLLING',     color: '#7289da', bg: 'rgba(88,101,242,0.08)',  border: 'rgba(88,101,242,0.2)'   },
    paused:     { text: '⏸ PAUSED',      color: '#faa61a', bg: 'rgba(250,166,26,0.08)',  border: 'rgba(250,166,26,0.2)'   },
    error:      { text: '✕ DISCONNECTED',color: '#ed4245', bg: 'rgba(237,66,69,0.08)',   border: 'rgba(237,66,69,0.2)'    },
  };
  const s = map[state] || map.error;
  b.textContent        = s.text;
  b.style.color        = s.color;
  b.style.background   = s.bg;
  b.style.borderColor  = s.border;
}

// ─── Append a single line to the console pane ────────────────────────────────

function appendLine(raw) {
  if (_paused) return;
  const { text, level, timestamp } = parseLine(raw);
  if (!text) return;

  // Level filter
  if (_levelFilter !== 'all' && level.key !== _levelFilter) return;

  // Text filter
  if (_filter && !text.toLowerCase().includes(_filter)) return;

  const pane = getConsole();
  if (!pane) return;

  // Prune oldest lines when we hit the cap
  _lineCount++;
  if (_lineCount > MAX_LINES) {
    pane.firstChild && pane.removeChild(pane.firstChild);
  }

  const row = document.createElement('div');
  row.className   = 'console-line';
  row.dataset.raw = raw;   // keep for re-render on filter change
  row.style.cssText = `
    display:flex;gap:10px;padding:3px 12px;font-size:0.75rem;
    font-family:'JetBrains Mono',monospace;line-height:1.5;
    background:${level.bg};border-left:2px solid ${level.color === '#b9bbbe' ? 'transparent' : level.color};
    align-items:flex-start;
  `;

  row.innerHTML =
    `<span style="color:#4f545c;flex-shrink:0;user-select:none">${escapeHtml(timestamp)}</span>` +
    `<span style="color:${level.color};font-weight:800;font-size:0.65rem;flex-shrink:0;margin-top:2px;letter-spacing:0.05em;width:32px">${level.label}</span>` +
    `<span style="color:#dcddde;word-break:break-all;white-space:pre-wrap">${escapeHtml(text)}</span>`;

  pane.appendChild(row);

  if (_autoScroll) pane.scrollTop = pane.scrollHeight;
}

// ─── Bulk load (initial fetch / re-filter) ────────────────────────────────────

export async function loadRecentLogs() {
  const lines = parseInt(document.getElementById('consoleTailLines')?.value || 200);
  try {
    const r = await fetch(`/api-dev/logs/recent?lines=${lines}`, {
      credentials: 'same-origin',
      headers: { 'x-dashboard-request': 'true', 'X-CSRF-Token': _csrf },
    });
    if (!r.ok) { setStatus('Failed to load logs', '#ed4245'); return; }
    const { logs, source } = await r.json();
    clearConsole(false);
    setStatus(`Loaded ${logs.length} lines from ${source}`, '#72767d');
    logs.forEach(l => appendLine(l));
  } catch (e) {
    setStatus(`Error: ${e.message}`, '#ed4245');
  }
}

// ─── SSE connection ───────────────────────────────────────────────────────────

function startSSE() {
  if (_sse) { _sse.close(); _sse = null; }
  clearPoll();

  setConnBadge('connecting');
  setStatus('Connecting to log stream...', '#faa61a');

  const url = `/api-dev/logs/stream?token=${encodeURIComponent(_csrf)}`;
  _sse = new EventSource(url, { withCredentials: true });

  _sse.addEventListener('log', e => {
    appendLine(e.data);
  });

  _sse.addEventListener('snapshot', e => {
    try {
      const lines = JSON.parse(e.data);
      clearConsole(false);
      lines.forEach(l => appendLine(l));
      setConnBadge('live');
      setStatus('Live — streaming from PM2', '#57f287');
    } catch {}
  });

  _sse.addEventListener('source', e => {
    setStatus(`Live — ${e.data}`, '#57f287');
    setConnBadge('live');
  });

  _sse.onerror = () => {
    _sse.close();
    _sse = null;
    setConnBadge('polling');
    setStatus('SSE failed — falling back to polling every 5s', '#faa61a');
    startPolling();
  };
}

// ─── Polling fallback ─────────────────────────────────────────────────────────

let _lastLine = '';

function startPolling() {
  clearPoll();
  _pollTimer = setInterval(async () => {
    if (_paused) return;
    try {
      const r    = await fetch('/api-dev/logs/recent?lines=50', {
        credentials: 'same-origin',
        headers: { 'x-dashboard-request': 'true', 'X-CSRF-Token': _csrf },
      });
      const data = await r.json();
      const logs = data.logs || [];
      if (!logs.length) return;

      const newest = logs[logs.length - 1];
      if (newest === _lastLine) return;   // nothing new

      // Find where we left off
      const idx = _lastLine ? logs.lastIndexOf(_lastLine) : -1;
      const newLines = idx >= 0 ? logs.slice(idx + 1) : logs;
      newLines.forEach(l => appendLine(l));
      _lastLine = newest;
    } catch {}
  }, 5000);
}

function clearPoll() {
  if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
}

// ─── Console controls ─────────────────────────────────────────────────────────

export function clearConsole(resetCount = true) {
  const pane = getConsole();
  if (pane) pane.innerHTML = '';
  if (resetCount) { _lineCount = 0; _lastLine = ''; }
}

export function togglePause() {
  _paused = !_paused;
  const btn = document.getElementById('consolePauseBtn');
  if (btn) {
    btn.textContent = _paused ? '▶ Resume' : '⏸ Pause';
    btn.style.color = _paused ? '#57f287' : '#b9bbbe';
  }
  setConnBadge(_paused ? 'paused' : (_sse ? 'live' : 'polling'));
}

export function toggleAutoScroll() {
  _autoScroll = !_autoScroll;
  const btn = document.getElementById('consoleScrollBtn');
  if (btn) {
    btn.style.color = _autoScroll ? '#FF3333' : '#b9bbbe';
    btn.title = `Auto-scroll: ${_autoScroll ? 'ON' : 'OFF'}`;
  }
}

export function setConsoleFilter(val) {
  _filter = val.toLowerCase();
  reRender();
}

export function setLevelFilter(val) {
  _levelFilter = val;
  reRender();
}

// Re-render all stored raw lines through the current filters
function reRender() {
  const pane = getConsole();
  if (!pane) return;
  const rawLines = Array.from(pane.querySelectorAll('.console-line')).map(r => r.dataset.raw);
  clearConsole(false);
  rawLines.forEach(l => appendLine(l));
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export async function initConsole() {
  // Wire auto-scroll detection
  const pane = document.getElementById('consoleOutput');
  if (pane) {
    pane.addEventListener('scroll', () => {
      const atBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 40;
      if (_autoScroll !== atBottom) {
        _autoScroll = atBottom;
        const btn = document.getElementById('consoleScrollBtn');
        if (btn) btn.style.color = _autoScroll ? '#FF3333' : '#b9bbbe';
      }
    });
  }

  await loadRecentLogs();
  startSSE();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (_sse) _sse.close();
  clearPoll();
});