// ─── Preview & Live Rendering ─────────────────────────────────────────────────

// ── Welcome Message Preview ───────────────────────────────────────────────────

export function updateWelcomePreview() {
  const msg = document.getElementById('welcomeMessage')?.value || '';
  const rendered = msg
    .replace(/{user}/g,        '<strong>@NewMember</strong>')
    .replace(/{username}/g,    '<strong>NewMember</strong>')
    .replace(/{inviter}/g,     '<strong>SomeFriend#0001</strong>')
    .replace(/{inviterId}/g,   '<em>123456789</em>')
    .replace(/{invites}/g,     '<strong>42</strong>')
    .replace(/{fake}/g,        '<span style="color:var(--danger)">no</span>')
    .replace(/{url}/g,         '<span style="color:#5865F2">discord.gg/example</span>')
    .replace(/{memberCount}/g, '<strong>1,234</strong>')
    .replace(/{server}/g,      '<strong>My Awesome Server</strong>');

  const preview = document.getElementById('welcomePreview');
  if (preview) {
    preview.innerHTML = rendered ||
      '<span style="color:var(--muted); font-style:italic;">No message set.</span>';
  }
}

export function insertVar(v) {
  const ta = document.getElementById('welcomeMessage');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + v + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + v.length;
  ta.focus();
  updateWelcomePreview();
}

// ── Embed Preview ─────────────────────────────────────────────────────────────

export function updateEmbedPreview() {
  const color  = document.getElementById('embedColor')?.value  || '#6C53FF';
  const title  = document.getElementById('embedTitle')?.value  || 'Welcome!';
  const desc   = document.getElementById('embedDescription')?.value || '';
  const footer = document.getElementById('embedFooter')?.value || '';

  const wrapper = document.getElementById('embedPreviewWrapper');
  if (wrapper) wrapper.style.borderLeftColor = color;

  const epTitle = document.getElementById('epTitle');
  if (epTitle) epTitle.textContent = title;

  const epDesc = document.getElementById('epDesc');
  if (epDesc) epDesc.textContent = desc;

  const epFooter = document.getElementById('epFooter');
  if (epFooter) epFooter.textContent = footer;
}

export function syncColorPicker(source) {
  if (source === 'text') {
    const val = document.getElementById('embedColor')?.value;
    if (val?.startsWith('#') && val.length === 7) {
      const picker = document.getElementById('embedColorPicker');
      if (picker) picker.value = val;
    }
  } else {
    const pickerVal = document.getElementById('embedColorPicker')?.value;
    const colorInput = document.getElementById('embedColor');
    if (colorInput && pickerVal) colorInput.value = pickerVal;
  }
  updateEmbedPreview();
}

export function toggleEmbedFields() {
  const enabled = document.getElementById('embedEnabled')?.checked;
  const fields  = document.getElementById('embedFields');
  if (fields) {
    fields.style.opacity       = enabled ? '1' : '0.4';
    fields.style.pointerEvents = enabled ? '' : 'none';
  }
}

// ── Wire up live listeners (called once on DOMContentLoaded) ──────────────────

export function initPreviewListeners() {
  document.getElementById('welcomeMessage')
    ?.addEventListener('input', updateWelcomePreview);

  document.getElementById('embedColor')
    ?.addEventListener('input', () => syncColorPicker('text'));

  document.getElementById('embedColorPicker')
    ?.addEventListener('change', () => syncColorPicker('picker'));

  ['embedTitle', 'embedDescription', 'embedFooter'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateEmbedPreview);
  });
}