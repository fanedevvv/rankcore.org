// ─── V2 Component Builder ─────────────────────────────────────────────────────

import { showToast, parseMarkdown } from './state.js';
import { toggleActionFields, saveButtonAction, populateRoleDropdown } from './v1builder.js';

// Re-export so embeddmain.js can wire them up globally
export { toggleActionFields, saveButtonAction };

const BTN_STYLES = {
  '1': 'Primary (Blue)',
  '2': 'Secondary (Grey)',
  '3': 'Success (Green)',
  '4': 'Danger (Red)',
  '5': 'Link (URL)',
};
const STYLE_COLORS = { 1: '#5865f2', 2: '#4e5058', 3: '#248046', 4: '#da373c', 5: '#4e5058' };

const STYLE_OPTIONS = Object.entries(BTN_STYLES)
  .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

// ─── Block Adder ──────────────────────────────────────────────────────────────

export function addV2Block(type) {
  document.getElementById('v2EmptyHint')?.classList.add('hidden');
  const c = document.getElementById('v2BlocksContainer');
  if (!c) return;

  const d = document.createElement('div');
  d.className    = 'v2-block bg-[#14142b] border border-white/10 rounded-xl p-4 relative group mb-2';
  d.dataset.type = type;

  if (type === 'text') {
    d.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>Text Display
        </span>
        <button onclick="this.closest('[data-type]').remove(); updateV2Preview()"
                class="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all">Remove</button>
      </div>
      <textarea class="v2-text-content w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none"
                rows="3" placeholder="Text content (supports Discord markdown)..." oninput="updateV2Preview()"></textarea>
      <p class="text-xs text-gray-600 mt-1">Supports **bold**, *italic*, \`code\`, and [links](url)</p>
    `;
  } else if (type === 'sep') {
    d.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>Separator
        </span>
        <div class="flex items-center gap-3 flex-wrap">
          <label class="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
            <input type="checkbox" class="v2-sep-divider w-3.5 h-3.5 accent-razor" checked onchange="updateV2Preview()"> Divider line
          </label>
          <select class="v2-sep-spacing text-xs px-2 py-1 rounded-lg bg-[#1a1a2e] border border-white/10 text-white outline-none" onchange="updateV2Preview()">
            <option value="1">Small gap</option>
            <option value="2">Large gap</option>
          </select>
          <button onclick="this.closest('[data-type]').remove(); updateV2Preview()"
                  class="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all">Remove</button>
        </div>
      </div>
    `;
  } else if (type === 'section') {
    d.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span>Section
        </span>
        <button onclick="this.closest('[data-type]').remove(); updateV2Preview()"
                class="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all">Remove</button>
      </div>
      <textarea class="v2-section-text w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none mb-3"
                rows="2" placeholder="Section text content..." oninput="updateV2Preview()"></textarea>
      <div class="space-y-2">
        <label class="text-xs text-gray-500 font-semibold uppercase tracking-wide">Accessory (optional)</label>
        <select class="v2-section-accessory w-full text-sm px-3 py-2 rounded-lg bg-[#1a1a2e] border border-white/10 text-white outline-none" onchange="toggleSectionAccessory(this)">
          <option value="">None</option>
          <option value="button">Button</option>
          <option value="thumbnail">Thumbnail image</option>
        </select>
        <div class="v2-section-btn-fields hidden space-y-2">
          <input class="v2-section-acc-label w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none"
                 placeholder="Button label" oninput="updateV2Preview()">
          <input class="v2-section-acc-id w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none"
                 placeholder="Custom ID (sent to bot on click)" oninput="updateV2Preview()">
        </div>
        <input class="v2-section-acc-url hidden w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none"
               placeholder="Thumbnail URL (https://...)" oninput="updateV2Preview()">
      </div>
    `;
  } else if (type === 'gallery') {
    d.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-pink-400 uppercase tracking-wide flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-pink-400 inline-block"></span>Media Gallery
          <span class="text-gray-600 font-normal normal-case ml-1">max 10 images</span>
        </span>
        <div class="flex gap-2">
          <button onclick="addGalleryItem(this)"
                  class="text-xs px-2.5 py-1.5 bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 rounded-lg transition-all">+ Image</button>
          <button onclick="this.closest('[data-type]').remove(); updateV2Preview()"
                  class="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all">Remove</button>
        </div>
      </div>
      <div class="v2-gallery-items space-y-2">
        <p class="text-xs text-gray-600 italic">No images added yet. Click "+ Image" to add one.</p>
      </div>
    `;
  } else if (type === 'buttons') {
    d.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-bold text-purple-400 uppercase tracking-wide flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>Action Row
          <span class="text-gray-600 font-normal normal-case ml-1">max 5 buttons</span>
        </span>
        <div class="flex gap-2">
          <button onclick="addV2RowButton(this)"
                  class="text-xs px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-lg transition-all">+ Button</button>
          <button onclick="this.closest('[data-type]').remove(); updateV2Preview()"
                  class="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all">Remove</button>
        </div>
      </div>
      <div class="v2-btn-container space-y-2">
        <p class="v2-btn-empty-hint text-xs text-gray-600 italic">No buttons yet.</p>
      </div>
    `;
  }

  c.appendChild(d);
  updateV2Preview();
}

// ─── Section accessory toggle ─────────────────────────────────────────────────

export function toggleSectionAccessory(sel) {
  const block = sel.closest('[data-type]');
  if (!block) return;
  block.querySelector('.v2-section-btn-fields')?.classList.toggle('hidden', sel.value !== 'button');
  block.querySelector('.v2-section-acc-url')?.classList.toggle('hidden',    sel.value !== 'thumbnail');
  updateV2Preview();
}

// ─── Gallery item ─────────────────────────────────────────────────────────────

export function addGalleryItem(btn) {
  const container = btn.closest('[data-type]')?.querySelector('.v2-gallery-items');
  if (!container) return;

  // Remove empty hint
  const hint = container.querySelector('p');
  hint?.remove();

  const realItems = container.querySelectorAll('.v2-gallery-entry').length;
  if (realItems >= 10) { showToast('Max 10 images per gallery.', 'error'); return; }

  const d = document.createElement('div');
  d.className = 'v2-gallery-entry flex gap-2 items-center';
  d.innerHTML = `
    <span class="text-xs text-gray-600 flex-shrink-0 w-5 text-right">${realItems + 1}.</span>
    <input class="v2-gallery-url flex-1 px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none"
           placeholder="Image URL (https://...)" oninput="updateV2Preview()">
    <input class="v2-gallery-desc w-36 px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#1a1a2e] border border-white/10 text-white focus:border-razor outline-none"
           placeholder="Alt text" oninput="updateV2Preview()">
    <button onclick="this.closest('.v2-gallery-entry').remove(); updateV2Preview()"
            class="text-red-400 hover:text-red-300 text-sm px-1.5 transition-all flex-shrink-0">✕</button>
  `;
  container.appendChild(d);
  updateV2Preview();
}

// ─── V2 action row button ─────────────────────────────────────────────────────

export function addV2RowButton(btn) {
  const container = btn.closest('[data-type]')?.querySelector('.v2-btn-container');
  if (!container) return;

  // Remove empty hint
  container.querySelector('.v2-btn-empty-hint')?.remove();

  const realBtns = container.querySelectorAll('.v2-btn-entry').length;
  if (realBtns >= 5) { showToast('Max 5 buttons per row.', 'error'); return; }

  const d = document.createElement('div');
  d.className = 'v2-btn-entry grid grid-cols-2 gap-2 p-3 bg-[#1a1a2e] rounded-xl border border-white/10';
  d.innerHTML = `
    <input class="v2-row-btn-label px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#14142b] border border-white/10 text-white focus:border-razor outline-none"
           placeholder="Button label" oninput="updateV2Preview()">
    <select class="v2-row-btn-style appearance-none px-3 py-2 text-sm rounded-lg bg-[#14142b] border border-white/10 text-white focus:border-razor outline-none"
            onchange="onV2BtnStyleChange(this)">
      ${STYLE_OPTIONS}
    </select>
    <div class="v2-btn-id-wrap col-span-2">
      <input class="v2-row-btn-id w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#14142b] border border-white/10 text-white focus:border-razor outline-none"
             placeholder="Custom ID (e.g. open_ticket)" oninput="updateV2Preview()">
    </div>
    <div class="v2-btn-url-wrap col-span-2 hidden">
      <input class="v2-row-btn-url w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#14142b] border border-white/10 text-white focus:border-razor outline-none"
             placeholder="URL (https://...)" oninput="updateV2Preview()">
    </div>
    <input class="v2-row-btn-emoji px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#14142b] border border-white/10 text-white focus:border-razor outline-none"
           placeholder="Emoji (optional)" oninput="updateV2Preview()">
    <div class="flex items-center justify-between gap-2">
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" class="v2-row-btn-disabled w-3.5 h-3.5 accent-razor" onchange="updateV2Preview()">
        <span class="text-xs text-gray-400">Disabled</span>
      </label>
      <button onclick="this.closest('.v2-btn-entry').remove(); updateV2Preview()"
              class="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg transition-all">Remove</button>
    </div>
    <div class="v2-action-wrap col-span-2 mt-1 p-3 bg-[#0d0d1f] rounded-xl border border-white/5 space-y-2">
      <label class="text-xs text-gray-500 font-semibold uppercase tracking-wide">Button Action <span class="text-purple-400">(saved to bot)</span></label>
      <select class="v2-action-type w-full text-sm px-3 py-2 rounded-lg bg-[#14142b] border border-white/10 text-white outline-none"
              onchange="toggleActionFields(this, 'v2-')">
        <option value="none">No action (link buttons or handled by bot)</option>
        <option value="reply">Reply with message</option>
        <option value="dm">DM the user</option>
        <option value="role_add">Add role</option>
        <option value="role_remove">Remove role</option>
        <option value="role_toggle">Toggle role</option>
      </select>
      <div class="v2-action-reply-fields hidden space-y-2">
        <textarea class="v2-action-reply-content w-full px-3 py-2 text-sm placeholder-gray-600 rounded-lg bg-[#14142b] border border-white/10 text-white focus:border-razor outline-none resize-none"
                  rows="2" placeholder="Message content (max 2000 chars)..."></textarea>
        <label class="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-400">
          <input type="checkbox" class="v2-action-ephemeral w-3.5 h-3.5 accent-razor" checked>
          Ephemeral (only visible to the clicker)
        </label>
      </div>
      <div class="v2-action-role-fields hidden">
        <select class="v2-action-role-id w-full text-sm px-3 py-2 rounded-lg bg-[#14142b] border border-white/10 text-white outline-none">
          <option value="">Loading roles…</option>
        </select>
      </div>
      <button onclick="saveButtonAction(this, 'v2-')"
              class="w-full py-1.5 text-xs font-semibold rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all">
        💾 Save Action
      </button>
    </div>
  `;
  container.appendChild(d);
  // Hydrate the role dropdown
  populateRoleDropdown(d.querySelector('.v2-action-role-id'));
  updateV2Preview();
}

export function onV2BtnStyleChange(sel) {
  const entry  = sel.closest('.v2-btn-entry');
  const isLink = sel.value === '5';
  entry?.querySelector('.v2-btn-id-wrap')?.classList.toggle('hidden',  isLink);
  entry?.querySelector('.v2-btn-url-wrap')?.classList.toggle('hidden', !isLink);
  // Link buttons cannot have bot actions
  entry?.querySelector('.v2-action-wrap')?.classList.toggle('hidden', isLink);
  updateV2Preview();
}

// ─── Payload builder ──────────────────────────────────────────────────────────

export function buildV2Payload() {
  const container = document.getElementById('v2BlocksContainer');
  if (!container) return [];

  return Array.from(container.querySelectorAll(':scope > .v2-block')).map(block => {
    const t = block.dataset.type;

    if (t === 'text') {
      return { type: 10, content: block.querySelector('.v2-text-content')?.value || '' };
    }
    if (t === 'sep') {
      return {
        type:    14,
        divider: block.querySelector('.v2-sep-divider')?.checked ?? true,
        spacing: parseInt(block.querySelector('.v2-sep-spacing')?.value || '1'),
      };
    }
    if (t === 'section') {
      const acc     = block.querySelector('.v2-section-accessory')?.value;
      const section = {
        type:       9,
        components: [{ type: 10, content: block.querySelector('.v2-section-text')?.value || '' }],
      };
      if (acc === 'button') {
        const customId = block.querySelector('.v2-section-acc-id')?.value?.trim();
        section.accessory = {
          type:      2,
          label:     block.querySelector('.v2-section-acc-label')?.value || 'Click',
          style:     1,
          custom_id: customId || `sec_${Math.random().toString(36).slice(2, 8)}`,
        };
      } else if (acc === 'thumbnail') {
        section.accessory = {
          type:  11,
          media: { url: block.querySelector('.v2-section-acc-url')?.value || '' },
        };
      }
      return section;
    }
    if (t === 'gallery') {
      const items = Array.from(block.querySelectorAll('.v2-gallery-entry')).map(entry => {
        const url  = entry.querySelector('.v2-gallery-url')?.value?.trim();
        const desc = entry.querySelector('.v2-gallery-desc')?.value?.trim();
        return { media: { url: url || '' }, description: desc || undefined };
      }).filter(i => i.media.url);
      return { type: 12, items };
    }
    if (t === 'buttons') {
      const btns = Array.from(block.querySelectorAll('.v2-btn-entry')).map(entry => {
        const style    = parseInt(entry.querySelector('.v2-row-btn-style')?.value || '1');
        const label    = entry.querySelector('.v2-row-btn-label')?.value || 'Button';
        const emoji    = entry.querySelector('.v2-row-btn-emoji')?.value?.trim();
        const disabled = entry.querySelector('.v2-row-btn-disabled')?.checked ?? false;
        const b = { type: 2, label, style, disabled };
        if (style === 5) {
          b.url = entry.querySelector('.v2-row-btn-url')?.value || 'https://example.com';
        } else {
          const cid = entry.querySelector('.v2-row-btn-id')?.value?.trim();
          b.custom_id = cid || `v2btn_${Math.random().toString(36).slice(2, 8)}`;
        }
        if (emoji) b.emoji = { name: emoji };
        return b;
      });
      return { type: 1, components: btns };
    }
    return null;
  }).filter(Boolean);
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export function updateV2Preview() {
  const comps = buildV2Payload();
  const c     = document.getElementById('prevComponents');
  if (!c) return;
  c.classList.remove('hidden');

  if (!comps.length) {
    c.innerHTML = '<p class="text-xs text-gray-600 italic mt-2">Add blocks to see a preview.</p>';
    return;
  }

  c.innerHTML = comps.map(comp => {
    // Text Display (type 10)
    if (comp.type === 10) {
      return `<div class="text-sm text-gray-200 whitespace-pre-wrap break-words my-1 leading-relaxed">${parseMarkdown(comp.content || '')}</div>`;
    }
    // Separator (type 14)
    if (comp.type === 14) {
      const margin = comp.spacing === 2 ? 'my-4' : 'my-2';
      return `<div class="${margin}">${comp.divider ? '<hr class="border-white/10">' : ''}</div>`;
    }
    // Section (type 9)
    if (comp.type === 9) {
      const text = comp.components?.[0]?.content || '';
      let accHtml = '';
      if (comp.accessory?.type === 2) {
        const bg = STYLE_COLORS[comp.accessory.style] || '#5865f2';
        accHtml = `<button class="px-3 py-1.5 text-xs font-semibold rounded-md flex-shrink-0 cursor-default"
                           style="background:${bg};color:white;opacity:${comp.accessory.disabled ? 0.45 : 1}"
                   >${comp.accessory.emoji?.name || ''}${comp.accessory.label}</button>`;
      } else if (comp.accessory?.type === 11 && comp.accessory.media?.url) {
        accHtml = `<img src="${comp.accessory.media.url}" class="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                        onerror="this.style.display='none'">`;
      }
      return `<div class="flex items-center gap-3 my-1 px-3 py-2.5 bg-[#2b2d31] rounded-xl border border-white/5">
        <div class="flex-1 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">${parseMarkdown(text)}</div>
        ${accHtml}
      </div>`;
    }
    // Media Gallery (type 12)
    if (comp.type === 12) {
      if (!comp.items?.length) return '<p class="text-xs text-gray-600 italic my-1">Gallery (no valid URLs)</p>';
      const count = comp.items.length;
      // Mirror Discord's gallery layout: 1=full, 2=side-by-side, 3+=grid
      if (count === 1) {
        return `<div class="my-1.5 rounded-xl overflow-hidden">
          <img src="${comp.items[0].media.url}" class="w-full max-h-48 object-cover rounded-xl" onerror="this.style.display='none'">
        </div>`;
      }
      if (count === 2) {
        return `<div class="flex gap-1 my-1.5">${comp.items.map(i =>
          `<img src="${i.media.url}" class="flex-1 h-32 object-cover rounded-xl" onerror="this.style.display='none'">`
        ).join('')}</div>`;
      }
      return `<div class="grid grid-cols-3 gap-1 my-1.5">${comp.items.map(i =>
        `<img src="${i.media.url}" class="w-full h-24 object-cover rounded-lg" onerror="this.style.display='none'">`
      ).join('')}</div>`;
    }
    // Action Row — V2 style (type 1 inside V2 is rendered differently)
    if (comp.type === 1) {
      if (!comp.components?.length) return '';
      return `<div class="flex flex-wrap gap-2 mt-2 p-2 bg-[#2b2d31]/60 rounded-xl border border-white/5">${
        comp.components.map(b => {
          const bg  = STYLE_COLORS[b.style] || '#4e5058';
          const opacity = b.disabled ? 'opacity-40' : 'hover:opacity-90';
          return `<button class="v2-preview-btn px-4 py-2 text-xs font-semibold rounded-lg cursor-default transition-opacity ${opacity}"
                          style="background:${bg};color:white"
                  >${b.emoji?.name || ''}${b.label}</button>`;
        }).join('')
      }</div>`;
    }
    return '';
  }).join('');
}