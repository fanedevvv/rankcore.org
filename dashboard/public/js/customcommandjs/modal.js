// /js/customcommandjs/modal.js
// Controls modal open/close, tab switching, and form population.

import { state }                           from './state.js';
import { TAB_HELP, TEMPLATES }             from './helpContent.js';
import { renderArgList }                   from './argBuilder.js';
import {
  refreshVarChips, onResponseInput,
  updateDescCounter, toggleEmbedFields,
  renderVariantList, renderConditionalList,
  renderActionList, renderButtonList,
  renderEmbedFieldList, renderTagPills,
  updateEmbedPreview,
} from './form.js';

// ── Create ────────────────────────────────────────────────────────────────────

export function openCreateModal() {
  // Show template picker overlay before opening the full modal
  _showTemplatePicker();
}

function _openCreateModalWithTemplate(templateData) {
  state.setEditingName(null);
  state.setArgs([]);
  state.setVariants([]);
  state.setConditionals([]);
  state.setActions([]);
  state.setButtons([]);
  state.setEmbedFields([]);

  _resetBasic();
  _resetEmbed();
  _resetRestrictions();
  _resetAdvanced();

  _setElText('modalTitle',     'New Command');
  _setElText('modalSub',       'Build a custom slash command with advanced options');
  _setElText('modalSubmitBtn', '⚡ Create Command');
  _setElText('responseCounter','0 / 2000');
  _setElText('descCounter',    '0 / 100');

  const pre = document.getElementById('responsePreview');
  if (pre) { pre.textContent = 'Your response will appear here…'; pre.style.fontStyle = 'italic'; }

  document.getElementById('inputName')?.removeAttribute('disabled');

  toggleEmbedFields();
  renderArgList();
  renderVariantList();
  renderConditionalList();
  renderActionList();
  renderButtonList();
  renderEmbedFieldList();
  renderAliasList([]);
  renderTagPills([]);
  refreshVarChips();
  switchModalTab('basic', document.querySelector('.modal-tab'));
  _show('modal');
  setTimeout(() => document.getElementById('inputName')?.focus(), 60);

  // Apply template data if provided
  if (templateData && Object.keys(templateData).length > 0) {
    _applyTemplate(templateData);
  }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

export function openEditModal(name) {
  const cmd = state.commands.find(c => c.name === name);
  if (!cmd) return;

  state.setEditingName(name);
  state.setArgs((cmd.arguments       || []).map(deepClone));
  state.setVariants((cmd.responseVariants || []).map(deepClone));
  state.setConditionals((cmd.conditionals || []).map(deepClone));
  state.setActions((cmd.actions       || []).map(deepClone));
  state.setButtons((cmd.buttons       || []).map(deepClone));
  state.setEmbedFields((cmd.embedFields || []).map(deepClone));

  // Basic
  _setField('inputName',        cmd.name);
  _setField('inputDescription', cmd.description   || '');
  _setField('inputResponse',    cmd.response      || '');
  document.getElementById('inputName')?.setAttribute('disabled', 'disabled');

  // Embed
  _setChecked('inputIsEmbed',   !!cmd.isEmbed);
  _setField('inputEmbedTitle',  cmd.embedTitle    || '');
  _setField('inputEmbedFooter', cmd.embedFooter   || '');
  _setField('inputEmbedImage',  cmd.embedImage    || '');
  _setField('inputEmbedThumbnail',   cmd.embedThumbnail    || '');
  _setField('inputEmbedAuthorName',  cmd.embedAuthorName   || '');
  _setField('inputEmbedAuthorIcon',  cmd.embedAuthorIcon   || '');
  _setField('inputEmbedUrl',         cmd.embedUrl          || '');
  _setField('inputEmbedFooterIcon',  cmd.embedFooterIcon   || '');
  _setField('inputEmbedColor',       cmd.embedColor        || '#6C53FF');
  _setField('inputEmbedColorPicker', cmd.embedColor        || '#6C53FF');

  // Behaviour
  _setChecked('inputEphemeral',      !!cmd.ephemeral);
  _setChecked('inputDmAllowed',      !!cmd.dmAllowed);
  _setChecked('inputDeleteInvoking', !!cmd.deleteInvoking);
  _setField('inputCooldown',         cmd.cooldown       || 0);
  _setField('inputGlobalCooldown',   cmd.globalCooldown || 0);
  _setVal('inputPermission',         cmd.requiredPermission || '');

  // Multi-response
  _setChecked('inputMultiResponse', !!cmd.multiResponseEnabled);
  toggleMultiResponseFields();

  // Advanced
  _setField('inputCategory', cmd.category || '');
  renderAliasList(cmd.aliases || []);
  renderTagPills(cmd.tags || []);

  // Restrictions
  _setField('inputAllowedChannels', (cmd.allowedChannels||[]).map(r => r.id).join('\n'));
  _setField('inputDeniedChannels',  (cmd.deniedChannels ||[]).map(r => r.id).join('\n'));
  _setField('inputAllowedRoles',    (cmd.allowedRoles   ||[]).map(r => r.id).join('\n'));
  _setField('inputDeniedRoles',     (cmd.deniedRoles    ||[]).map(r => r.id).join('\n'));

  _setElText('modalTitle',     'Edit Command');
  _setElText('modalSub',       `Editing /${name}`);
  _setElText('modalSubmitBtn', '💾 Save Changes');

  toggleEmbedFields();
  onResponseInput();
  updateDescCounter();
  renderArgList();
  renderVariantList();
  renderConditionalList();
  renderActionList();
  renderButtonList();
  renderEmbedFieldList();
  refreshVarChips();
  switchModalTab('basic', document.querySelector('.modal-tab'));
  _show('modal');
}

export function closeModal() { document.getElementById('modal').style.display = 'none'; }

export function openDeleteModal(name) {
  state.setPendingDel(name);
  const l = document.getElementById('deleteCommandName');
  if (l) l.textContent = `/${name}`;
  _show('deleteModal');
}

export function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  state.setPendingDel(null);
}

export function switchModalTab(name, clickedBtn) {
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-pane').forEach(p => p.classList.remove('active'));
  if (clickedBtn) clickedBtn.classList.add('active');
  document.getElementById(`pane-${name}`)?.classList.add('active');
}

// ── Multi-response visibility toggle ─────────────────────────────────────────

export function toggleMultiResponseFields() {
  const on = document.getElementById('inputMultiResponse')?.checked;
  const f  = document.getElementById('multiResponseFields');
  if (f) f.style.display = on ? 'flex' : 'none';
}

// ── Populate alias list from array ───────────────────────────────────────────

export function renderAliasList(aliases = []) {
  const container = document.getElementById('aliasList');
  if (!container) return;
  container.innerHTML = aliases.map((a, i) => `
    <div style="display:flex;gap:0.5rem;align-items:center">
      <span style="color:#a799ff;font-family:'JetBrains Mono',monospace;font-size:0.85rem">/</span>
      <input type="text" value="${esc(a)}" placeholder="alias-name" maxlength="32"
             style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;flex:1"
             oninput="updateAlias(${i},this.value)">
      <button class="btn-danger-sm" onclick="removeAlias(${i})">✕</button>
    </div>
  `).join('');
}

// ── Template picker ───────────────────────────────────────────────────────────

function _showTemplatePicker() {
  // Remove any existing picker
  document.getElementById('cc-template-picker')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cc-template-picker';
  overlay.style.cssText = `position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.72);
    backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1rem;
    animation:ccOverlayIn .18s ease both`;

  overlay.innerHTML = `
    <style>
      @keyframes ccOverlayIn{from{opacity:0}to{opacity:1}}
      @keyframes ccModalIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
      #cc-tp-modal{background:#0C0E1D;border:1px solid rgba(108,83,255,.25);border-radius:1.25rem;
        width:100%;max-width:580px;max-height:88vh;overflow-y:auto;
        box-shadow:0 24px 80px rgba(0,0,0,.7);animation:ccModalIn .22s ease both;
        font-family:'Plus Jakarta Sans',system-ui,sans-serif;}
      .cc-tp-header{padding:1.5rem 1.5rem 0;display:flex;align-items:flex-start;justify-content:space-between}
      .cc-tp-title{font-size:1.15rem;font-weight:800;color:#e4e4f0}
      .cc-tp-sub{font-size:.75rem;color:#5a5a7a;margin-top:.2rem}
      .cc-tp-x{width:28px;height:28px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
        border-radius:.4rem;cursor:pointer;display:grid;place-items:center;color:#5a5a7a;transition:all .15s;flex-shrink:0}
      .cc-tp-x:hover{color:#e4e4f0;background:rgba(255,255,255,.09)}
      .cc-tp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:.65rem;padding:1.25rem 1.5rem 1.5rem}
      .cc-tp-card{background:#111122;border:1px solid rgba(255,255,255,.06);border-radius:.75rem;
        padding:.9rem;cursor:pointer;transition:all .18s;display:flex;flex-direction:column;gap:.4rem}
      .cc-tp-card:hover{border-color:rgba(108,83,255,.35);background:rgba(108,83,255,.06);transform:translateY(-1px)}
      .cc-tp-card:active{transform:none}
      .cc-tp-icon{font-size:1.3rem;line-height:1}
      .cc-tp-name{font-size:.8rem;font-weight:700;color:#d0d0e8}
      .cc-tp-desc{font-size:.68rem;color:#4a4a6a;line-height:1.5}
    </style>
    <div id="cc-tp-modal">
      <div class="cc-tp-header">
        <div>
          <div class="cc-tp-title">Choose a Starting Point</div>
          <div class="cc-tp-sub">Pick a template or start from scratch — you can change everything after.</div>
        </div>
        <button class="cc-tp-x" id="cc-tp-close">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="cc-tp-grid">
        ${TEMPLATES.map(t => `
          <div class="cc-tp-card" data-tpl="${t.id}" style="border-color:${t.color}22">
            <div class="cc-tp-icon">${t.icon}</div>
            <div class="cc-tp-name" style="color:${t.color}">${t.name}</div>
            <div class="cc-tp-desc">${t.desc}</div>
          </div>`).join('')}
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#cc-tp-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.cc-tp-card').forEach(card => {
    card.addEventListener('click', () => {
      const tpl = TEMPLATES.find(t => t.id === card.dataset.tpl);
      overlay.remove();
      _openCreateModalWithTemplate(tpl?.data || {});
    });
  });
}

function _applyTemplate(data) {
  if (data.name)         { const el = document.getElementById('inputName');        if (el) { el.value = data.name; } }
  if (data.description)  { const el = document.getElementById('inputDescription'); if (el) el.value = data.description; }
  if (data.response)     { const el = document.getElementById('inputResponse');    if (el) el.value = data.response; }
  if (data.isEmbed)      { const el = document.getElementById('inputIsEmbed');     if (el) el.checked = true; }
  if (data.embedTitle)   { const el = document.getElementById('inputEmbedTitle');  if (el) el.value = data.embedTitle; }
  if (data.embedColor)   {
    const h = document.getElementById('inputEmbedColor'); if (h) h.value = data.embedColor;
    const p = document.getElementById('inputEmbedColorPicker'); if (p) p.value = data.embedColor;
  }
  if (data.embedFooter)  { const el = document.getElementById('inputEmbedFooter'); if (el) el.value = data.embedFooter; }
  if (data.ephemeral)    { const el = document.getElementById('inputEphemeral');   if (el) el.checked = true; }

  // Arguments
  if (data.arguments?.length) {
    state.setArgs(data.arguments.map(a => ({
      name: a.name||'', description: a.description||'', type: a.type||'STRING',
      required: a.required||false, choices: [], minValue: null, maxValue: null,
      minLength: null, maxLength: null, autocomplete: false,
    })));
    const { renderArgList } = window.__ccModules || {};
    if (typeof window.renderArgList === 'function') window.renderArgList();
  }

  // Multi-response variants
  if (data.multiResponseEnabled && data.responseVariants?.length) {
    const el = document.getElementById('inputMultiResponse');
    if (el) { el.checked = true; if (typeof window.toggleMultiResponseFields === 'function') window.toggleMultiResponseFields(); }
    state.setVariants(data.responseVariants);
    if (typeof window.renderVariantList === 'function') window.renderVariantList();
  }

  // Actions
  if (data.actions?.length) {
    state.setActions(data.actions);
    if (typeof window.renderActionList === 'function') window.renderActionList();
  }

  // Trigger live previews
  if (typeof window.onResponseInput === 'function') window.onResponseInput();
  if (typeof window.onNameInput === 'function') window.onNameInput();
  if (typeof window.toggleEmbedFields === 'function') window.toggleEmbedFields();
  if (typeof window.updateEmbedPreview === 'function') window.updateEmbedPreview();
}

// ── Help drawer ────────────────────────────────────────────────────────────────

export function showTabHelp(tabName) {
  const help = TAB_HELP[tabName];
  if (!help) return;

  document.getElementById('cc-help-drawer')?.remove();

  const drawer = document.createElement('div');
  drawer.id = 'cc-help-drawer';
  drawer.style.cssText = `position:fixed;top:0;right:0;bottom:0;z-index:10002;width:100%;max-width:360px;
    background:#0C0E1D;border-left:1px solid rgba(108,83,255,.22);
    box-shadow:-12px 0 48px rgba(0,0,0,.6);display:flex;flex-direction:column;
    font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    animation:ccDrawerIn .22s ease both`;

  const sectionsHtml = help.sections.map(s => {
    const heading = `<div style="font-size:.78rem;font-weight:700;color:#d0d0e8;margin-bottom:.4rem">${s.heading}</div>`;
    if (s.vars) {
      const rows = s.vars.map(([k,v]) => `<div style="display:flex;gap:.5rem;margin-bottom:.3rem">
        <span style="min-width:120px;font-family:'JetBrains Mono',monospace;font-size:.65rem;color:#a78bfa;flex-shrink:0">${k}</span>
        <span style="font-size:.7rem;color:#5a5a7a;line-height:1.5">${v}</span></div>`).join('');
      return `<div style="background:#111122;border:1px solid rgba(255,255,255,.05);border-radius:.65rem;padding:.85rem;margin-bottom:.65rem">
        ${heading}${rows}</div>`;
    }
    let body = `<p style="font-size:.75rem;color:#5a5a7a;line-height:1.7;margin-bottom:.3rem">${s.text}</p>`;
    if (s.example) body += `<div style="background:rgba(108,83,255,.07);border:1px solid rgba(108,83,255,.18);border-radius:.5rem;padding:.5rem .75rem;font-family:'JetBrains Mono',monospace;font-size:.65rem;color:#a78bfa">${s.example}</div>`;
    return `<div style="background:#111122;border:1px solid rgba(255,255,255,.05);border-radius:.65rem;padding:.85rem;margin-bottom:.65rem">${heading}${body}</div>`;
  }).join('');

  drawer.innerHTML = `
    <style>
      @keyframes ccDrawerIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
      @keyframes ccDrawerOut{from{transform:translateX(0)}to{transform:translateX(100%)}}
    </style>
    <div style="padding:1.25rem 1.25rem .75rem;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <div style="font-size:.85rem;font-weight:800;color:#e4e4f0">${help.icon} ${help.title}</div>
        <div style="font-size:.65rem;color:#4a4a6a;margin-top:2px">Contextual help</div>
      </div>
      <button id="cc-help-close" style="width:28px;height:28px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:.4rem;cursor:pointer;display:grid;place-items:center;color:#5a5a7a;transition:all .15s">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:1rem 1.25rem;scrollbar-width:thin;scrollbar-color:rgba(108,83,255,.2) transparent">
      ${sectionsHtml}
    </div>
    <div style="padding:.75rem 1.25rem;border-top:1px solid rgba(255,255,255,.06);font-size:.65rem;color:#2e2e48;text-align:center;flex-shrink:0">
      Press <kbd style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);padding:1px 5px;border-radius:3px;font-family:monospace">Esc</kbd> or click ✕ to close
    </div>`;

  document.body.appendChild(drawer);

  const close = () => {
    drawer.style.animation = 'ccDrawerOut .18s ease both';
    setTimeout(() => drawer.remove(), 180);
  };
  drawer.querySelector('#cc-help-close').addEventListener('click', close);

  const escHandler = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _resetBasic() {
  ['inputName','inputDescription','inputResponse'].forEach(id => _setField(id, ''));
  const hint = document.getElementById('nameHint');
  if (hint) {
    hint.style.color = 'var(--muted)';
    hint.innerHTML   = 'Lowercase, numbers, hyphens. Registers as <code style="color:#a799ff;background:rgba(108,83,255,0.1);padding:0 0.3rem;border-radius:3px">/name</code>';
  }
}

function _resetEmbed() {
  ['inputEmbedTitle','inputEmbedFooter','inputEmbedImage','inputEmbedThumbnail',
   'inputEmbedAuthorName','inputEmbedAuthorIcon','inputEmbedUrl','inputEmbedFooterIcon'].forEach(id => _setField(id, ''));
  _setField('inputEmbedColor', '#6C53FF');
  _setField('inputEmbedColorPicker', '#6C53FF');
  _setChecked('inputIsEmbed', false);
}

function _resetRestrictions() {
  ['inputAllowedChannels','inputDeniedChannels','inputAllowedRoles','inputDeniedRoles'].forEach(id => _setField(id, ''));
}

function _resetAdvanced() {
  _setChecked('inputEphemeral',      false);
  _setChecked('inputDmAllowed',      false);
  _setChecked('inputDeleteInvoking', false);
  _setChecked('inputMultiResponse',  false);
  _setField('inputCooldown',         0);
  _setField('inputGlobalCooldown',   0);
  _setField('inputCategory',         '');
  _setVal('inputPermission', '');
  toggleMultiResponseFields();
}

function _show(id)              { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function _setField(id, value)   { const el = document.getElementById(id); if (el) el.value   = value; }
function _setChecked(id, v)     { const el = document.getElementById(id); if (el) el.checked = v; }
function _setVal(id, value)     { const el = document.getElementById(id); if (el) el.value   = value; }
function _setElText(id, text)   { const el = document.getElementById(id); if (el) el.textContent = text; }
function deepClone(o)           { return JSON.parse(JSON.stringify(o)); }
function esc(s)                 { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }