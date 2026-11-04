// statusjs/chart.js — Ping canvas chart + response time bands
// ─────────────────────────────────────────────────────────────────────────────

// ── Ping canvas chart ─────────────────────────────────────────────────────────

export function drawPingChart(pings) {
  const canvas = document.getElementById('ping-canvas');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.clientWidth || 600;
  const H   = 64;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const validPings = pings.filter(p => p > 0);

  if (!validPings.length) {
    ctx.fillStyle = 'rgba(92,102,128,0.2)';
    ctx.fillRect(0, 0, W, H);
    return;
  }

  const maxP  = Math.max(...validPings, 1);
  const minP  = Math.min(...validPings);
  const range = maxP - minP || 1;

  // Background
  ctx.fillStyle = 'rgba(25,29,41,0.6)';
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(44,51,80,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (i / 4) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  if (pings.length < 2) return;

  // Gradient fill under line
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(91,141,238,0.4)');
  grad.addColorStop(1, 'rgba(91,141,238,0.02)');

  const pts = pings.map((p, i) => ({
    x: (i / (pings.length - 1)) * W,
    y: p > 0 ? H - ((p - minP) / range) * (H - 10) - 5 : H,
  }));

  // Fill area
  ctx.beginPath();
  pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
  ctx.strokeStyle = '#5b8dee';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Current value dot
  const last     = pts[pts.length - 1];
  const lastPing = validPings[validPings.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle =
    lastPing < 100 ? '#23d160' :
    lastPing < 200 ? '#ff9f43' :
                     '#ff4d6a';
  ctx.fill();
}

// ── Response time bands ───────────────────────────────────────────────────────

export function renderResponseBands(ping) {
  const el = document.getElementById('response-bands');
  if (!el) return;

  const currentColor =
    ping < 100 ? '#23d160' :
    ping < 200 ? '#ff9f43' :
                 '#ff4d6a';

  const bands = [
    { label: 'Target',  val: '< 100ms', fill: 100, color: '#23d160' },
    {
      label:   'Current',
      val:     ping > 0 ? ping + 'ms' : '—',
      fill:    ping > 0 ? Math.min(ping / 400 * 100, 100) : 0,
      color:   currentColor,
    },
    { label: 'Thresh',  val: '400ms',   fill: 100, color: '#ff4d6a' },
  ];

  el.innerHTML = bands.map(b => `
    <div class="response-band">
      <span class="rband-title">${b.label}</span>
      <div class="rband-bar">
        <div class="rband-fill" style="width:${b.fill}%;background:${b.color};opacity:0.7"></div>
      </div>
      <span class="rband-label" style="color:${b.color}">${b.val}</span>
    </div>
  `).join('');
}