// ─── Embed Preview ────────────────────────────────────────────────────────────

import { parseMarkdown } from './state.js';

// ─── Color ────────────────────────────────────────────────────────────────────

export function setColor(hex) {
  const picker = document.getElementById('colorPicker');
  const input  = document.getElementById('color');
  if (picker) picker.value = hex;
  if (input)  input.value  = hex;
  updatePreview();
}

export function initColorSync() {
  document.getElementById('colorPicker')?.addEventListener('input', e => {
    const inp = document.getElementById('color');
    if (inp) inp.value = e.target.value;
    updatePreview();
  });
  document.getElementById('color')?.addEventListener('input', e => {
    try { document.getElementById('colorPicker').value = e.target.value; } catch {}
    updatePreview();
  });
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export function updatePreview() {
  const g = id => document.getElementById(id);
  const v = id => g(id)?.value || '';

  // Plain content
  const content  = v('plainMessage');
  const pContent = g('prevContent');
  if (pContent) {
    pContent.textContent = content;
    pContent.classList.toggle('hidden', !content);
  }

  // Color
  const hex   = v('color').startsWith('#') ? v('color') : '#6C53FF';
  const inner = g('prevEmbedInner');
  if (inner) inner.style.borderLeftColor = hex;

  // Author
  const pAuthor = g('prevAuthor');
  if (pAuthor) {
    if (v('authorName')) {
      const iconHtml = v('authorIcon')
        ? `<img src="${v('authorIcon')}" class="w-4 h-4 rounded-full object-cover"> `
        : '';
      pAuthor.innerHTML = iconHtml + v('authorName');
      pAuthor.classList.remove('hidden');
    } else {
      pAuthor.classList.add('hidden');
    }
  }

  // Title
  const pTitle = g('prevTitle');
  if (pTitle) {
    if (v('title')) { pTitle.innerHTML = parseMarkdown(v('title')); pTitle.classList.remove('hidden'); }
    else pTitle.classList.add('hidden');
  }

  // Description
  const pDesc = g('prevDesc');
  if (pDesc) {
    if (v('description')) { pDesc.innerHTML = parseMarkdown(v('description')); pDesc.classList.remove('hidden'); }
    else pDesc.classList.add('hidden');
  }

  // Fields
  const fields  = document.querySelectorAll('.field-item');
  const pFields = g('prevFields');
  if (pFields) {
    if (fields.length) {
      pFields.innerHTML = '';
      pFields.classList.remove('hidden');
      fields.forEach(f => {
        const n      = f.querySelector('.field-name')?.value;
        const val    = f.querySelector('.field-value')?.value;
        const inline = f.querySelector('.field-inline')?.checked;
        if (n && val) {
          const d = document.createElement('div');
          d.className = inline
            ? 'inline-block w-[47%] mr-[2%] align-top mb-1.5'
            : 'block mb-1.5';
          d.innerHTML = `<div class="font-bold text-xs text-white mb-0.5">${parseMarkdown(n)}</div>`
                      + `<div class="text-xs text-gray-300">${parseMarkdown(val)}</div>`;
          pFields.appendChild(d);
        }
      });
    } else {
      pFields.classList.add('hidden');
    }
  }

  // Thumbnail
  const pThumb = g('prevThumb');
  if (pThumb) {
    if (v('thumbnail')) { pThumb.src = v('thumbnail'); pThumb.classList.remove('hidden'); }
    else pThumb.classList.add('hidden');
  }

  // Image
  const pImage = g('prevImage');
  if (pImage) {
    if (v('image')) { pImage.src = v('image'); pImage.classList.remove('hidden'); }
    else pImage.classList.add('hidden');
  }

  // Footer
  const pFooter    = g('prevFooter');
  const showFooter = v('footerText') || g('timestamp')?.checked;
  if (pFooter) {
    if (showFooter) {
      pFooter.classList.remove('hidden');
      const fi = g('prevFooterIcon');
      if (fi) {
        if (v('footerIcon')) { fi.src = v('footerIcon'); fi.classList.remove('hidden'); }
        else fi.classList.add('hidden');
      }
      const ft = g('prevFooterText');
      if (ft) ft.textContent = v('footerText');
      const ts  = g('prevTimestamp');
      const sep = g('prevFooterSep');
      if (g('timestamp')?.checked) {
        if (ts) {
          ts.textContent = 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          ts.classList.remove('hidden');
        }
        if (sep) sep.classList.toggle('hidden', !v('footerText'));
      } else {
        ts?.classList.add('hidden');
        sep?.classList.add('hidden');
      }
    } else {
      pFooter.classList.add('hidden');
    }
  }
}

// ─── Fields ───────────────────────────────────────────────────────────────────

export function addField() {
  const c = document.getElementById('fieldsContainer');
  if (!c) return;
  const d = document.createElement('div');
  d.className = 'field-item bg-[#1a1a2e] border border-white/10 rounded-xl p-3 mb-2 relative group';
  d.innerHTML = `
    <div class="flex gap-2 mb-2">
      <input class="field-name flex-1 px-3 py-1.5 text-sm placeholder-gray-600 rounded-lg"
             placeholder="Field Name" oninput="updatePreview()">
      <label class="flex items-center gap-1.5 bg-[#14142b] px-3 rounded-lg border border-white/10 cursor-pointer">
        <input type="checkbox" class="field-inline w-3.5 h-3.5 accent-razor" onchange="updatePreview()">
        <span class="text-xs text-gray-400">Inline</span>
      </label>
      <button onclick="this.closest('.field-item').remove(); updatePreview()"
              class="w-7 h-7 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg flex items-center justify-center text-xs transition-all">✕</button>
    </div>
    <textarea class="field-value w-full px-3 py-1.5 text-sm placeholder-gray-500 rounded-lg"
              rows="2" placeholder="Field Value" oninput="updatePreview()"></textarea>
  `;
  c.appendChild(d);
}
