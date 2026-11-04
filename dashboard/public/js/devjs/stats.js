// devjs/stats.js

import { secureFetch } from './core.js';

export async function loadServerStats() {
  const t0 = Date.now();
  try {
    // Fetch both endpoints in parallel — server-stats has system/memory/disk/process,
    // botstats has guild count, user count, and command count.
    const [s, b] = await Promise.all([
      secureFetch('/api-dev/server-stats').then(r => r.json()),
      secureFetch('/api-dev/botstats').then(r => r.json()).catch(() => ({})),
    ]);

    document.getElementById('latency').textContent   = `${Date.now() - t0} ms`;
    document.getElementById('ramUsed').textContent   = s.memory.used;
    document.getElementById('ramBar').style.width    = `${s.memory.usagePercent}%`;
    document.getElementById('sysUptime').textContent = s.system.uptime;
    document.getElementById('platform').textContent  = s.system.platform;
    document.getElementById('procMem').textContent   = s.process.memory;
    document.getElementById('pid').textContent       = s.process.pid;

    if (s.disk) {
      document.getElementById('diskVal').textContent = `${s.disk.percent}%`;
      document.getElementById('diskBar').style.width = `${s.disk.percent}%`;
    }

    const totalGuilds = b.guilds ?? s.bot?.guilds ?? 0;
    document.getElementById('totalGuilds').textContent = totalGuilds;

    // ── Populate the VPS & Bot detail panels ──────────────────────────────────
    // Map actual API fields to the display elements.

    function set(id, val) {
      const el = document.getElementById(id);
      if (el && val != null && val !== '') el.textContent = val;
    }

    // ── VPS / System card ─────────────────────────────────────────────────────
    // s.system.platform = "Linux x64" (already combined)
    // Split it for separate Architecture row if possible
    const platformStr = s.system.platform || '';
    const archMatch   = platformStr.match(/\b(x64|x86|arm64|arm|ia32)\b/i);
    const osPart      = archMatch ? platformStr.replace(archMatch[0], '').trim() : platformStr;

    set('vps-platform',   osPart || platformStr);
    set('vps-arch',       archMatch ? archMatch[0] : (s.cpu?.model ? s.cpu.model.split(' ')[0] : '—'));
    set('vps-cpus',       s.cpu?.cores != null ? `${s.cpu.cores} cores` : '—');
    set('vps-total-ram',  s.memory?.total  || '—');
    // Free RAM isn't in the response — derive it from total & usagePercent if possible
    if (s.memory?.total && s.memory?.usagePercent != null) {
      // total is a formatted string like "7.8 GB" — can't easily derive free,
      // so just show what's used vs total
      set('vps-free-ram', `${100 - s.memory.usagePercent}% available`);
    }
    set('vps-load',       s.cpu?.load != null ? `${s.cpu.load}` : '—');
    set('vps-disk-total', s.disk?.total  || '—');
    set('vps-uptime',     s.system?.uptime || '—');

    // ── Bot / Process card ────────────────────────────────────────────────────
    set('bot-node',     s.system?.nodeVersion || process?.version || '—');
    set('bot-pid',      s.process?.pid != null ? String(s.process.pid) : '—');
    set('bot-uptime',   s.process?.uptime || '—');
    // s.process.memory is RSS; show it as "RSS (process memory)"
    set('bot-heap',     s.process?.memory || '—');
    // External memory not available from this endpoint
    set('bot-external', '—');
    set('bot-guilds',   totalGuilds != null ? String(totalGuilds) : '—');
    set('bot-users',    b.users  != null ? String(b.users)  : '—');
    set('bot-commands', b.commands != null ? String(b.commands) : '—');

    // Keep legacy global hook working if anything else calls it
    if (typeof window._updateExtendedStats === 'function') {
      window._updateExtendedStats(s, b);
    }

  } catch (err) {
    console.warn('[stats] loadServerStats error:', err);
  }
}

// ── Server Analytics ──────────────────────────────────────────────────────────
// Fetches botstats + server-stats and renders a summary into #server-analytics-content

export async function loadServerAnalytics() {
  const el = document.getElementById('server-analytics-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.75rem">Loading…</div>';
  try {
    const [s, b] = await Promise.all([
      secureFetch('/api-dev/server-stats').then(r => r.json()),
      secureFetch('/api-dev/botstats').then(r => r.json()).catch(() => ({})),
    ]);
    const rows = [
      ['Servers',            b.guilds     != null ? b.guilds.toLocaleString()   : '—'],
      ['Cached Users',       b.users      != null ? b.users.toLocaleString()    : '—'],
      ['Channels',           b.channels   != null ? b.channels.toLocaleString() : '—'],
      ['Commands',           b.commands   != null ? b.commands.toLocaleString() : '—'],
      ['WS Ping',            b.ping       != null ? `${b.ping} ms`              : '—'],
      ['Premium Users',      b.premium?.users  != null ? b.premium.users.toLocaleString()  : '—'],
      ['Premium Guilds',     b.premium?.guilds != null ? b.premium.guilds.toLocaleString() : '—'],
      ['Blacklisted Users',  b.blacklisted?.users  != null ? b.blacklisted.users.toLocaleString()  : '—'],
      ['Blacklisted Guilds', b.blacklisted?.guilds != null ? b.blacklisted.guilds.toLocaleString() : '—'],
      ['RAM Used',           s.memory?.used          || '—'],
      ['RAM %',              s.memory?.usagePercent  != null ? `${s.memory.usagePercent}%` : '—'],
      ['CPU Load',           s.cpu?.load             != null ? `${s.cpu.load}` : '—'],
      ['CPU Cores',          s.cpu?.cores            != null ? String(s.cpu.cores) : '—'],
      ['Disk Used',          s.disk?.used            || '—'],
      ['System Uptime',      s.system?.uptime        || '—'],
      ['Node Version',       s.system?.nodeVersion   || '—'],
    ];
    el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px">` +
      rows.map(([label, val]) =>
        `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem">` +
        `<span style="color:var(--muted)">${label}</span>` +
        `<span style="font-weight:700;font-family:var(--mono)">${val}</span></div>`
      ).join('') +
    `</div>`;
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px 0;font-size:0.75rem">Failed to load analytics: ${err.message}</div>`;
  }
}

// ── Premium Analytics ─────────────────────────────────────────────────────────
// Summarises premium users/guilds by plan from /api-dev/premium

export async function loadPremiumAnalytics() {
  const el = document.getElementById('premium-analytics-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.73rem">Loading…</div>';
  try {
    const list = await secureFetch('/api-dev/premium').then(r => r.json());
    if (!Array.isArray(list) || !list.length) {
      el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.73rem">No premium records found.</div>';
      return;
    }
    const users  = list.filter(i => i.type === 'user');
    const guilds = list.filter(i => i.type === 'guild');
    const byPlan = {};
    for (const i of list) { byPlan[i.plan] = (byPlan[i.plan] || 0) + 1; }
    const now = Date.now();
    const active  = list.filter(i => !i.expiresAt || i.expiresAt > now);
    const expired = list.filter(i =>  i.expiresAt && i.expiresAt <= now);
    const summary = [
      ['Total Records',  list.length],
      ['Users',          users.length],
      ['Guilds',         guilds.length],
      ['Active',         active.length],
      ['Expired',        expired.length],
    ];
    const planRows = Object.entries(byPlan).sort((a, b) => b[1] - a[1]);
    el.innerHTML =
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 16px;margin-bottom:12px">` +
        summary.map(([l, v]) =>
          `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.78rem">` +
          `<span style="color:var(--muted)">${l}</span>` +
          `<span style="font-weight:700;font-family:var(--mono)">${v}</span></div>`
        ).join('') +
      `</div>` +
      `<div style="font-size:0.7rem;color:var(--muted);margin-bottom:6px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">By Plan</div>` +
      `<div style="display:flex;flex-wrap:wrap;gap:6px">` +
        planRows.map(([plan, count]) =>
          `<span style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:var(--accent);border-radius:6px;padding:3px 10px;font-size:0.73rem;font-family:var(--mono)">${plan}: ${count}</span>`
        ).join('') +
      `</div>`;
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px 0;font-size:0.73rem">Failed to load: ${err.message}</div>`;
  }
}