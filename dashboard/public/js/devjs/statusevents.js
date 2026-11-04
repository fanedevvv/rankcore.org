// devjs/statusevents.js — Status override panel + incident management

import { showToast } from './ui.js';

const DEV_HEADERS = () => ({
  'Content-Type': 'application/json',
  'x-dashboard-request': 'true',
  'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
});

export async function seLoad() {
  try {
    const [ovRes, evRes] = await Promise.all([
      fetch('/api-dev/status-override', { headers: DEV_HEADERS() }),
      fetch('/api-dev/status-event',    { headers: DEV_HEADERS() }),
    ]);
    const ov = ovRes.ok ? await ovRes.json() : {};
    const ev = evRes.ok ? await evRes.json() : {};
    seRenderOverride(ov.override);
    seRenderIncidents(ev.ongoing, ev.recent || []);
  } catch (err) {
    console.error('[se] load error', err);
  }
}

export function seRenderOverride(override) {
  const badge    = document.getElementById('se-override-badge');
  const box      = document.getElementById('se-active-override');
  const boxText  = document.getElementById('se-active-override-text');
  const clearBtn = document.getElementById('se-clear-btn');

  if (override) {
    if (badge) {
      badge.style.display = '';
      const colMap = { operational:'rgba(239,68,68,0.12)', degraded:'rgba(251,146,60,0.12)', recovering:'rgba(34,211,238,0.12)', down:'rgba(248,113,113,0.12)' };
      const txtMap = { operational:'#ef4444', degraded:'#fb923c', recovering:'#22d3ee', down:'#f87171' };
      badge.style.background  = colMap[override.status] || 'rgba(255,255,255,0.06)';
      badge.style.color       = txtMap[override.status] || '#fff';
      badge.style.borderColor = txtMap[override.status] || 'var(--border)';
      badge.textContent       = 'OVERRIDE: ' + override.status.toUpperCase();
    }
    if (box) box.style.display = 'block';
    if (boxText) {
      const exp = override.expiresAt ? ' · expires ' + new Date(override.expiresAt).toLocaleTimeString() : ' · manual clear only';
      boxText.textContent = `Status: ${override.status}  ·  set by ${override.setBy ?? 'unknown'}${override.reason ? '  ·  "' + override.reason + '"' : ''}${exp}`;
    }
    if (clearBtn) clearBtn.disabled = false;
  } else {
    if (badge)   badge.style.display = 'none';
    if (box)     box.style.display   = 'none';
    if (clearBtn) clearBtn.disabled  = true;
  }
}

export function seRenderIncidents(ongoing, recent) {
  const badge = document.getElementById('se-incident-badge');
  const list  = document.getElementById('se-incident-list');

  if (badge) {
    if (ongoing) {
      badge.style.background  = 'rgba(248,113,113,0.1)';
      badge.style.color       = 'var(--red)';
      badge.style.borderColor = 'rgba(248,113,113,0.25)';
      badge.textContent       = '● Ongoing incident';
    } else {
      badge.style.background  = 'rgba(255,255,255,0.04)';
      badge.style.color       = 'var(--muted)';
      badge.style.borderColor = 'var(--border)';
      badge.textContent       = 'No ongoing incident';
    }
  }

  if (!list) return;
  const all = [];
  if (ongoing) all.push({ ...ongoing, _isOngoing: true });
  all.push(...(recent || []));

  if (!all.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:0.75rem;font-weight:700;text-align:center;padding:12px 0">No recent incidents</div>';
    return;
  }

  list.innerHTML = all.slice(0, 6).map(inc => {
    const isOngoing = inc.status === 'ongoing';
    const dot   = isOngoing ? 'background:var(--red);box-shadow:0 0 6px var(--red)' : 'background:var(--accent)';
    const ibadge = isOngoing
      ? `<span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(248,113,113,0.1);color:var(--red);border:1px solid rgba(248,113,113,0.2)">ONGOING</span>`
      : `<span style="font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:10px;background:rgba(239,68,68,0.08);color:var(--accent);border:1px solid rgba(239,68,68,0.18)">RESOLVED</span>`;
    const ts = new Date(inc.openedAt).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:rgba(255,255,255,0.025);border:1px solid var(--border);border-radius:8px">
      <div style="width:7px;height:7px;border-radius:50%;margin-top:4px;flex-shrink:0;${dot}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.75rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${inc.title}</div>
        <div style="font-size:0.62rem;color:var(--muted);margin-top:2px">${ts}</div>
      </div>
      ${ibadge}
    </div>`;
  }).join('');
}

export async function seSetOverride() {
  const status  = document.getElementById('se-status')?.value;
  const reason  = document.getElementById('se-reason')?.value;
  const expires = document.getElementById('se-expires')?.value;
  const body = { status, reason };
  if (expires) body.expiresInMinutes = parseInt(expires);
  try {
    const res = await fetch('/api-dev/status-override', { method: 'POST', headers: DEV_HEADERS(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    showToast('Status override set → ' + status);
    seRenderOverride(data.override);
  } catch (err) { showToast(err.message, true); }
}

export async function seClearOverride() {
  try {
    const res = await fetch('/api-dev/status-override', { method: 'DELETE', headers: DEV_HEADERS() });
    if (!res.ok) { const d = await res.json(); return showToast(d.error || 'Failed', true); }
    showToast('Status override cleared');
    seRenderOverride(null);
  } catch (err) { showToast(err.message, true); }
}

export async function seOpenIncident() {
  const title    = document.getElementById('se-inc-title')?.value?.trim();
  const severity = document.getElementById('se-inc-severity')?.value;
  const reason   = document.getElementById('se-inc-body')?.value?.trim();
  if (!title) return showToast('Title required', true);
  try {
    const res = await fetch('/api-dev/status-event', { method: 'POST', headers: DEV_HEADERS(), body: JSON.stringify({ type: 'open', title, severity, reason }) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    showToast('Incident opened: ' + data.id);
    seRenderIncidents({ id: data.id, openedAt: Date.now(), status: 'ongoing', severity: severity || 'degraded', title, _isOngoing: true, updates: [] }, []);
    seLoad();
  } catch (err) { showToast(err.message, true); }
}

export async function seUpdateIncident() {
  const reason = document.getElementById('se-inc-body')?.value?.trim();
  if (!reason) return showToast('Message required for update', true);
  try {
    const res = await fetch('/api-dev/status-event', { method: 'POST', headers: DEV_HEADERS(), body: JSON.stringify({ type: 'update', reason }) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    showToast('Incident updated');
    seLoad();
  } catch (err) { showToast(err.message, true); }
}

export async function seResolveIncident() {
  const reason = document.getElementById('se-inc-body')?.value?.trim();
  try {
    const res = await fetch('/api-dev/status-event', { method: 'POST', headers: DEV_HEADERS(), body: JSON.stringify({ type: 'resolve', reason: reason || 'Incident resolved by dev team.' }) });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'Failed', true);
    showToast('Incident resolved ✓');
    seRenderIncidents(null, []);
    seLoad();
  } catch (err) { showToast(err.message, true); }
}