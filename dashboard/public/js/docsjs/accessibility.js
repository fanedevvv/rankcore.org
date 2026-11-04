// docsjs/accessibility.js — Accessibility panel (font size, contrast, dyslexia, motion)
// ─────────────────────────────────────────────────────────────────────────────
import { state, saveA11y } from './state.js';

const FONT_SIZES = {
  small:  { base: '14px', label: 'Small'   },
  normal: { base: '16px', label: 'Default' },
  large:  { base: '18px', label: 'Large'   },
  xlarge: { base: '21px', label: 'X-Large' },
};

// Apply all current a11y settings to the document
export function applyA11y() {
  const { fontSize, contrast, dyslexia, reduceMotion, lineSpacing } = state.a11y;
  const root = document.documentElement;

  // Font size
  root.style.fontSize = FONT_SIZES[fontSize]?.base || '16px';

  // Contrast / theme
  root.classList.remove('a11y-high-contrast', 'a11y-dark-high');
  if (contrast === 'high')      root.classList.add('a11y-high-contrast');
  if (contrast === 'dark-high') root.classList.add('a11y-dark-high');

  // Dyslexia font
  root.classList.toggle('a11y-dyslexia', dyslexia);

  // Reduce motion
  root.classList.toggle('reduce-motion', reduceMotion);

  // Line spacing
  root.classList.remove('spacing-relaxed', 'spacing-loose');
  if (lineSpacing === 'relaxed') root.classList.add('spacing-relaxed');
  if (lineSpacing === 'loose')   root.classList.add('spacing-loose');
}

// Inject the a11y CSS variables and overrides
export function injectA11yCSS() {
  if (document.getElementById('docs-a11y-css')) return;
  const s = document.createElement('style');
  s.id = 'docs-a11y-css';
  s.textContent = `
    /* ── High contrast ── */
    .a11y-high-contrast {
      --text: #ffffff !important;
      --dim:  #ccccdd !important;
      --muted:#9999bb !important;
      --border: rgba(255,255,255,.2) !important;
      --border2:rgba(255,255,255,.35) !important;
      --bg1: #0a0a18 !important;
      --bg2: #0e0e20 !important;
    }
    .a11y-high-contrast .cat-card,
    .a11y-high-contrast .card-block,
    .a11y-high-contrast .cmd-item { border-width:2px !important; }

    /* ── Dark high contrast ── */
    .a11y-dark-high {
      --text: #ffff00 !important;
      --dim:  #ffffff !important;
      --muted:#dddddd !important;
      --bg:   #000000 !important;
      --bg1:  #050505 !important;
      --bg2:  #0a0a0a !important;
      --bg3:  #0f0f0f !important;
      --border: rgba(255,255,0,.3) !important;
    }

    /* ── Dyslexia font ── */
    @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap');
    .a11y-dyslexia, .a11y-dyslexia * {
      font-family: 'Lexend', sans-serif !important;
      letter-spacing: .03em !important;
      word-spacing: .12em !important;
    }
    .a11y-dyslexia code, .a11y-dyslexia .cmd-name, .a11y-dyslexia .var-chip code {
      font-family: var(--mono) !important;
    }

    /* ── Line spacing ── */
    .spacing-relaxed .prose p,
    .spacing-relaxed .prose li,
    .spacing-relaxed .cmd-desc { line-height: 2 !important; }
    .spacing-loose .prose p,
    .spacing-loose .prose li,
    .spacing-loose .cmd-desc   { line-height: 2.4 !important; }

    /* ── A11y panel ── */
    #a11y-panel {
      position:fixed; bottom:5rem; right:1.25rem; z-index:500;
      background:var(--bg1); border:1px solid var(--border2);
      border-radius:1rem; width:280px; box-shadow:0 16px 48px rgba(0,0,0,.6);
      overflow:hidden; display:none;
      font-family:var(--font);
    }
    #a11y-panel.open { display:block; animation:a11yIn .2s cubic-bezier(.22,1,.36,1) both }
    @keyframes a11yIn { from{opacity:0;transform:translateY(10px) scale(.97)} to{opacity:1;transform:none} }
    .a11y-header {
      padding:.85rem 1rem; background:var(--bg2); border-bottom:1px solid var(--border);
      display:flex; align-items:center; justify-content:space-between;
    }
    .a11y-title { font-size:.78rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:.45rem }
    .a11y-close { background:none; border:none; color:var(--muted); cursor:pointer; padding:4px; border-radius:.35rem; transition:color .15s; display:grid; place-items:center }
    .a11y-close:hover { color:var(--text) }
    .a11y-body { padding:.85rem 1rem; display:flex; flex-direction:column; gap:.85rem }
    .a11y-group-label { font-size:.58rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:.4rem }
    .a11y-btn-row { display:flex; gap:.4rem; flex-wrap:wrap }
    .a11y-btn {
      font-size:.68rem; font-weight:700; padding:.32rem .65rem; border-radius:.4rem;
      border:1px solid var(--border); background:var(--bg2); color:var(--dim);
      cursor:pointer; transition:all .15s; font-family:var(--font);
    }
    .a11y-btn:hover  { color:var(--text); border-color:var(--border2) }
    .a11y-btn.active { background:rgba(108,83,255,.15); border-color:rgba(108,83,255,.35); color:var(--brand2) }
    .a11y-toggle { display:flex; align-items:center; justify-content:space-between }
    .a11y-toggle-label { font-size:.74rem; font-weight:600; color:var(--text) }
    .a11y-toggle-sub { font-size:.64rem; color:var(--muted); margin-top:1px }
    .a11y-switch { position:relative; width:38px; height:20px; flex-shrink:0 }
    .a11y-switch input { opacity:0; width:0; height:0 }
    .a11y-track {
      position:absolute; inset:0; background:var(--bg3); border-radius:99px;
      border:1px solid var(--border); cursor:pointer; transition:all .2s;
    }
    .a11y-track::after { content:''; position:absolute; left:2px; top:2px; width:14px; height:14px; border-radius:50%; background:var(--muted); transition:all .2s }
    .a11y-switch input:checked + .a11y-track { background:var(--brand); border-color:var(--brand) }
    .a11y-switch input:checked + .a11y-track::after { transform:translateX(18px); background:#fff }
    .a11y-reset { width:100%; padding:.4rem; border-radius:.5rem; background:none; border:1px solid var(--border); color:var(--muted); font-size:.68rem; font-weight:600; cursor:pointer; transition:all .15s; font-family:var(--font); margin-top:.25rem }
    .a11y-reset:hover { color:var(--red); border-color:rgba(248,113,113,.3) }

    /* ── FAB trigger ── */
    #a11y-fab {
      position:fixed; bottom:1.25rem; right:1.25rem; z-index:500;
      width:44px; height:44px; border-radius:50%;
      background:var(--bg2); border:1px solid var(--border2);
      cursor:pointer; display:grid; place-items:center; color:var(--dim);
      box-shadow:0 4px 16px rgba(0,0,0,.4); transition:all .18s;
    }
    #a11y-fab:hover { color:var(--text); border-color:rgba(108,83,255,.4); background:var(--bg3); transform:scale(1.05) }
    #a11y-fab.active { background:rgba(108,83,255,.15); border-color:rgba(108,83,255,.4); color:var(--brand2) }
  `;
  document.head.appendChild(s);
}

export function buildA11yPanel() {
  const existing = document.getElementById('a11y-fab');
  if (existing) return;

  injectA11yCSS();

  // FAB button
  const fab = document.createElement('button');
  fab.id = 'a11y-fab';
  fab.setAttribute('aria-label', 'Accessibility options');
  fab.setAttribute('title', 'Accessibility options');
  fab.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`;
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'a11y-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Accessibility settings');
  panel.innerHTML = `
    <div class="a11y-header">
      <div class="a11y-title">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        Accessibility
      </div>
      <button class="a11y-close" id="a11y-close-btn" aria-label="Close">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="a11y-body">

      <!-- Font size -->
      <div>
        <div class="a11y-group-label">Text size</div>
        <div class="a11y-btn-row" id="a11y-font-btns">
          ${Object.entries(FONT_SIZES).map(([k,v]) =>
            `<button class="a11y-btn ${state.a11y.fontSize===k?'active':''}" data-font="${k}">${v.label}</button>`
          ).join('')}
        </div>
      </div>

      <!-- Contrast -->
      <div>
        <div class="a11y-group-label">Contrast</div>
        <div class="a11y-btn-row" id="a11y-contrast-btns">
          <button class="a11y-btn ${state.a11y.contrast==='normal'?'active':''}" data-contrast="normal">Default</button>
          <button class="a11y-btn ${state.a11y.contrast==='high'?'active':''}" data-contrast="high">High</button>
          <button class="a11y-btn ${state.a11y.contrast==='dark-high'?'active':''}" data-contrast="dark-high">Yellow/Black</button>
        </div>
      </div>

      <!-- Line spacing -->
      <div>
        <div class="a11y-group-label">Line spacing</div>
        <div class="a11y-btn-row" id="a11y-spacing-btns">
          <button class="a11y-btn ${state.a11y.lineSpacing==='normal'?'active':''}" data-spacing="normal">Normal</button>
          <button class="a11y-btn ${state.a11y.lineSpacing==='relaxed'?'active':''}" data-spacing="relaxed">Relaxed</button>
          <button class="a11y-btn ${state.a11y.lineSpacing==='loose'?'active':''}" data-spacing="loose">Loose</button>
        </div>
      </div>

      <!-- Dyslexia font toggle -->
      <label class="a11y-toggle">
        <div>
          <div class="a11y-toggle-label">Dyslexia-friendly font</div>
          <div class="a11y-toggle-sub">Uses Lexend typeface</div>
        </div>
        <div class="a11y-switch">
          <input type="checkbox" id="a11y-dyslexia-chk" ${state.a11y.dyslexia?'checked':''}>
          <label class="a11y-track" for="a11y-dyslexia-chk"></label>
        </div>
      </label>

      <!-- Reduce motion toggle -->
      <label class="a11y-toggle">
        <div>
          <div class="a11y-toggle-label">Reduce motion</div>
          <div class="a11y-toggle-sub">Disables animations</div>
        </div>
        <div class="a11y-switch">
          <input type="checkbox" id="a11y-motion-chk" ${state.a11y.reduceMotion?'checked':''}>
          <label class="a11y-track" for="a11y-motion-chk"></label>
        </div>
      </label>

      <button class="a11y-reset" id="a11y-reset-btn">Reset to defaults</button>
    </div>`;
  document.body.appendChild(panel);

  // ── Wire events ─────────────────────────────────────────────────────────────
  fab.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    fab.classList.toggle('active', open);
    if (open) panel.querySelector('#a11y-close-btn').focus();
  });

  panel.querySelector('#a11y-close-btn').addEventListener('click', () => {
    panel.classList.remove('open'); fab.classList.remove('active');
  });

  panel.querySelectorAll('[data-font]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.a11y.fontSize = btn.dataset.font;
      panel.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('active', b===btn));
      applyA11y(); saveA11y();
    });
  });

  panel.querySelectorAll('[data-contrast]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.a11y.contrast = btn.dataset.contrast;
      panel.querySelectorAll('[data-contrast]').forEach(b => b.classList.toggle('active', b===btn));
      applyA11y(); saveA11y();
    });
  });

  panel.querySelectorAll('[data-spacing]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.a11y.lineSpacing = btn.dataset.spacing;
      panel.querySelectorAll('[data-spacing]').forEach(b => b.classList.toggle('active', b===btn));
      applyA11y(); saveA11y();
    });
  });

  panel.querySelector('#a11y-dyslexia-chk').addEventListener('change', e => {
    state.a11y.dyslexia = e.target.checked;
    applyA11y(); saveA11y();
  });

  panel.querySelector('#a11y-motion-chk').addEventListener('change', e => {
    state.a11y.reduceMotion = e.target.checked;
    applyA11y(); saveA11y();
  });

  panel.querySelector('#a11y-reset-btn').addEventListener('click', () => {
    Object.assign(state.a11y, { fontSize:'normal', contrast:'normal', dyslexia:false, reduceMotion:false, lineSpacing:'normal' });
    applyA11y(); saveA11y();
    panel.remove(); fab.remove();
    buildA11yPanel(); // rebuild with defaults
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!panel.contains(e.target) && !fab.contains(e.target)) {
      panel.classList.remove('open'); fab.classList.remove('active');
    }
  });

  // Respect OS reduce-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.a11y.reduceMotion = true;
    applyA11y();
  }
}