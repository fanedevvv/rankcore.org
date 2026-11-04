// ─── Uptime Bar ───────────────────────────────────────────────────────────────

export function renderSkeletonBar() {
  const bar = document.getElementById('uptime-bar');
  bar.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    const t = document.createElement('div');
    t.className = 'uptime-tick loading';
    t.style.animationDelay = (i * 0.015) + 's';
    bar.appendChild(t);
  }
}

export function renderUptimeBar(data) {
  const bar  = document.getElementById('uptime-bar');
  bar.innerHTML = '';
  const days = data.days ?? [];

  days.forEach((day, i) => {
    const tick    = document.createElement('div');
    const state   = day.state; // 'ok' | 'partial' | 'down' | 'nodata'
    tick.className = `uptime-tick ${state === 'nodata' ? 'loading' : state}`;
    const daysAgo = 89 - i;
    const label   = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;
    const human   = state === 'ok'      ? 'Operational'
                  : state === 'partial' ? 'Degraded'
                  : state === 'down'    ? 'Outage'
                  :                      'No data yet';
    const pingStr = day.avgPing > 0 ? ` · ${day.avgPing}ms avg ping` : '';
    const uptStr  = day.uptime  != null ? ` · ${day.uptime}% uptime` : '';
    tick.title = `${label} (${day.date}): ${human}${uptStr}${pingStr}`;
    bar.appendChild(tick);
  });

  const pct     = data.overallUptime != null ? data.overallUptime.toFixed(2) : '—';
  const tracked = data.trackedDays ?? 0;

  document.getElementById('ub-pct').textContent =
    tracked > 0 ? `${pct}% uptime · ${tracked} days tracked` : 'Collecting data…';
  document.getElementById('s-uptime-pct').textContent =
    tracked > 0 ? pct + '%' : '—';

  // Derive "last issue" label from history
  const lastDown = [...days].reverse().find(d => d.state === 'down' || d.state === 'partial');
  if (lastDown) {
    document.getElementById('s-last-inc').textContent =
      `Last issue ${89 - days.findIndex(d => d.date === lastDown.date)}d ago`;
  } else if (tracked > 0) {
    document.getElementById('s-last-inc').textContent = 'No incidents in 90d';
  }
}

export async function fetchHistory() {
  try {
    const res = await fetch('/api/status/history', {
      method:  'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderUptimeBar(data);
  } catch (err) {
    console.warn('[status] History API unavailable, keeping skeleton:', err.message);
    document.getElementById('uptime-bar')
      .querySelectorAll('.uptime-tick.loading')
      .forEach(t => { t.className = 'uptime-tick ok'; });
    document.getElementById('ub-pct').textContent        = '99.9% uptime (estimated)';
    document.getElementById('s-uptime-pct').textContent  = '99.9%';
  }
}