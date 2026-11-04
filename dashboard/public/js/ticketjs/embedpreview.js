// ─── Embed Preview ────────────────────────────────────────────────────────────

export function syncColorPicker() {
  const hex = document.getElementById('embedColorHex').value;
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) document.getElementById('embedColorPicker').value = hex;
  updatePreview();
}

export function updatePreview() {
  const title  = document.getElementById('embedTitle')?.value    || 'Support Tickets';
  const desc   = document.getElementById('embedDesc')?.value     || 'Select a category.';
  const footer = document.getElementById('embedFooter')?.value   || '';
  const thumb  = document.getElementById('embedThumb')?.value    || '';
  const banner = document.getElementById('embedBanner')?.value   || '';
  const color  = document.getElementById('embedColorHex')?.value || '#6C53FF';

  document.getElementById('prev-title').textContent = title;
  document.getElementById('prev-desc').textContent  = desc;
  document.getElementById('embedPreview').style.borderColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#6C53FF';

  const pf = document.getElementById('prev-footer');
  pf.textContent = footer;
  pf.style.display = footer ? '' : 'none';

  const pt = document.getElementById('prev-thumb');
  pt.src = thumb;
  pt.style.display = thumb ? '' : 'none';

  const pb = document.getElementById('prev-banner');
  pb.src = banner;
  pb.style.display = banner ? '' : 'none';
}