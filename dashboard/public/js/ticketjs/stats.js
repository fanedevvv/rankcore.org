'use strict';

export async function loadStats(guildId) {
  try {
    const res  = await fetch(`/api/guild/${guildId}/ticket/stats`);
    const data = await res.json();

    setText('stat-open',    data.openCount ?? 0);
    setText('stat-closed',  data.closedToday ?? 0);
    setText('stat-total',   data.totalAll ?? 0);
    setText('stat-rating',  data.avgRating != null ? `${data.avgRating} ⭐` : 'N/A');
    setText('stat-ratings-count', data.ratingCount ? `from ${data.ratingCount} rating${data.ratingCount !== 1 ? 's' : ''}` : '');

    renderMiniChart(data.daily || []);
  } catch (e) { console.error('loadStats:', e); }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderMiniChart(daily) {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas || !daily.length) return;

  // Draw at the screen's pixel density so bars and labels stay sharp on phones
  const dpr  = window.devicePixelRatio || 1;
  const w    = canvas.offsetWidth  || 400;
  const h    = canvas.offsetHeight || 110;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const labelH = 18;                  // day names live below the bars, never on them
  const valueH = 14;                  // room for the count above the tallest bar
  const plotH  = h - labelH - valueH;
  const max    = Math.max(...daily.map(d => d.count), 1);
  const slot   = w / daily.length;
  const barW   = Math.min(28, slot * 0.55);
  const font   = '600 11px "Plus Jakarta Sans", sans-serif';

  // baseline
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, valueH + plotH, w, 1);

  daily.forEach((d, i) => {
    const cx   = slot * i + slot / 2;
    const x    = cx - barW / 2;
    const barH = d.count ? Math.max(6, Math.round((d.count / max) * plotH)) : 3;
    const y    = valueH + plotH - barH;

    if (d.count) {
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, '#8B5CF6');
      grad.addColorStop(1, 'rgba(139,92,246,0.35)');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';   // empty day: faint stub, not a red bar
    }
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, Math.min(4, barH / 2));
    ctx.fill();

    ctx.font = font;
    ctx.textAlign = 'center';
    if (d.count) {
      ctx.fillStyle = '#e5e7eb';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(d.count), cx, y - 3);
    }
    const isToday = i === daily.length - 1;
    ctx.fillStyle = isToday ? '#d1d5db' : '#6b7280';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(new Date(d.date).toLocaleDateString('en', { weekday: 'short' }), cx, h - 4);
  });
}
