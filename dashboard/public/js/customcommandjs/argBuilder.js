// /js/custom/argBuilder.js
// Builds and manages the argument list UI inside the Arguments modal tab.

import { state, TYPES, MAX_ARGS, MAX_CHOICES } from './state.js';
import { esc }                                  from './utils.js';
import { refreshVarChips }                      from './form.js';
import { showToast }                            from './utils.js';

// ── Public API ────────────────────────────────────────────────────────────────

export function addArgument() {
  if (state.args.length >= MAX_ARGS) {
    return showToast('Maximum 25 arguments per command', 'warn');
  }
  state.addArg({
    name: '', description: '', type: 'STRING', required: false,
    choices: [], minValue: null, maxValue: null,
    minLength: null, maxLength: null, autocomplete: false,
  });
  renderArgList();
  refreshVarChips();

  // Auto-expand the newly added card
  setTimeout(() => {
    const cards = document.querySelectorAll('.arg-card');
    const last  = cards[cards.length - 1];
    if (last && !last.classList.contains('open')) {
      last.querySelector('.arg-header')?.click();
    }
  }, 20);
}

export function removeArg(idx) {
  state.removeArg(idx);
  renderArgList();
  refreshVarChips();
}

/**
 * Re-render the entire argument list and re-attach all events.
 * Called whenever the _args array changes.
 */
export function renderArgList() {
  const container = document.getElementById('argList');
  if (!container) return;

  const argBadge = document.getElementById('argCountBadge');
  if (argBadge) argBadge.textContent = state.args.length;

  if (state.args.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:1rem;font-size:0.8rem;color:var(--muted)">No arguments yet — click "+ Add Argument" to start</div>';
    return;
  }

  container.innerHTML = state.args.map((arg, i) => buildArgCard(arg, i)).join('');
  attachArgEvents(container);
}

// ── Card HTML builder ─────────────────────────────────────────────────────────

function buildArgCard(arg, i) {
  const t = TYPES[arg.type] || TYPES.STRING;

  const pill   = `<span class="arg-type-pill" data-idx="${i}"
    style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55">${t.label}</span>`;
  const reqDot = `<span class="req-dot${arg.required ? ' on' : ''}" data-idx="${i}"></span>`;

  return `
  <div class="arg-card" data-idx="${i}">
    <div class="arg-header">
      <span style="color:var(--muted);font-size:0.8rem;cursor:grab;opacity:0.5">⠿</span>
      ${pill}
      <span class="arg-name-disp${arg.name ? '' : ' empty'}" data-idx="${i}">${arg.name || 'unnamed'}</span>
      ${reqDot}
      <button onclick="event.stopPropagation();removeArg(${i})"
              class="btn-danger-sm" style="padding:0.2rem 0.5rem;font-size:0.68rem">✕</button>
      <span class="arg-chevron">▼</span>
    </div>
    <div class="arg-body">

      <div class="grid-2">
        <div class="input-group">
          <label class="input-label">Argument Name</label>
          <input type="text" class="arg-name-input" data-idx="${i}" value="${esc(arg.name)}"
                 placeholder="e.g. target, amount, reason"
                 style="font-family:'JetBrains Mono',monospace;font-size:0.82rem" maxlength="32">
        </div>
        <div class="input-group">
          <label class="input-label">Description</label>
          <input type="text" class="arg-desc-input" data-idx="${i}" value="${esc(arg.description)}"
                 placeholder="Describe this argument" maxlength="100">
        </div>
      </div>

      <div class="input-group">
        <label class="input-label">Type</label>
        <div class="type-grid">${buildTypeBtns(i, arg.type)}</div>
      </div>

      <div class="row" style="padding:0.6rem 0.75rem;background:rgba(0,0,0,0.2);border-radius:0.5rem;border:1px solid rgba(255,255,255,0.05)">
        <div class="row-label">
          <span style="font-size:0.82rem">Required</span>
          <small>User must provide this argument</small>
        </div>
        <div class="toggle-wrapper" style="width:40px;height:22px">
          <input type="checkbox" id="reqToggle${i}" class="toggle-checkbox arg-req-toggle"
                 data-idx="${i}"${arg.required ? ' checked' : ''}>
          <label for="reqToggle${i}" class="toggle-label"></label>
        </div>
      </div>

      <!-- STRING-specific options -->
      <div class="type-opts${arg.type === 'STRING' ? ' on' : ''}" id="opts-string-${i}">
        ${buildStringOpts(i, arg)}
      </div>

      <!-- INTEGER / NUMBER options -->
      <div class="type-opts${(arg.type === 'INTEGER' || arg.type === 'NUMBER') ? ' on' : ''}" id="opts-num-${i}">
        ${buildNumOpts(i, arg)}
      </div>

      <!-- CHANNEL options -->
      <div class="type-opts${arg.type === 'CHANNEL' ? ' on' : ''}" id="opts-channel-${i}">
        ${buildChannelOpts(i, arg)}
      </div>

      <!-- BOOLEAN / USER / ROLE / MENTIONABLE / ATTACHMENT — contextual notes -->
      <div class="type-opts${['BOOLEAN','USER','ROLE','MENTIONABLE','ATTACHMENT'].includes(arg.type) ? ' on' : ''}" id="opts-simple-${i}">
        ${buildSimpleNote(arg.type, arg.name)}
      </div>

    </div>
  </div>`;
}

function buildTypeBtns(idx, selected) {
  return Object.entries(TYPES).map(([key, t]) => {
    const sel = key === selected;
    return `<button class="type-btn${sel ? ' sel' : ''}" data-idx="${idx}" data-type="${key}"
              style="${sel ? `color:${t.color};border-color:${t.color}` : ''}" title="${t.label}">
              <span class="ti">${t.icon}</span>${t.label}
            </button>`;
  }).join('');
}

function buildStringOpts(i, arg) {
  return `
    <div class="grid-2">
      <div class="input-group">
        <label class="input-label">Min Length</label>
        <div class="num-wrap">
          <input type="number" class="arg-minLength" data-idx="${i}" value="${arg.minLength ?? ''}" min="0" max="6000" placeholder="—">
          <div class="num-steps">
            <button onclick="argStep(${i},'minLength',1)">▲</button>
            <button onclick="argStep(${i},'minLength',-1)">▼</button>
          </div>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Max Length</label>
        <div class="num-wrap">
          <input type="number" class="arg-maxLength" data-idx="${i}" value="${arg.maxLength ?? ''}" min="1" max="6000" placeholder="—">
          <div class="num-steps">
            <button onclick="argStep(${i},'maxLength',1)">▲</button>
            <button onclick="argStep(${i},'maxLength',-1)">▼</button>
          </div>
        </div>
      </div>
    </div>
    <div class="row" style="padding:0.55rem 0.75rem;background:rgba(0,0,0,0.2);border-radius:0.5rem;border:1px solid rgba(255,255,255,0.05)">
      <div class="row-label">
        <span style="font-size:0.82rem">Autocomplete</span>
        <small>Bot provides dynamic suggestions as user types</small>
      </div>
      <div class="toggle-wrapper" style="width:40px;height:22px">
        <input type="checkbox" id="acToggle${i}" class="toggle-checkbox arg-autocomplete"
               data-idx="${i}"${arg.autocomplete ? ' checked' : ''}>
        <label for="acToggle${i}" class="toggle-label"></label>
      </div>
    </div>
    ${buildChoicesSection(i, arg, false)}`;
}

function buildNumOpts(i, arg) {
  return `
    <div class="grid-2">
      <div class="input-group">
        <label class="input-label">Min Value</label>
        <div class="num-wrap">
          <input type="number" class="arg-minValue" data-idx="${i}" value="${arg.minValue ?? ''}" placeholder="—">
          <div class="num-steps">
            <button onclick="argStep(${i},'minValue',1)">▲</button>
            <button onclick="argStep(${i},'minValue',-1)">▼</button>
          </div>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Max Value</label>
        <div class="num-wrap">
          <input type="number" class="arg-maxValue" data-idx="${i}" value="${arg.maxValue ?? ''}" placeholder="—">
          <div class="num-steps">
            <button onclick="argStep(${i},'maxValue',1)">▲</button>
            <button onclick="argStep(${i},'maxValue',-1)">▼</button>
          </div>
        </div>
      </div>
    </div>
    ${buildChoicesSection(i, arg, true)}`;
}

function buildChannelOpts(i, arg) {
  const ct = arg.channelTypes || [];
  return `
    <div class="input-group">
      <label class="input-label">Channel Type Filter</label>
      <select id="chanType${i}" onchange="updateChanTypes(${i},this)">
        <option value="">Any channel type</option>
        <option value="0"  ${ct.includes(0)  ? 'selected' : ''}>Text Channels only</option>
        <option value="2"  ${ct.includes(2)  ? 'selected' : ''}>Voice Channels only</option>
        <option value="4"  ${ct.includes(4)  ? 'selected' : ''}>Category Channels only</option>
        <option value="5"  ${ct.includes(5)  ? 'selected' : ''}>Announcement Channels only</option>
        <option value="13" ${ct.includes(13) ? 'selected' : ''}>Stage Channels only</option>
        <option value="15" ${ct.includes(15) ? 'selected' : ''}>Forum Channels only</option>
      </select>
    </div>`;
}

function buildSimpleNote(type, name) {
  const n = esc(name || 'name');
  const notes = {
    BOOLEAN:     `⚡ Discord shows a true/false dropdown for this argument.`,
    USER:        `👤 Discord shows a user picker. Use <code style="color:#a799ff">{arg:${n}.mention}</code> or <code style="color:#a799ff">{arg:${n}.id}</code> in your response.`,
    ROLE:        `🎭 Discord shows a role picker. Use <code style="color:#a799ff">{arg:${n}.mention}</code> in your response.`,
    MENTIONABLE: `@ Discord shows a user or role picker. Use <code style="color:#a799ff">{arg:${n}.mention}</code> or <code style="color:#a799ff">{arg:${n}.id}</code> in your response.`,
    ATTACHMENT:  `📎 Discord shows a file upload button. Use <code style="color:#a799ff">{arg:${n}.url}</code> in your response or as an embed image.`,
  };
  return `<div style="font-size:0.75rem;color:var(--muted);padding:0.5rem 0.75rem;background:rgba(0,0,0,0.2);border-radius:0.5rem;border:1px solid rgba(255,255,255,0.04)">
    ${notes[type] || ''}
  </div>`;
}

function buildChoicesSection(i, arg, numeric) {
  const choices = arg.choices || [];
  return `
    <div class="input-group">
      <label class="input-label">Predefined Choices
        <span style="color:var(--muted);font-weight:400">(optional, max 25 — disables free input)</span>
      </label>
      <div id="choices-${i}" style="display:flex;flex-direction:column;gap:0.4rem">
        ${choices.map((c, ci) => choiceRowHTML(i, ci, c, numeric)).join('')}
      </div>
      <button class="add-choice-btn btn-brand" data-idx="${i}"
              style="margin-top:0.35rem;font-size:0.75rem;padding:0.3rem 0.65rem;width:fit-content"
              onclick="event.stopPropagation()">+ Add Choice</button>
    </div>`;
}

function choiceRowHTML(argIdx, ci, choice, numeric) {
  return `<div class="choice-row" id="choice-${argIdx}-${ci}">
    <input type="text" placeholder="Label (shown to user)" value="${esc(choice.name)}"
           style="flex:1.2" oninput="updateChoice(${argIdx},${ci},'name',this.value)"
           onclick="event.stopPropagation()">
    <input type="${numeric ? 'number' : 'text'}" placeholder="Value (sent to bot)" value="${esc(choice.value)}"
           style="flex:1;font-family:'JetBrains Mono',monospace;font-size:0.8rem"
           oninput="updateChoice(${argIdx},${ci},'value',this.value)"
           onclick="event.stopPropagation()">
    <button class="btn-danger-sm"
            onclick="event.stopPropagation();removeChoice(${argIdx},${ci})"
            style="flex-shrink:0">✕</button>
  </div>`;
}

// ── Event wiring ──────────────────────────────────────────────────────────────

function attachArgEvents(container) {
  // Collapse / expand
  container.querySelectorAll('.arg-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.arg-card').classList.toggle('open'));
  });

  // Name
  container.querySelectorAll('.arg-name-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const i = Number(inp.dataset.idx);
      state.args[i].name = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      inp.value = state.args[i].name;
      const disp = container.querySelector(`.arg-name-disp[data-idx="${i}"]`);
      if (disp) {
        disp.textContent = state.args[i].name || 'unnamed';
        disp.className   = `arg-name-disp${state.args[i].name ? '' : ' empty'}`;
      }
      refreshVarChips();
    });
    inp.addEventListener('click', e => e.stopPropagation());
  });

  // Description
  container.querySelectorAll('.arg-desc-input').forEach(inp => {
    inp.addEventListener('input', e => { state.args[Number(inp.dataset.idx)].description = e.target.value; });
    inp.addEventListener('click', e => e.stopPropagation());
  });

  // Required toggle
  container.querySelectorAll('.arg-req-toggle').forEach(cb => {
    cb.addEventListener('change', e => {
      const i = Number(cb.dataset.idx);
      state.args[i].required = e.target.checked;
      const dot = container.querySelector(`.req-dot[data-idx="${i}"]`);
      if (dot) dot.className = `req-dot${e.target.checked ? ' on' : ''}`;
    });
  });

  // Type buttons
  container.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i    = Number(btn.dataset.idx);
      const type = btn.dataset.type;
      state.args[i].type = type;

      // Visual state
      btn.closest('.type-grid').querySelectorAll('.type-btn').forEach(b => {
        b.classList.remove('sel');
        b.style.color = b.style.borderColor = '';
      });
      btn.classList.add('sel');
      btn.style.color = btn.style.borderColor = TYPES[type].color;

      // Update header pill
      const pill = container.querySelector(`.arg-type-pill[data-idx="${i}"]`);
      if (pill) {
        pill.textContent      = TYPES[type].label;
        pill.style.background = `${TYPES[type].color}22`;
        pill.style.color      = TYPES[type].color;
        pill.style.border     = `1px solid ${TYPES[type].color}55`;
      }

      // Show correct options panel
      switchTypePanel(i, type, container);
    });
  });

  // Add choice
  container.querySelectorAll('.add-choice-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = Number(btn.dataset.idx);
      if ((state.args[i].choices || []).length >= MAX_CHOICES) return;
      state.args[i].choices.push({ name: '', value: '' });
      rerenderChoices(i, container);
    });
  });

  // Numeric / length constraint inputs
  ['minValue', 'maxValue', 'minLength', 'maxLength'].forEach(field => {
    container.querySelectorAll(`.arg-${field}`).forEach(inp => {
      inp.addEventListener('input', e => {
        const v = e.target.value === '' ? null : Number(e.target.value);
        state.args[Number(inp.dataset.idx)][field] = v;
      });
    });
  });

  // Autocomplete toggle
  container.querySelectorAll('.arg-autocomplete').forEach(cb => {
    cb.addEventListener('change', e => {
      state.args[Number(cb.dataset.idx)].autocomplete = e.target.checked;
    });
  });
}

// ── Type panel switching ──────────────────────────────────────────────────────

function switchTypePanel(idx, type, container) {
  ['opts-string','opts-num','opts-channel','opts-simple'].forEach(id => {
    const el = container.querySelector(`#${id}-${idx}`);
    if (el) el.className = 'type-opts';
  });

  const panelId =
    type === 'STRING'                               ? 'opts-string'  :
    type === 'INTEGER' || type === 'NUMBER'         ? 'opts-num'     :
    type === 'CHANNEL'                              ? 'opts-channel' :
    ['BOOLEAN','USER','ROLE','MENTIONABLE','ATTACHMENT'].includes(type) ? 'opts-simple' : null;

  if (!panelId) return;
  const panel = container.querySelector(`#${panelId}-${idx}`);
  if (!panel) return;
  panel.className = 'type-opts on';

  // Refresh the simple note with current arg name
  if (panelId === 'opts-simple') {
    panel.innerHTML = buildSimpleNote(type, state.args[idx].name);
  }
}

// ── Choices helpers ───────────────────────────────────────────────────────────

function rerenderChoices(argIdx, container) {
  const el = container.querySelector(`#choices-${argIdx}`);
  if (!el) return;
  const numeric = ['INTEGER','NUMBER'].includes(state.args[argIdx].type);
  el.innerHTML  = (state.args[argIdx].choices || []).map((c, ci) => choiceRowHTML(argIdx, ci, c, numeric)).join('');
}

// ── Globals used by inline onclick handlers ────────────────────────────────────
// (HTML-rendered cards can't import directly, so these go on window)

window.removeArg = removeArg;

window.updateChoice = (ai, ci, field, val) => {
  if (state.args[ai]?.choices?.[ci] != null) state.args[ai].choices[ci][field] = val;
};

window.removeChoice = (ai, ci) => {
  state.args[ai].choices.splice(ci, 1);
  rerenderChoices(ai, document.getElementById('argList'));
};

window.updateChanTypes = (ai, sel) => {
  state.args[ai].channelTypes = sel.value === '' ? [] : [Number(sel.value)];
};

window.argStep = (ai, field, delta) => {
  const container = document.getElementById('argList');
  const inp = container?.querySelector(`.arg-${field}[data-idx="${ai}"]`);
  if (inp) {
    const min = inp.min !== '' ? Number(inp.min) : -Infinity;
    const v   = Math.max(min, (Number(inp.value) || 0) + delta);
    inp.value = v;
    state.args[ai][field] = v;
  }
};