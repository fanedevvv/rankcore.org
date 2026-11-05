// /js/customcommandjs/form.js
// Handles all form input events, live previews, variable chips, and complex sub-builders.

import { state, MAX_VARIANTS, MAX_CONDS, MAX_ACTIONS, MAX_BUTTONS, MAX_EMBED_FIELDS, COND_OPS, ACTION_TYPES, BUTTON_STYLES } from './state.js';
import { esc } from './utils.js';

// ── Name input ────────────────────────────────────────────────────────────────

export function onNameInput() {
  const val  = document.getElementById('inputName')?.value || '';
  const hint = document.getElementById('nameHint');
  if (!hint) return;
  const valid = /^[a-z][a-z0-9-]{0,31}$/.test(val);
  const taken = !state.editingName && state.commands.some(c => c.name === val);
  if (!val) {
    hint.style.color = 'var(--muted)';
    hint.innerHTML   = 'Lowercase, numbers, hyphens. Registers as <code style="color:#a799ff;background:rgba(108,83,255,0.1);padding:0 0.3rem;border-radius:3px">/name</code>';
  } else if (taken) {
    hint.style.color = 'var(--danger)';
    hint.textContent = '⚠ A command with this name already exists.';
  } else if (!valid) {
    hint.style.color = 'var(--warning)';
    hint.textContent = '⚠ Must start with a letter; lowercase, numbers, hyphens only (max 32).';
  } else {
    hint.style.color = 'var(--success)';
    hint.textContent = `✓ Will register as /${val}`;
  }
}

// ── Response textarea ─────────────────────────────────────────────────────────

export function onResponseInput() {
  const val = document.getElementById('inputResponse')?.value || '';
  const ctr = document.getElementById('responseCounter');
  const pre = document.getElementById('responsePreview');
  if (ctr) {
    ctr.textContent = `${val.length} / 2000`;
    ctr.className   = val.length > 2000 ? 'cc over' : val.length > 1800 ? 'cc warn' : 'cc';
  }
  if (pre) {
    if (val.trim()) {
      pre.textContent    = val;
      pre.style.color    = '#e8e8f5';
      pre.style.fontStyle = 'normal';
    } else {
      pre.textContent    = 'Your response will appear here…';
      pre.style.color    = 'var(--muted)';
      pre.style.fontStyle = 'italic';
    }
  }
  updateEmbedPreview();
}

export function updateDescCounter() {
  const v = document.getElementById('inputDescription')?.value || '';
  const c = document.getElementById('descCounter');
  if (c) { c.textContent = `${v.length} / 100`; c.className = v.length > 90 ? 'cc warn' : 'cc'; }
}

// ── Embed ─────────────────────────────────────────────────────────────────────

export function toggleEmbedFields() {
  const on = document.getElementById('inputIsEmbed')?.checked;
  const f  = document.getElementById('embedFields');
  if (f) f.style.display = on ? 'flex' : 'none';
  if (on) updateEmbedPreview();
}

export function updateEmbedPreview() {
  const title  = document.getElementById('inputEmbedTitle')?.value  || '';
  const footer = document.getElementById('inputEmbedFooter')?.value || '';
  const author = document.getElementById('inputEmbedAuthorName')?.value || '';
  const desc   = document.getElementById('inputResponse')?.value    || '';
  const color  = document.getElementById('inputEmbedColor')?.value  || '#6C53FF';

  const ep = document.getElementById('embedPreview');
  if (!ep) return;
  ep.style.borderLeftColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6C53FF';

  const elIds = { epAuthor: author, epTitle: title || '(no title)', epDesc: desc || '(response)', epFooter: footer };
  for (const [id, text] of Object.entries(elIds)) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Update field count indicator in preview
  const fieldsEl = document.getElementById('epFields');
  if (fieldsEl) {
    const fields = state.embedFields;
    fieldsEl.innerHTML = fields.length
      ? fields.map(f => `
          <div style="display:inline-flex;flex-direction:column;gap:0.1rem;${f.inline ? 'min-width:30%' : 'width:100%'}">
            <strong style="font-size:0.72rem;color:#e8e8f5">${esc(f.name||'Field')}</strong>
            <span style="font-size:0.7rem;color:#ccc">${esc(f.value||'…')}</span>
          </div>`).join('')
      : '';
  }
}

export function syncColorText() {
  const hex = document.getElementById('inputEmbedColor')?.value || '';
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    const p = document.getElementById('inputEmbedColorPicker');
    if (p) p.value = hex;
    updateEmbedPreview();
  }
}

export function syncColorPicker() {
  const p = document.getElementById('inputEmbedColorPicker');
  const t = document.getElementById('inputEmbedColor');
  if (p && t) t.value = p.value;
  updateEmbedPreview();
}

// ── Variable chips ────────────────────────────────────────────────────────────

export function refreshVarChips() {
  const container = document.getElementById('varChips');
  if (!container) return;

  const base = [
    ['{user.mention}',  'user.mention'],
    ['{user.tag}',      'user.tag'],
    ['{user.id}',       'user.id'],
    ['{user.name}',     'user.name'],
    ['{user.avatar}',   'user.avatar'],
    ['{server}',        'server'],
    ['{server.id}',     'server.id'],
    ['{channel}',       'channel'],
    ['{channel.name}',  'channel.name'],
    ['{memberCount}',   'memberCount'],
    ['{date}',          'date'],
    ['{time}',          'time'],
    ['{timestamp}',     'timestamp'],
    ['{random:1-100}',  'random:1-100'],
  ].map(([v, l]) => `<span class="var-chip" onclick="insertVar('${v}')">${l}</span>`);

  const argChips = state.args.filter(a => a.name).flatMap(a => {
    const chips = [`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}}')">{arg:${esc(a.name)}}</span>`];
    if (['USER','CHANNEL','ROLE','MENTIONABLE'].includes(a.type)) {
      chips.push(`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}.mention}')">{arg:${esc(a.name)}.mention}</span>`);
      chips.push(`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}.id}')">{arg:${esc(a.name)}.id}</span>`);
    }
    if (a.type === 'USER') {
      chips.push(`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}.avatar}')">{arg:${esc(a.name)}.avatar}</span>`);
      chips.push(`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}.name}')">{arg:${esc(a.name)}.name}</span>`);
    }
    if (a.type === 'ATTACHMENT') {
      chips.push(`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}.url}')">{arg:${esc(a.name)}.url}</span>`);
      chips.push(`<span class="var-chip arg" onclick="insertVar('{arg:${a.name}.name}')">{arg:${esc(a.name)}.name}</span>`);
    }
    return chips;
  });

  container.innerHTML = [...base, ...argChips].join('');
}

export function insertVar(v) {
  const ta = document.getElementById('inputResponse');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + v + ta.value.slice(e);
  ta.selectionStart = ta.selectionEnd = s + v.length;
  ta.focus();
  onResponseInput();
}

// ══════════════════════════════════════════════════════════════════════════════
// ── EMBED FIELDS BUILDER ──────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderEmbedFieldList() {
  const container = document.getElementById('embedFieldList');
  if (!container) return;

  const badge = document.getElementById('embedFieldCountBadge');
  if (badge) badge.textContent = state.embedFields.length;

  if (!state.embedFields.length) {
    container.innerHTML = `<div style="text-align:center;padding:0.75rem;font-size:0.8rem;color:var(--muted)">No fields yet — add up to ${MAX_EMBED_FIELDS}</div>`;
    return;
  }

  container.innerHTML = state.embedFields.map((f, i) => `
    <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:0.45rem;align-items:center;
                background:rgba(0,0,0,0.2);border:1px solid rgba(108,83,255,0.15);
                border-radius:0.6rem;padding:0.55rem 0.65rem">
      <input type="text" placeholder="Field name" value="${esc(f.name)}" maxlength="256"
             oninput="state.embedFields[${i}].name=this.value;updateEmbedPreview()"
             style="font-size:0.8rem">
      <input type="text" placeholder="Field value" value="${esc(f.value)}" maxlength="1024"
             oninput="state.embedFields[${i}].value=this.value;updateEmbedPreview()"
             style="font-size:0.8rem">
      <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.72rem;color:var(--muted);white-space:nowrap;cursor:pointer">
        <input type="checkbox" ${f.inline ? 'checked' : ''} onchange="state.embedFields[${i}].inline=this.checked;updateEmbedPreview()"
               style="width:auto;cursor:pointer"> Inline
      </label>
      <button class="btn-danger-sm" onclick="removeEmbedField(${i})">✕</button>
    </div>
  `).join('');
}

window.removeEmbedField = function(i) {
  state.removeEmbedField(i);
  renderEmbedFieldList();
  updateEmbedPreview();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── MULTI-RESPONSE VARIANTS BUILDER ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderVariantList() {
  const container = document.getElementById('variantList');
  if (!container) return;
  const varBadge = document.getElementById('variantCountBadge');
  if (varBadge) varBadge.textContent = state.variants.length;

  if (!state.variants.length) {
    container.innerHTML = '<div style="text-align:center;padding:1rem;font-size:0.8rem;color:var(--muted)">No variants yet — add one below</div>';
    return;
  }

  container.innerHTML = state.variants.map((v, i) => `
    <div class="variant-row" style="display:grid;grid-template-columns:1fr auto auto;gap:0.5rem;align-items:start;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06);border-radius:0.6rem;padding:0.65rem">
      <textarea rows="2" style="resize:vertical" placeholder="Response text…" maxlength="2000"
                oninput="state.variants[${i}].text=this.value">${esc(v.text)}</textarea>
      <div style="display:flex;flex-direction:column;gap:0.2rem;align-items:center">
        <label style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">Weight</label>
        <input type="number" min="1" max="100" value="${v.weight||1}" style="width:52px;text-align:center"
               oninput="state.variants[${i}].weight=Math.max(1,Math.min(100,Number(this.value)||1))">
      </div>
      <button class="btn-danger-sm" style="margin-top:1.2rem" onclick="removeVariant(${i})">✕</button>
    </div>
  `).join('');
}

window.removeVariant = function(i) {
  state.removeVariant(i);
  renderVariantList();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── CONDITIONAL RESPONSES BUILDER ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderConditionalList() {
  const container = document.getElementById('conditionalList');
  if (!container) return;
  const condBadge = document.getElementById('condCountBadge');
  if (condBadge) condBadge.textContent = state.conditionals.length;

  const argNames = state.args.filter(a => a.name).map(a => a.name);

  if (!state.conditionals.length) {
    container.innerHTML = '<div style="text-align:center;padding:1rem;font-size:0.8rem;color:var(--muted)">No conditions yet — first match wins</div>';
    return;
  }

  container.innerHTML = state.conditionals.map((c, i) => `
    <div style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,179,71,0.15);border-radius:0.7rem;padding:0.75rem;display:flex;flex-direction:column;gap:0.55rem">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <span style="font-size:0.72rem;color:var(--warning);font-weight:700;text-transform:uppercase;letter-spacing:0.06em">IF</span>
        <select style="flex:1;min-width:90px" onchange="state.conditionals[${i}].argName=this.value">
          <option value="">— pick arg —</option>
          ${argNames.map(n => `<option value="${esc(n)}"${c.argName===n?' selected':''}>${esc(n)}</option>`).join('')}
        </select>
        <select onchange="state.conditionals[${i}].operator=this.value" style="min-width:130px">
          ${COND_OPS.map(op => `<option value="${op.value}"${c.operator===op.value?' selected':''}>${op.label}</option>`).join('')}
        </select>
        <input type="text" placeholder="value" value="${esc(c.value)}" style="flex:1;min-width:80px"
               oninput="state.conditionals[${i}].value=this.value">
        <button class="btn-danger-sm" onclick="removeCond(${i})">✕</button>
      </div>
      <textarea rows="2" placeholder="Response to send when condition matches…" maxlength="2000" style="resize:vertical"
                oninput="state.conditionals[${i}].response=this.value">${esc(c.response)}</textarea>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <label style="font-size:0.75rem;color:var(--muted)">Send as embed</label>
        <div class="toggle-wrapper" style="width:38px;height:21px">
          <input type="checkbox" id="condEmbed${i}" class="toggle-checkbox"${c.isEmbed?' checked':''}
                 onchange="state.conditionals[${i}].isEmbed=this.checked">
          <label for="condEmbed${i}" class="toggle-label"></label>
        </div>
      </div>
    </div>
  `).join('');
}

window.removeCond = function(i) {
  state.removeConditional(i);
  renderConditionalList();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── ACTIONS BUILDER ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderActionList() {
  const container = document.getElementById('actionList');
  if (!container) return;

  const badge = document.getElementById('actionCountBadge');
  if (badge) badge.textContent = state.actions.length;

  const argNames = state.args.filter(a => a.name).map(a => a.name);

  if (!state.actions.length) {
    container.innerHTML = `<div style="text-align:center;padding:1rem;font-size:0.8rem;color:var(--muted)">No actions yet — actions run after the response is sent</div>`;
    return;
  }

  container.innerHTML = state.actions.map((act, i) => {
    const def = ACTION_TYPES.find(t => t.value === act.type) || ACTION_TYPES[0];

    // Primary arg options (role / channel / user depending on action)
    const primaryArgOpts = argNames
      .filter(n => {
        if (!def.needsArgArg) return true;
        const arg = state.args.find(a => a.name === n);
        return !def.argTypes || def.argTypes.includes(arg?.type);
      })
      .map(n => `<option value="${esc(n)}"${act.argName===n?' selected':''}>${esc(n)}</option>`)
      .join('');

    // Target (secondary) arg options — defaults to USER/MENTIONABLE unless overridden
    const targetArgTypes = def.userArgTypes || ['USER', 'MENTIONABLE'];
    const targetArgOpts = argNames
      .filter(n => {
        const arg = state.args.find(a => a.name === n);
        return targetArgTypes.includes(arg?.type);
      })
      .map(n => `<option value="${esc(n)}"${act.targetArg===n?' selected':''}>${esc(n)}</option>`)
      .join('');

    const typeOptions = ACTION_TYPES
      .map(t => `<option value="${t.value}"${act.type===t.value?' selected':''}>${t.label}</option>`)
      .join('');

    // ── Group divider label ───────────────────────────────────────────────
    const groupColor = {
      Roles: '#C084FC', Messaging: '#53E8FF', Moderation: '#FF8A8A',
    }[def.group] || '#a799ff';

    return `
    <div style="background:rgba(0,0,0,0.22);border:1px solid rgba(108,83,255,0.18);border-radius:0.7rem;padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem">

      <!-- Row 1: icon + type selector + remove -->
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <span style="font-size:0.72rem;font-weight:800;color:${groupColor};min-width:24px;text-align:center">${def.icon||'⚡'}</span>
        <select style="flex:2;min-width:180px" onchange="updateActionType(${i},this.value)">${typeOptions}</select>
        <button class="btn-danger-sm" onclick="removeAction(${i})">✕</button>
      </div>

      <!-- Row 2: primary arg picker (role/channel from arg) -->
      ${def.needsArgArg ? `
      <div class="input-group">
        <label class="input-label" style="color:${groupColor}">
          ${def.argTypes?.includes('ROLE') ? '🎭 Role arg' :
            def.argTypes?.includes('CHANNEL') ? '🔊 Channel arg' :
            def.argTypes?.includes('USER') ? '👤 User arg' : '📋 Arg'}
          <span style="color:var(--muted);font-weight:400"> — pick the ${def.argTypes?.[0]?.toLowerCase()||'arg'} argument</span>
        </label>
        <select onchange="state.actions[${i}].argName=this.value">
          <option value="">— select arg —</option>
          ${primaryArgOpts}
        </select>
      </div>` : ''}

      <!-- Fixed target ID (role / channel) -->
      ${def.needsTarget === 'role_id' ? `
      <div class="input-group">
        <label class="input-label">🎭 Role ID <span style="color:var(--muted);font-weight:400">(copy from Discord → right-click role → Copy ID)</span></label>
        <input type="text" placeholder="e.g. 123456789012345678" value="${esc(act.targetId||'')}"
               oninput="state.actions[${i}].targetId=this.value"
               style="font-family:'JetBrains Mono',monospace;font-size:0.8rem">
      </div>` : ''}
      ${def.needsTarget === 'channel_id' ? `
      <div class="input-group">
        <label class="input-label">🔊 Channel ID</label>
        <input type="text" placeholder="e.g. 123456789012345678" value="${esc(act.targetId||'')}"
               oninput="state.actions[${i}].targetId=this.value"
               style="font-family:'JetBrains Mono',monospace;font-size:0.8rem">
      </div>` : ''}

      <!-- Row 3: TARGET USER arg picker (the person to act on) -->
      ${def.needsUserArg ? `
      <div class="input-group" style="background:rgba(255,107,180,0.06);border:1px solid rgba(255,107,180,0.18);border-radius:0.5rem;padding:0.55rem 0.65rem">
        <label class="input-label" style="color:#FF6EB4">
          👤 ${def.userArgLabel || 'Target user arg'}
          <span style="color:var(--muted);font-weight:400"> — who to apply the action to</span>
        </label>
        <select onchange="state.actions[${i}].targetArg=this.value">
          <option value="">— select arg —</option>
          ${targetArgOpts || '<option disabled>No compatible args found — add a USER arg first</option>'}
        </select>
        ${!targetArgOpts ? `<small style="color:var(--warning);font-size:0.7rem">⚠ Add a USER-type argument to this command first, then it will appear here.</small>` : ''}
      </div>` : ''}

      <!-- Value inputs -->
      ${def.needsValue === 'message' ? `
      <div class="input-group">
        <label class="input-label">Message <span style="color:var(--muted);font-weight:400">(supports {arg:name} variables)</span></label>
        <textarea rows="2" placeholder="Message content…" maxlength="2000" style="resize:vertical;font-size:0.8rem"
                  oninput="state.actions[${i}].value=this.value">${esc(act.value||'')}</textarea>
      </div>` : ''}
      ${def.needsValue === 'nickname' ? `
      <div class="input-group">
        <label class="input-label">New Nickname <span style="color:var(--muted);font-weight:400">(blank = clear; supports {arg:name})</span></label>
        <input type="text" placeholder="{user.name} | Member" value="${esc(act.value||'')}" maxlength="32"
               oninput="state.actions[${i}].value=this.value" style="font-size:0.8rem">
      </div>` : ''}
      ${def.needsValue === 'duration' ? `
      <div class="input-group">
        <label class="input-label">Timeout Duration (seconds)</label>
        <input type="number" min="1" max="2419200" placeholder="60" value="${esc(act.value||'')}"
               oninput="state.actions[${i}].value=this.value" style="font-size:0.8rem">
      </div>` : ''}
      ${def.needsValue === 'reason' ? `
      <div class="input-group">
        <label class="input-label">Reason <span style="color:var(--muted);font-weight:400">(optional; supports {arg:name})</span></label>
        <input type="text" placeholder="Reason…" value="${esc(act.value||'')}" maxlength="512"
               oninput="state.actions[${i}].value=this.value" style="font-size:0.8rem">
      </div>` : ''}
      ${def.needsValue === 'emoji' ? `
      <div class="input-group">
        <label class="input-label">Emoji</label>
        <input type="text" placeholder="👍 or custom:emoji_id" value="${esc(act.value||'')}" maxlength="64"
               oninput="state.actions[${i}].value=this.value" style="font-size:0.8rem">
      </div>` : ''}

      <!-- Options row -->
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;padding-top:0.1rem">
        <label style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          <input type="checkbox" ${act.silentFail?'checked':''} onchange="state.actions[${i}].silentFail=this.checked"
                 style="width:auto;cursor:pointer"> Silent on failure
        </label>
        <label style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:0.35rem;cursor:pointer">
          <input type="checkbox" ${act.requiresPerms?'checked':''} onchange="state.actions[${i}].requiresPerms=this.checked"
                 style="width:auto;cursor:pointer"> Require bot perms check
        </label>
      </div>
    </div>`;
  }).join('');
}

window.updateActionType = function(i, newType) {
  state.actions[i].type      = newType;
  state.actions[i].argName   = '';
  state.actions[i].targetArg = '';
  state.actions[i].targetId  = '';
  state.actions[i].value     = '';
  renderActionList();
};

window.removeAction = function(i) {
  state.removeAction(i);
  renderActionList();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── BUTTONS BUILDER ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderButtonList() {
  const container = document.getElementById('buttonList');
  if (!container) return;

  const badge = document.getElementById('buttonCountBadge');
  if (badge) badge.textContent = state.buttons.length;

  if (!state.buttons.length) {
    container.innerHTML = `<div style="text-align:center;padding:1rem;font-size:0.8rem;color:var(--muted)">No buttons yet — attach interactive buttons to the response message</div>`;
    return;
  }

  container.innerHTML = state.buttons.map((btn, i) => {
    const styleDef = BUTTON_STYLES.find(s => s.value === btn.style) || BUTTON_STYLES[0];
    const styleOptions = BUTTON_STYLES.map(s => `<option value="${s.value}"${btn.style===s.value?' selected':''}>${s.label}</option>`).join('');
    const isLink = btn.style === 'LINK';

    return `
    <div style="background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.08);border-radius:0.7rem;padding:0.75rem;display:flex;flex-direction:column;gap:0.5rem">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
        <div class="btn-preview" style="background:${styleDef.color}22;border:1px solid ${styleDef.color}55;color:${styleDef.color};
          padding:0.25rem 0.7rem;border-radius:0.4rem;font-size:0.73rem;font-weight:700;min-width:60px;text-align:center">
          ${esc(btn.emoji ? btn.emoji+' ' : '')}${esc(btn.label || 'Button')}
        </div>
        <select style="flex:1;min-width:100px" onchange="updateButtonStyle(${i},this.value)">${styleOptions}</select>
        <button class="btn-danger-sm" onclick="removeButton(${i})">✕</button>
      </div>
      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Label</label>
          <input type="text" placeholder="Button label" value="${esc(btn.label||'')}" maxlength="80"
                 oninput="state.buttons[${i}].label=this.value;renderButtonList()" style="font-size:0.8rem">
        </div>
        <div class="input-group">
          <label class="input-label">Emoji <span style="color:var(--muted);font-weight:400">(optional)</span></label>
          <input type="text" placeholder="👍" value="${esc(btn.emoji||'')}" maxlength="32"
                 oninput="state.buttons[${i}].emoji=this.value;renderButtonList()" style="font-size:0.8rem">
        </div>
      </div>
      ${isLink ? `
        <div class="input-group">
          <label class="input-label">URL</label>
          <input type="url" placeholder="https://example.com" value="${esc(btn.url||'')}" maxlength="512"
                 oninput="state.buttons[${i}].url=this.value" style="font-family:'JetBrains Mono',monospace;font-size:0.8rem">
        </div>` : `
        <div class="input-group">
          <label class="input-label">Response on click <span style="color:var(--muted);font-weight:400">(supports {arg:name})</span></label>
          <textarea rows="2" placeholder="What the bot replies when clicked…" maxlength="2000" style="resize:vertical;font-size:0.8rem"
                    oninput="state.buttons[${i}].response=this.value">${esc(btn.response||'')}</textarea>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <label style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:0.35rem;cursor:pointer">
            <input type="checkbox" ${btn.ephemeralResponse?'checked':''} onchange="state.buttons[${i}].ephemeralResponse=this.checked"
                   style="width:auto;cursor:pointer">
            Ephemeral button response
          </label>
          <label style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:0.35rem;cursor:pointer">
            <input type="checkbox" ${btn.disableAfterClick?'checked':''} onchange="state.buttons[${i}].disableAfterClick=this.checked"
                   style="width:auto;cursor:pointer">
            Disable after click
          </label>
        </div>`}
    </div>`;
  }).join('');
}

window.updateButtonStyle = function(i, newStyle) {
  state.buttons[i].style = newStyle;
  if (newStyle === 'LINK') {
    state.buttons[i].response = '';
  } else {
    state.buttons[i].url = '';
  }
  renderButtonList();
};

window.removeButton = function(i) {
  state.removeButton(i);
  renderButtonList();
};

// ══════════════════════════════════════════════════════════════════════════════
// ── ALIASES BUILDER ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderAliasList() {
  const container = document.getElementById('aliasList');
  if (!container) return;
  const aliases = [...container.querySelectorAll('input[type=text]')].map(el => el.value.trim());
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

export function getAliasValues() {
  const container = document.getElementById('aliasList');
  if (!container) return [];
  return [...container.querySelectorAll('input[type=text]')]
    .map(el => el.value.trim().toLowerCase())
    .filter(Boolean);
}

window.updateAlias = function(i, val) {
  const container = document.getElementById('aliasList');
  if (!container) return;
  const input = container.querySelectorAll('input[type=text]')[i];
  if (!input) return;
  const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (input.value !== clean) input.value = clean;
};

window.removeAlias = function(i) {
  const container = document.getElementById('aliasList');
  if (!container) return;
  const aliases = [...container.querySelectorAll('input[type=text]')]
    .map(el => el.value.trim())
    .filter((_, idx) => idx !== i);
  container.innerHTML = aliases.map((a, idx) => `
    <div style="display:flex;gap:0.5rem;align-items:center">
      <span style="color:#a799ff;font-family:'JetBrains Mono',monospace;font-size:0.85rem">/</span>
      <input type="text" value="${esc(a)}" placeholder="alias-name" maxlength="32"
             style="font-family:'JetBrains Mono',monospace;font-size:0.82rem;flex:1"
             oninput="updateAlias(${idx},this.value)">
      <button class="btn-danger-sm" onclick="removeAlias(${idx})">✕</button>
    </div>
  `).join('');
};

// ══════════════════════════════════════════════════════════════════════════════
// ── TAGS BUILDER ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export function renderTagPills(currentTags = []) {
  const container = document.getElementById('tagPills');
  if (!container) return;
  container.innerHTML = currentTags.map((t, i) => `
    <span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);color:var(--razor);padding:0.2rem 0.55rem;border-radius:99px;font-size:0.72rem;font-weight:700">
      ${esc(t)}
      <button onclick="removeTag(${i})" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;font-size:0.75rem;line-height:1">✕</button>
    </span>
  `).join('');
}

export function getCurrentTags() {
  const container = document.getElementById('tagPills');
  if (!container) return [];
  return [...container.querySelectorAll('span')].map(s =>
    s.textContent.replace('✕', '').trim()
  ).filter(Boolean);
}

window.removeTag = function(i) {
  const tags = getCurrentTags();
  tags.splice(i, 1);
  renderTagPills(tags);
};