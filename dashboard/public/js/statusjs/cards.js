// statusjs/cards.js — Expandable service cards, badges, ping pill
// ─────────────────────────────────────────────────────────────────────────────

// ── Expand / collapse ─────────────────────────────────────────────────────────

export function toggleCard(id) {
  const body  = document.getElementById(id);
  const ebId  = id === 'bb' ? 'eb-bot' : 'eb-dash';
  const btn   = document.getElementById(ebId);
  if (!body) return;

  const open = body.classList.toggle('open');
  if (btn) btn.textContent = open ? 'Collapse ↑' : 'Expand ↓';
}

// ── Status badge ──────────────────────────────────────────────────────────────

export function setCardBadge(bgId, status) {
  const el = document.getElementById(bgId);
  if (!el) return;

  el.className =
    'badge ' + (
      status === 'operational' ? 'b-op' :
      status === 'degraded'    ? 'b-deg' :
                                 'b-str'
    );
  el.textContent =
    status === 'operational' ? 'Operational' :
    status === 'degraded'    ? 'Degraded'    :
                               'Starting';
}

// ── Ping pill inside bot card ─────────────────────────────────────────────────

export function renderPingPill(ping) {
  const wrap = document.getElementById('ping-pill-wrap');
  if (!wrap || ping <= 0) return;

  const cls = ping < 100 ? 'good' : ping < 250 ? 'ok' : 'bad';
  wrap.innerHTML = ` <span class="ping-pill ${cls}">${ping}ms</span>`;

  const nowEl = document.getElementById('ping-now-val');
  if (nowEl) {
    nowEl.textContent = ping + 'ms';
    nowEl.className   = 'ping-now ping-' + cls;
  }
}