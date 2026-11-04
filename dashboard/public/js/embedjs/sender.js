// ─── Send & Copy ──────────────────────────────────────────────────────────────

import { showToast, currentMode }  from './state.js';
import { buildV1Payload, buildEmbedBtnPayload } from './v1builder.js';
import { buildV2Payload }          from './v2builder.js';

// ─── Validation ───────────────────────────────────────────────────────────────

function isValidUrl(s) {
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch { return false; }
}

function validateEmbed(embed) {
  const errs = [];
  if (!embed.title && !embed.description && !embed.image && !embed.thumbnail && !embed.author?.name)
    errs.push('Embed must have at least a title, description, image, or author.');
  if (embed.title?.length > 256)       errs.push(`Title is too long (${embed.title.length}/256).`);
  if (embed.description?.length > 4096) errs.push(`Description is too long (${embed.description.length}/4096).`);
  if (embed.author?.name?.length > 256) errs.push('Author name too long (max 256).');
  if (embed.footer?.text?.length > 2048) errs.push('Footer text too long (max 2048).');
  if (embed.fields?.length > 25)        errs.push('Too many fields (max 25).');
  for (const [i, f] of (embed.fields || []).entries()) {
    if (!f.name || !f.value) { errs.push(`Field ${i+1}: missing name or value.`); continue; }
    if (f.name.length > 256)  errs.push(`Field ${i+1}: name too long (max 256).`);
    if (f.value.length > 1024) errs.push(`Field ${i+1}: value too long (max 1024).`);
  }
  for (const fld of ['authorIcon','thumbnail','image','footerIcon']) {
    const v = document.getElementById(fld)?.value?.trim();
    if (v && !isValidUrl(v)) errs.push(`${fld.replace(/([A-Z])/g,' $1')}: must be a valid https:// URL.`);
  }
  return errs;
}

function validateV1(components, label = '') {
  const errs = [];
  if (!components.length) { errs.push(`${label}Add at least one button row.`); return errs; }
  for (const [ri, row] of components.entries()) {
    if (!row.components?.length) { errs.push(`${label}Row ${ri+1} has no buttons.`); continue; }
    for (const [bi, btn] of row.components.entries()) {
      if (!btn.label?.trim())  errs.push(`${label}Row ${ri+1}, btn ${bi+1}: label required.`);
      if (btn.style === 5 && !isValidUrl(btn.url || ''))
        errs.push(`${label}Row ${ri+1}, btn ${bi+1}: link needs a valid URL.`);
      if (btn.style !== 5 && !btn.custom_id?.trim())
        errs.push(`${label}Row ${ri+1}, btn ${bi+1}: custom ID required.`);
    }
  }
  return errs;
}

function validateV2(components) {
  const errs = [];
  if (!components.length) { errs.push('Add at least one V2 block.'); return errs; }
  for (const [i, comp] of components.entries()) {
    const n = i + 1;
    if (comp.type === 10 && !comp.content?.trim())   errs.push(`Text block ${n}: content is empty.`);
    if (comp.type === 12) {
      if (!comp.items?.length) errs.push(`Gallery block ${n}: add at least one image.`);
      else for (const [ji, item] of comp.items.entries())
        if (!isValidUrl(item.media?.url || '')) errs.push(`Gallery ${n}, image ${ji+1}: invalid URL.`);
    }
    if (comp.type === 9) {
      if (!comp.components?.[0]?.content?.trim()) errs.push(`Section ${n}: text is empty.`);
      if (comp.accessory?.type === 2) {
        if (!comp.accessory.label?.trim())    errs.push(`Section ${n}: button label required.`);
        if (!comp.accessory.custom_id?.trim()) errs.push(`Section ${n}: button custom ID required.`);
      }
      if (comp.accessory?.type === 11 && !isValidUrl(comp.accessory.media?.url || ''))
        errs.push(`Section ${n}: thumbnail needs a valid URL.`);
    }
    if (comp.type === 1) {
      if (!comp.components?.length) errs.push(`Action row ${n}: add at least one button.`);
      for (const [bi, btn] of (comp.components || []).entries()) {
        if (!btn.label?.trim()) errs.push(`Action row ${n}, btn ${bi+1}: label required.`);
        if (btn.style === 5 && !isValidUrl(btn.url || ''))
          errs.push(`Action row ${n}, btn ${bi+1}: link needs a valid URL.`);
        if (btn.style !== 5 && !btn.custom_id?.trim())
          errs.push(`Action row ${n}, btn ${bi+1}: custom ID required.`);
      }
    }
  }
  return errs;
}

// ─── Send button state ────────────────────────────────────────────────────────

let _sending = false;
function setSendState(loading) {
  _sending = loading;
  const btn  = document.getElementById('sendBtn');
  const icon = document.getElementById('sendBtnIcon');
  const text = document.getElementById('sendBtnText');
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
  btn.style.cursor  = loading ? 'not-allowed' : '';
  if (icon) icon.innerHTML = loading
    ? `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`
    : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>`;
  if (text) text.textContent = loading ? 'Sending…' : 'Send Message';
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendMessage(guildId) {
  if (_sending) return;

  const channelId = document.getElementById('channel')?.value?.trim();
  if (!channelId) { showToast('Select a channel first.', 'error'); return; }

  const contentRaw = document.getElementById('plainMessage')?.value || '';
  if (contentRaw.length > 2000) {
    window.showErrors?.([`Content is too long (${contentRaw.length}/2000 chars).`]);
    return;
  }

  const payload = { type: currentMode, channelId, content: contentRaw.trim() || undefined };

  // ── embed ──────────────────────────────────────────────────────────────────
  if (currentMode === 'embed' || currentMode === 'embed_v1') {
    const fields = Array.from(document.querySelectorAll('.field-item')).map(f => ({
      name:   f.querySelector('.field-name')?.value?.trim(),
      value:  f.querySelector('.field-value')?.value?.trim(),
      inline: f.querySelector('.field-inline')?.checked,
    })).filter(f => f.name && f.value);

    const colorHex = document.getElementById('color')?.value || '#6C53FF';
    payload.embed = {
      title:       document.getElementById('title')?.value?.trim()       || undefined,
      description: document.getElementById('description')?.value?.trim() || undefined,
      color:       parseInt(colorHex.replace('#',''), 16) || 0x6C53FF,
      author: document.getElementById('authorName')?.value?.trim() ? {
        name:     document.getElementById('authorName').value.trim(),
        icon_url: document.getElementById('authorIcon')?.value?.trim() || undefined,
        url:      document.getElementById('authorUrl')?.value?.trim()  || undefined,
      } : undefined,
      thumbnail: document.getElementById('thumbnail')?.value?.trim()
        ? { url: document.getElementById('thumbnail').value.trim() } : undefined,
      image: document.getElementById('image')?.value?.trim()
        ? { url: document.getElementById('image').value.trim() }     : undefined,
      footer: document.getElementById('footerText')?.value?.trim()
        ? { text:     document.getElementById('footerText').value.trim(),
            icon_url: document.getElementById('footerIcon')?.value?.trim() || undefined } : undefined,
      timestamp: document.getElementById('timestamp')?.checked ? new Date().toISOString() : undefined,
      fields:    fields.length ? fields : undefined,
    };

    const errs = validateEmbed(payload.embed);
    if (errs.length) { window.showErrors?.(errs); return; }

    // Attach buttons if embed_v1
    if (currentMode === 'embed_v1') {
      const rows = buildEmbedBtnPayload();
      if (rows.length) {
        const btnErrs = validateV1(rows, 'Buttons: ');
        if (btnErrs.length) { window.showErrors?.(btnErrs); return; }
        payload.components = rows;
      }
      // embed_v1 sends as 'embed' type on the server (embed + optional components)
      payload.type = 'embed';
    }

  // ── v1 ─────────────────────────────────────────────────────────────────────
  } else if (currentMode === 'v1') {
    payload.components = buildV1Payload();
    const errs = validateV1(payload.components);
    if (errs.length) { window.showErrors?.(errs); return; }

  // ── v2 ─────────────────────────────────────────────────────────────────────
  } else if (currentMode === 'v2') {
    payload.components = buildV2Payload();
    const errs = validateV2(payload.components);
    if (errs.length) { window.showErrors?.(errs); return; }
  }

  setSendState(true);
  try {
    const res  = await fetch(`/api/guild/${guildId}/embed/send`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) { showToast('✅ Message sent!', 'success'); window.dismissErrors?.(); }
    else        window.showErrors?.([data.error || 'Failed to send.']);
  } catch { window.showErrors?.(['Connection error — check your network.']); }
  finally { setSendState(false); }
}

// ─── Copy JSON ────────────────────────────────────────────────────────────────

export function copyJSON() {
  let json;
  if (currentMode === 'embed' || currentMode === 'embed_v1') {
    const fields = Array.from(document.querySelectorAll('.field-item')).map(f => ({
      name:   f.querySelector('.field-name')?.value?.trim(),
      value:  f.querySelector('.field-value')?.value?.trim(),
      inline: f.querySelector('.field-inline')?.checked,
    })).filter(f => f.name && f.value);
    const colorHex = document.getElementById('color')?.value || '#6C53FF';
    const embedBtnRows = currentMode === 'embed_v1' ? buildEmbedBtnPayload() : [];
    json = {
      content: document.getElementById('plainMessage')?.value?.trim() || null,
      embeds: [{
        title:       document.getElementById('title')?.value?.trim()       || null,
        description: document.getElementById('description')?.value?.trim() || null,
        color:       parseInt(colorHex.replace('#',''), 16) || 0x6C53FF,
        author: document.getElementById('authorName')?.value?.trim() ? {
          name:     document.getElementById('authorName').value.trim(),
          icon_url: document.getElementById('authorIcon')?.value?.trim() || undefined,
          url:      document.getElementById('authorUrl')?.value?.trim()  || undefined,
        } : undefined,
        thumbnail: document.getElementById('thumbnail')?.value?.trim() ? { url: document.getElementById('thumbnail').value.trim() } : undefined,
        image:     document.getElementById('image')?.value?.trim()     ? { url: document.getElementById('image').value.trim() }     : undefined,
        footer: document.getElementById('footerText')?.value?.trim() ? {
          text:     document.getElementById('footerText').value.trim(),
          icon_url: document.getElementById('footerIcon')?.value?.trim() || undefined,
        } : undefined,
        timestamp: document.getElementById('timestamp')?.checked ? new Date().toISOString() : undefined,
        fields: fields.length ? fields : undefined,
      }],
      components: embedBtnRows.length ? embedBtnRows : undefined,
    };
  } else if (currentMode === 'v1') {
    json = { content: document.getElementById('plainMessage')?.value?.trim() || null, components: buildV1Payload() };
  } else {
    json = { flags: 32768, components: buildV2Payload() };
  }
  navigator.clipboard.writeText(JSON.stringify(json, null, 2))
    .then(() => showToast('JSON copied!', 'success'))
    .catch(() => showToast('Failed to copy.', 'error'));
}

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetAll() {
  if (!confirm('Reset all fields? This cannot be undone.')) return;
  location.reload();
}