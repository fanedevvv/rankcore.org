// devjs/display.js — Display panel (background orbs, grid, scanlines, presets)

import { showToast } from './ui.js';

const DISP_DEFAULTS = {
  grid: true, orbs: true, scan: true, anim: true,
  orb1: '#ef4444', orb2: '#6366f1', orb3: '#22d3ee',
  orbOpacity: 25, orbBlur: 90, gridOpacity: 4, gridSize: 28, animSpeed: 18,
};

const DISP_PRESETS = {
  default: { orb1:'#ef4444', orb2:'#6366f1', orb3:'#22d3ee', orbOpacity:25, orbBlur:90,  grid:true, orbs:true, scan:true,  anim:true  },
  fire:    { orb1:'#ef4444', orb2:'#f97316', orb3:'#facc15', orbOpacity:32, orbBlur:100, grid:true, orbs:true, scan:true,  anim:true  },
  ocean:   { orb1:'#06b6d4', orb2:'#3b82f6', orb3:'#6366f1', orbOpacity:28, orbBlur:110, grid:true, orbs:true, scan:false, anim:true  },
  rose:    { orb1:'#f43f5e', orb2:'#ec4899', orb3:'#a855f7', orbOpacity:30, orbBlur:95,  grid:true, orbs:true, scan:true,  anim:true  },
  mono:    { orb1:'#64748b', orb2:'#475569', orb3:'#334155', orbOpacity:20, orbBlur:80,  grid:true, orbs:true, scan:true,  anim:false },
  off:     { orb1:'#111827', orb2:'#111827', orb3:'#111827', orbOpacity:0,  orbBlur:0,   grid:false,orbs:false,scan:false, anim:false },
};

function dispRead() {
  return {
    grid:        document.getElementById('tog-grid').checked,
    orbs:        document.getElementById('tog-orbs').checked,
    scan:        document.getElementById('tog-scan').checked,
    anim:        document.getElementById('tog-anim').checked,
    orb1:        document.getElementById('col-orb1').value,
    orb2:        document.getElementById('col-orb2').value,
    orb3:        document.getElementById('col-orb3').value,
    orbOpacity:  +document.getElementById('sld-orb-opacity').value,
    orbBlur:     +document.getElementById('sld-orb-blur').value,
    gridOpacity: +document.getElementById('sld-grid-opacity').value,
    gridSize:    +document.getElementById('sld-grid-size').value,
    animSpeed:   +document.getElementById('sld-anim-speed').value,
  };
}

function dispWrite(s) {
  document.getElementById('tog-grid').checked   = s.grid    ?? true;
  document.getElementById('tog-orbs').checked   = s.orbs    ?? true;
  document.getElementById('tog-scan').checked   = s.scan    ?? true;
  document.getElementById('tog-anim').checked   = s.anim    ?? true;
  document.getElementById('col-orb1').value     = s.orb1    ?? '#ef4444';
  document.getElementById('col-orb2').value     = s.orb2    ?? '#6366f1';
  document.getElementById('col-orb3').value     = s.orb3    ?? '#22d3ee';
  ['orb-opacity','orb-blur','grid-opacity','grid-size','anim-speed'].forEach((k, i) => {
    const vals = [s.orbOpacity??25, s.orbBlur??90, s.gridOpacity??4, s.gridSize??28, s.animSpeed??18];
    document.getElementById('sld-'+k).value = vals[i];
    dispSlidUpdate(k);
  });
}

export function dispSlidUpdate(key) {
  const el  = document.getElementById('sld-'+key);
  const out = document.getElementById('val-'+key);
  if (!el || !out) return;
  const v = el.value;
  const labels = { 'orb-opacity': v+'%', 'orb-blur': v+'px', 'grid-opacity': v+'%', 'grid-size': v+'px', 'anim-speed': v+'s' };
  out.textContent = labels[key] || v;
}

let _dynStyle = null;
function dispInjectDynCSS(s) {
  if (!_dynStyle) {
    _dynStyle = document.createElement('style');
    _dynStyle.id = 'disp-dyn';
    document.head.appendChild(_dynStyle);
  }
  _dynStyle.textContent = `
    body:not(.disp-no-grid) .bg-canvas::before {
      background-size: ${s.gridSize}px ${s.gridSize}px !important;
      background-image: radial-gradient(circle, rgba(255,255,255,${(s.gridOpacity/100).toFixed(3)}) 1px, transparent 1px) !important;
    }
    body.disp-no-grid .bg-canvas::before { opacity: 0 !important; }
    body.disp-no-scan .bg-canvas::after  { opacity: 0 !important; }
    body.disp-no-orbs .orb              { opacity: 0 !important; }
    body.disp-no-anim .orb              { animation-play-state: paused !important; }
  `;
}

export function dispApply() {
  const s = dispRead();
  document.body.classList.toggle('disp-no-grid', !s.grid);
  document.body.classList.toggle('disp-no-orbs', !s.orbs);
  document.body.classList.toggle('disp-no-scan', !s.scan);
  document.body.classList.toggle('disp-no-anim', !s.anim);

  const orb1El = document.querySelector('.orb-1');
  const orb2El = document.querySelector('.orb-2');
  const orb3El = document.querySelector('.orb-3');
  if (orb1El) orb1El.style.background = `radial-gradient(circle, ${s.orb1}, transparent 70%)`;
  if (orb2El) orb2El.style.background = `radial-gradient(circle, ${s.orb2}, transparent 70%)`;
  if (orb3El) orb3El.style.background = `radial-gradient(circle, ${s.orb3}, transparent 70%)`;

  document.querySelectorAll('.orb').forEach(o => {
    o.style.opacity = (s.orbOpacity / 100).toFixed(2);
    o.style.filter  = `blur(${s.orbBlur}px)`;
    o.style.animationDuration = s.anim ? s.animSpeed + 's' : '0s';
  });

  dispInjectDynCSS(s);

  // Mini preview
  const pg  = document.getElementById('disp-prev-grid');
  const po1 = document.getElementById('disp-prev-orb1');
  const po2 = document.getElementById('disp-prev-orb2');
  const po3 = document.getElementById('disp-prev-orb3');
  const psl = document.getElementById('disp-prev-scanlines');
  if (pg)  pg.style.opacity  = s.grid ? (s.gridOpacity / 100 * 1.5) : '0';
  if (po1) { po1.style.opacity = s.orbs ? (s.orbOpacity/100)     : '0'; po1.style.background = `radial-gradient(circle,${s.orb1},transparent 70%)`; }
  if (po2) { po2.style.opacity = s.orbs ? (s.orbOpacity/100*0.9) : '0'; po2.style.background = `radial-gradient(circle,${s.orb2},transparent 70%)`; }
  if (po3) { po3.style.opacity = s.orbs ? (s.orbOpacity/100*0.7) : '0'; po3.style.background = `radial-gradient(circle,${s.orb3},transparent 70%)`; }
  if (psl) psl.style.opacity  = s.scan ? '1' : '0';

  ['1','2','3'].forEach(n => {
    const col = document.getElementById('col-orb'+n)?.value;
    const pc  = document.getElementById('disp-prev-c'+n);
    const sw  = document.getElementById('swatch-'+n);
    if (pc && col) pc.style.background = col;
    if (sw && col) { sw.style.background = col; sw.style.boxShadow = `0 0 12px ${col}66`; }
  });

  const lbl = document.getElementById('disp-prev-label');
  if (lbl) lbl.textContent = (!s.orbs && !s.grid && !s.scan) ? 'Minimal' : s.anim ? 'Animated' : 'Static';
}

export function dispPreset(name) {
  const p = DISP_PRESETS[name];
  if (!p) return;
  dispWrite({ ...DISP_DEFAULTS, ...p });
  dispApply();
  showToast('Preset applied: ' + name.charAt(0).toUpperCase() + name.slice(1));
}

export function dispResetColors() {
  document.getElementById('col-orb1').value = DISP_DEFAULTS.orb1;
  document.getElementById('col-orb2').value = DISP_DEFAULTS.orb2;
  document.getElementById('col-orb3').value = DISP_DEFAULTS.orb3;
  dispApply();
}

export function dispSave() {
  try {
    localStorage.setItem('devDisplaySettings', JSON.stringify(dispRead()));
    showToast('Display settings saved');
  } catch { showToast('Failed to save', true); }
}

export function dispLoad() {
  try {
    const raw = localStorage.getItem('devDisplaySettings');
    if (!raw) return showToast('No saved settings found', true);
    dispWrite(JSON.parse(raw));
    dispApply();
    showToast('Settings loaded');
  } catch { showToast('Failed to load', true); }
}

// Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  dispWrite(DISP_DEFAULTS);
  ['1','2','3'].forEach(n => {
    const sw = document.getElementById('swatch-'+n);
    const col = document.getElementById('col-orb'+n);
    if (sw && col) { sw.style.background = col.value; sw.style.boxShadow = `0 0 12px ${col.value}66`; }
  });
  try {
    const raw = localStorage.getItem('devDisplaySettings');
    if (raw) { dispWrite(JSON.parse(raw)); dispApply(); }
  } catch {}
});