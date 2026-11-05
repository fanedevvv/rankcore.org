// devjs/ui.js — Toast, nav indicator, tab switching, extended stats updater

export function showToast(msg, err) {
  var t = document.getElementById('toast');
  if (!t) return;
  var safe = String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  t.innerHTML = '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' +
    (err ? '#f87171' : '#ef4444') + '"></span>' + safe;
  t.style.cssText = 'position:fixed;bottom:24px;right:20px;padding:12px 18px;' +
    'border-radius:10px;font-size:0.78rem;font-weight:700;display:flex;align-items:center;' +
    'gap:8px;z-index:9999;transition:all 0.4s;text-transform:uppercase;letter-spacing:0.04em;' +
    'background:' + (err ? '#0F132B' : '#0e2c12') + ';' +
    'color:' + (err ? '#f87171' : '#ef4444') + ';' +
    'border:1px solid ' + (err ? 'rgba(248,113,113,0.3)' : 'rgba(239,68,68,0.3)') + ';' +
    'transform:translateY(0);opacity:1';
  clearTimeout(t._timer);
  t._timer = setTimeout(function() {
    t.style.transform = 'translateY(80px)';
    t.style.opacity   = '0';
  }, 3000);
}

export function setReason(fieldId, text) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.value = text;
  el.focus();
  el.style.transition = 'border-color 0s';
  el.style.borderColor = 'rgba(248,113,113,0.6)';
  setTimeout(() => { el.style.transition = 'border-color 0.4s'; el.style.borderColor = ''; }, 120);
}

export function updateIndicator(el) {
  const inner = document.getElementById('navInner'), ind = document.getElementById('navIndicator');
  if (!el || !inner || !ind) return;
  const iR = inner.getBoundingClientRect(), eR = el.getBoundingClientRect();
  ind.style.left  = (eR.left - iR.left + inner.scrollLeft) + 'px';
  ind.style.width = eR.width + 'px';
}

export function switchMainTab(name, el) {
  document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name)?.classList.add('active');
  el.classList.add('active');
  updateIndicator(el);
  el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  if (name === 'granular') {
    window._granularStartPolling?.();
  } else {
    window._granularStopPolling?.();
  }
}

export function switchTab(group, tab, el) {
  const container = el.closest('.card') || el.closest('.section');
  if (container) {
    container.querySelectorAll('.subtab-content').forEach(t => t.classList.remove('active'));
    container.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
  }
  el.classList.add('active');
  document.getElementById(group + '-tab-' + tab)?.classList.add('active');
}

// Called by overview panel to populate VPS + bot stat cards
export function updateExtendedStats(s, b) {
  b = b || {};
  const sys  = s.system  || {};
  const proc = s.process || {};
  const mem  = s.memory  || {};
  const disk = s.disk    || {};
  const cpu  = s.cpu     || {};
  const bot  = s.bot     || {};
  function set(id, val) { const e = document.getElementById(id); if (e && val != null && val !== '') e.textContent = val; }

  const platStr   = sys.platform || '';
  const archMatch = platStr.match(/\b(x64|x86_64|arm64|arm|ia32)\b/i);
  set('vps-platform',   archMatch ? platStr.replace(archMatch[0], '').trim() || platStr : platStr);
  set('vps-arch',       archMatch ? archMatch[0] : '—');
  set('vps-cpus',       cpu.cores  != null ? cpu.cores + ' cores' : '—');
  set('vps-total-ram',  mem.total  || '—');
  set('vps-free-ram',   mem.usagePercent != null ? (100 - mem.usagePercent) + '% available' : '—');
  set('vps-load',       cpu.load   != null ? String(cpu.load) : '—');
  set('vps-disk-total', disk.total || '—');
  set('vps-uptime',     sys.uptime || '—');
  set('bot-node',       sys.nodeVersion || '—');
  set('bot-pid',        proc.pid  != null ? String(proc.pid) : '—');
  set('bot-uptime',     proc.uptime || '—');
  set('bot-heap',       proc.memory || '—');
  set('bot-external',   '—');
  const guilds = b.guilds   != null ? b.guilds   : (bot.guilds != null ? bot.guilds : null);
  const users  = b.users    != null ? b.users    : null;
  const cmds   = b.commands != null ? b.commands : null;
  set('bot-guilds',     guilds != null ? String(guilds) : '—');
  set('bot-users',      users  != null ? String(users)  : '—');
  set('bot-commands',   cmds   != null ? String(cmds)   : '—');
  if (guilds != null) set('totalGuilds', String(guilds));
  set('platform', sys.platform || '—');
}