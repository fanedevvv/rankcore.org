// statusjs/tooltip.js — Floating tooltip for uptime bar ticks
// ─────────────────────────────────────────────────────────────────────────────

const STATE_LABELS = { ok: 'Operational', partial: 'Degraded', down: 'Outage', nodata: 'No data' };
const STATE_COLORS = { ok: '#4de87d', partial: '#ffb563', down: '#ff7088', nodata: '#5c6680' };

export function showTooltip(e, date, state, ping) {
  const tt = document.getElementById('tick-tooltip');
  if (!tt) return;

  document.getElementById('tt-date').textContent = date;

  const stateEl = document.getElementById('tt-state');
  stateEl.textContent = STATE_LABELS[state] || state;
  stateEl.style.color = STATE_COLORS[state] || '#dce3f0';

  const pingEl = document.getElementById('tt-ping');
  pingEl.textContent = ping != null && ping > 0 ? `Avg ping: ${ping}ms` : '';

  tt.style.left = e.clientX + 12 + 'px';
  tt.style.top  = e.clientY - 40 + 'px';
  tt.classList.add('show');
}

export function hideTooltip() {
  const tt = document.getElementById('tick-tooltip');
  if (tt) tt.classList.remove('show');
}

export function initTooltipTracking() {
  document.addEventListener('mousemove', e => {
    const tt = document.getElementById('tick-tooltip');
    if (tt?.classList.contains('show')) {
      tt.style.left = e.clientX + 12 + 'px';
      tt.style.top  = e.clientY - 40 + 'px';
    }
  });
}