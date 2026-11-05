/* ============================================================
   RANKCORE DASHBOARD — Shared JS v3.1 (native styled selects, no rzrSelect)
   ============================================================ */

/* ── Toast ─────────────────────────────────────────────────── */
const NX = window.NX = {
  _toastTimer: null,

  toast(msg, type, duration) {
    type = type || 'success'; duration = duration || 3500;
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    const icons = {
      success: '<svg width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
      error:   '<svg width="16" height="16" fill="none" stroke="#f87171" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      info:    '<svg width="16" height="16" fill="none" stroke="#60a5fa" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      warn:    '<svg width="16" height="16" fill="none" stroke="#fbbf24" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    };
    el.className = type + ' show';
    el.innerHTML = (icons[type] || icons.info) + '<span>' + msg + '</span>';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function(){ el.classList.remove('show'); }, duration);
  },

  _dirty: false,
  markDirty: function() {
    this._dirty = true;
    document.querySelectorAll('.unsaved-dot').forEach(function(d){ d.classList.add('on','visible'); });
  },
  markClean: function() {
    this._dirty = false;
    document.querySelectorAll('.unsaved-dot').forEach(function(d){ d.classList.remove('on','visible'); });
  },

  charCount: function(inputId, counterId, max) {
    var el = document.getElementById(inputId), out = document.getElementById(counterId);
    if (!el || !out) return;
    var n = el.value.length;
    out.textContent = n + ' / ' + max;
    out.className = 'char-count' + (n >= max ? ' over' : n > max * .85 ? ' warn' : '');
  },

  insertTag: function(inputId, tag) {
    var el = document.getElementById(inputId);
    if (!el) return;
    var s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0,s) + tag + el.value.slice(e);
    el.focus(); el.selectionStart = el.selectionEnd = s + tag.length;
    NX.markDirty();
    el.dispatchEvent(new Event('input',{bubbles:true}));
  },

  parseMarkdown: function(t) {
    if (!t) return '';
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,'<em>$1</em>')
      .replace(/__(.*?)__/g,'<u>$1</u>')
      .replace(/`([^`]+)`/g,'<code style="background:rgba(0,0,0,.4);padding:1px 5px;border-radius:4px;font-family:var(--font-m);font-size:.8em">$1</code>')
      .replace(/\n/g,'<br>');
  },

  populateChannels: function(sel, channels, value, placeholder) {
    if (!sel) return;
    var prev = value !== undefined ? value : sel.value;
    var ph = placeholder !== undefined ? placeholder : '— Select Channel —';
    sel.innerHTML = ph ? '<option value="">' + ph + '</option>' : '';
    (channels || []).forEach(function(ch) {
      var opt = document.createElement('option');
      opt.value = ch.id; opt.textContent = '#' + ch.name;
      if (ch.id === prev) opt.selected = true;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  },

  populateRoles: function(sel, roles, value, placeholder) {
    if (!sel) return;
    var prev = value !== undefined ? value : sel.value;
    var ph = placeholder !== undefined ? placeholder : '— Select Role —';
    sel.innerHTML = ph ? '<option value="">' + ph + '</option>' : '';
    (roles || []).forEach(function(r) {
      var opt = document.createElement('option');
      opt.value = r.id; opt.textContent = '@' + r.name;
      if (r.id === prev) opt.selected = true;
      sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
  },

  esc: function(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  },
};

/* ── Global aliases ─────────────────────────────────────────── */
window.showToast = function(msg, type){ NX.toast(msg, type || 'success'); };
window.rzrPopulateChannels = function(sel, channels, value, placeholder){ NX.populateChannels(sel, channels, value, placeholder); };
window.rzrPopulateRoles    = function(sel, roles, value, placeholder){ NX.populateRoles(sel, roles, value, placeholder); };

/* ── Auto dirty-track ───────────────────────────────────────── */
document.addEventListener('input', function(e){
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) NX.markDirty();
});
document.addEventListener('change', function(e){
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) NX.markDirty();
});
window.addEventListener('beforeunload', function(e){
  if(NX._dirty){ e.preventDefault(); e.returnValue=''; }
});
