// statusjs/fmt.js — Date / duration / uptime format helpers
// ─────────────────────────────────────────────────────────────────────────────

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

export function fmtDuration(ms) {
  if (!ms) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return '< 1m';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60), rm = m % 60;
  return h + 'h' + (rm ? ` ${rm}m` : '');
}

export function fmtUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400),
        h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  if (m) parts.push(m + 'm');
  return parts.join(' ') || s + 's';
}