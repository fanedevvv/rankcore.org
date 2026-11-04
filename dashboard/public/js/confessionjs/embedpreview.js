// ─── Embed Preview ────────────────────────────────────────────────────────────

export function syncEmbedColor() {
  const hex = document.getElementById('confColor').value;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) document.getElementById('confColorPicker').value = hex;
  updatePreview();
}

export function updatePreview() {
  const title   = document.getElementById('confTitle')?.value  || '💬 Anonymous Confession';
  const color   = document.getElementById('confColor')?.value  || '#5865F2';
  const footer  = document.getElementById('confFooter')?.value || '';
  const showNum = document.getElementById('showNumber')?.checked ?? true;

  document.getElementById('prev-title').textContent = showNum ? `${title} #1` : title;

  const pf = document.getElementById('prev-footer');
  if (footer) { pf.textContent = footer; pf.classList.remove('hidden'); }
  else pf.classList.add('hidden');

  const ep = document.getElementById('embedPreview');
  if (ep && /^#[0-9A-Fa-f]{6}$/.test(color)) ep.style.borderLeftColor = color;
}