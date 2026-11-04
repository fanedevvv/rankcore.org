// devjs/globals.js — Misc window globals: DB stats, config inspector,
// scheduled maintenance, webhook test, user search, toggleReportStats

import { showToast } from './ui.js';

const DEV_H = () => ({
  'Content-Type': 'application/json',
  'x-dashboard-request': 'true',
  'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
});

// ── DB Stats ──────────────────────────────────────────────────────────────────
window.loadDbStats = async function loadDbStats() {
  const el = document.getElementById('db-stats-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px 0;font-size:0.75rem">Loading…</div>';
  try {
    const [b, s] = await Promise.all([
      fetch('/api-dev/botstats',     { headers: DEV_H() }).then(r => r.json()).catch(() => ({})),
      fetch('/api-dev/server-stats', { headers: DEV_H() }).then(r => r.json()).catch(() => ({})),
    ]);
    const rows = [
      ['Connection',        s.db?.state ?? 'connected'],
      ['Premium Users',     b.premium?.users    ?? '—'],
      ['Premium Guilds',    b.premium?.guilds   ?? '—'],
      ['Blacklisted Users', b.blacklisted?.users  ?? '—'],
      ['Blacklisted Guilds',b.blacklisted?.guilds ?? '—'],
      ['Bot Owners',        b.owners  ?? '—'],
      ['Cached Guilds',     b.guilds  ?? '—'],
      ['Cached Users',      b.users   ?? '—'],
      ['Cached Channels',   b.channels ?? '—'],
    ];
    el.innerHTML =
      '<div style="font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:10px">Schema Counts (live from DB)</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 16px">' +
      rows.map(r => {
        const isErr = r[1] === 'disconnected' || r[1] === 'error';
        return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.78rem"><span style="color:var(--muted)">${r[0]}</span><span style="font-weight:700;font-family:var(--mono);color:${isErr ? 'var(--red)' : 'inherit'}">${r[1]}</span></div>`;
      }).join('') + '</div>';
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px 0;font-size:0.75rem">Failed to load: ${err.message}</div>`;
  }
};

// ── Config Inspector ──────────────────────────────────────────────────────────
window.loadConfigInspector = async function loadConfigInspector() {
  const el = document.getElementById('config-inspector-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.73rem">Loading…</div>';
  try {
    const [b, s] = await Promise.all([
      fetch('/api-dev/botstats',     { headers: DEV_H() }).then(r => r.json()).catch(() => ({})),
      fetch('/api-dev/server-stats', { headers: DEV_H() }).then(r => r.json()).catch(() => ({})),
    ]);
    const secret = v => v ? '•'.repeat(Math.min(String(v).length, 8)) + ' [redacted]' : '(not set)';
    const rows = [
      ['NODE_ENV',       s.system?.nodeVersion ? 'production' : '—'],
      ['Node Version',   s.system?.nodeVersion || '—'],
      ['Platform',       s.system?.platform    || '—'],
      ['CPU Cores',      s.cpu?.cores != null ? s.cpu.cores + ' cores' : '—'],
      ['Total RAM',      s.memory?.total || '—'],
      ['Disk Total',     s.disk?.total   || '—'],
      ['BOT_TOKEN',      secret(true)],
      ['CLIENT_ID',      '(redacted)'],
      ['MONGO_URI',      secret(true)],
      ['SESSION_SECRET', secret(true)],
      ['Guilds Cached',  b.guilds  ?? '—'],
      ['Users Cached',   b.users   ?? '—'],
      ['WS Ping',        b.ping    != null ? b.ping + 'ms' : '—'],
    ];
    el.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 20px">' +
      rows.map(r => {
        const isRedacted = String(r[1]).includes('redacted');
        return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.76rem"><span style="color:var(--muted);font-family:var(--mono)">${r[0]}</span><span style="font-weight:600;font-family:var(--mono);color:${isRedacted ? 'rgba(251,146,60,0.7)' : 'inherit'}">${r[1]}</span></div>`;
      }).join('') + '</div>';
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px 0;font-size:0.73rem">Failed to load: ${err.message}</div>`;
  }
};

// ── Scheduled Maintenance ────────────────────────────────────────────────────
window.loadScheduledMaintenance = async function loadScheduledMaintenance() {
  const el = document.getElementById('sched-maint-status');
  if (!el) return;
  try {
    const res = await fetch('/api-dev/maintenance', { headers: DEV_H() });
    const data = res.ok ? await res.json() : {};
    if (data.enabled) {
      const eta = data.endsAt ? ' — ends ' + new Date(data.endsAt).toLocaleTimeString() : '';
      el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);border-radius:8px;font-size:0.75rem"><span style="width:7px;height:7px;border-radius:50%;background:#fbbf24;flex-shrink:0"></span><span style="color:#fbbf24;font-weight:700">Maintenance active${eta}</span>${data.reason ? `<span style="color:var(--muted);margin-left:4px">— ${data.reason}</span>` : ''}</div>`;
    } else {
      el.innerHTML = '<div style="color:var(--muted);font-size:0.73rem;text-align:center;padding:8px 0">No scheduled maintenance active.</div>';
    }
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red);font-size:0.73rem">${err.message}</div>`;
  }
};

window.scheduleMaintenanceNow = async function scheduleMaintenanceNow() {
  const reason   = document.getElementById('sm-reason')?.value?.trim();
  const startsIn = parseInt(document.getElementById('sm-starts-in')?.value) || 30;
  const duration = parseInt(document.getElementById('sm-duration')?.value)  || 30;
  try {
    const res = await fetch('/api-dev/maintenance', {
      method: 'POST', headers: DEV_H(),
      body: JSON.stringify({ enabled: true, reason: reason || 'Scheduled maintenance', startsInMinutes: startsIn, durationMinutes: duration }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    showToast(`Maintenance scheduled (${startsIn}m from now, ${duration}m duration)`);
    window.loadScheduledMaintenance?.();
  } catch (err) { showToast(err.message, true); }
};

// ── Test Webhook ──────────────────────────────────────────────────────────────
window.testWebhook = async function testWebhook() {
  const btn = document.getElementById('wh-btn');
  const msg = document.getElementById('wh-message')?.value?.trim();
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }
  try {
    const res = await fetch('/api-dev/broadcast', {
      method: 'POST', headers: DEV_H(),
      body: JSON.stringify({ message: msg || 'Test webhook from Roco Dev Panel — ' + new Date().toLocaleTimeString(), type: 'test' }),
    });
    const data = await res.json();
    showToast(res.ok ? 'Webhook test sent ✓' : (data.error || 'Failed to send'), !res.ok);
  } catch (err) { showToast(err.message, true); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🚀 Send Test'; } }
};

// ── User Search ───────────────────────────────────────────────────────────────
window.runUserSearch = async function runUserSearch() {
  const type  = document.getElementById('us-type')?.value  || 'id';
  const query = (document.getElementById('us-query')?.value || '').trim();
  const out   = document.getElementById('us-results');
  if (!out) return;
  if (!query) { out.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.73rem">Enter a query above</div>'; return; }
  out.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.73rem">Searching…</div>';

  try {
    const url = type === 'premium' ? '/api-dev/premium' : type === 'blacklisted' ? '/api-dev/blacklist/users' : `/api-dev/search?q=${encodeURIComponent(query)}`;
    const res  = await fetch(url, { headers: DEV_H() });
    const data = await res.json();
    if (!res.ok) { out.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px 0;font-size:0.73rem">${data.error || 'Request failed'}</div>`; return; }

    let items = [];
    if (type === 'id') {
      const u = data.user;
      if (u) items.push({ id: u.id, label: (u.username||'Unknown')+(u.discriminator&&u.discriminator!=='0'?'#'+u.discriminator:''), sub: 'ID: '+u.id+(u.bot?' · BOT':''), avatar: u.avatar||null, badges: [data.premium?.isPremium?{text:'Premium',color:'#fbbf24'}:null,data.blacklisted?.isBlacklisted?{text:'Blacklisted',color:'#f87171'}:null].filter(Boolean) });
      (data.guilds||[]).slice(0,5).forEach(g => items.push({ id:g.id, label:g.name||g.id, sub:'Guild · '+(g.memberCount||'?')+' members', avatar:null, badges:[] }));
    } else if (type === 'premium') {
      items = (Array.isArray(data)?data:[]).filter(i=>!query||i.id.includes(query)).slice(0,20).map(i=>({id:i.id,label:i.id,sub:i.type+' · '+(i.plan||'unknown'),avatar:null,badges:[{text:i.type==='user'?'⭐ User':'⭐ Guild',color:'#fbbf24'}]}));
    } else {
      items = (Array.isArray(data)?data:(data.users||[])).filter(i=>!query||(i.id||'').includes(query)||(i.reason||'').toLowerCase().includes(query.toLowerCase())).slice(0,20).map(i=>({id:i.id,label:i.id,sub:i.reason||'No reason',avatar:null,badges:[{text:'🚫 Blacklisted',color:'#f87171'}]}));
    }

    if (!items.length) { out.innerHTML = `<div style="color:var(--muted);text-align:center;padding:20px 0;font-size:0.73rem">No results found for <strong style="color:#fff">${query}</strong></div>`; return; }
    out.innerHTML = items.map(item => {
      const badgeHtml = (item.badges||[]).map(b=>`<span style="font-size:0.58rem;font-weight:700;padding:2px 6px;border-radius:10px;background:rgba(255,255,255,0.06);color:${b.color};border:1px solid ${b.color}44">${b.text}</span>`).join('');
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:8px;margin-bottom:5px">${item.avatar?`<img src="${item.avatar}" style="width:32px;height:32px;border-radius:50%;flex-shrink:0" onerror="this.style.display='none'">`:'<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:var(--muted)">?</div>'}<div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px">${item.label} ${badgeHtml}</div><div style="font-size:0.62rem;color:var(--muted);margin-top:1px">${item.sub}</div></div></div>`;
    }).join('');
  } catch (err) {
    out.innerHTML = `<div style="color:var(--red);text-align:center;padding:20px 0;font-size:0.73rem">${err.message}</div>`;
  }
};

// ── Toggle report stats panel ─────────────────────────────────────────────────
window.toggleReportStats = function toggleReportStats() {
  const el = document.getElementById('report-stats-content');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    window.loadReportStats?.();
  } else {
    el.style.display = 'none';
  }
};