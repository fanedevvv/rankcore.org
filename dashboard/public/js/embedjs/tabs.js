// ─── Tabs & Accordion ─────────────────────────────────────────────────────────

import { setCurrentMode } from './state.js';
import { updatePreview }  from './preview.js';
import { updateV1Preview } from './v1builder.js';
import { updateV2Preview } from './v2builder.js';

const MODES = ['embed', 'embed_v1', 'v1', 'v2'];

// Map from mode → which left-panel sections are visible
const MODE_SECTIONS = {
  embed:     ['fields-embed'],
  embed_v1:  ['fields-embed', 'fields-embed-buttons'],
  v1:        ['fields-v1'],
  v2:        ['fields-v2'],
};

const BADGE_LABELS = {
  embed:    'EMBED',
  embed_v1: 'EMBED+BTN',
  v1:       'V1 BTNS',
  v2:       'V2',
};

export function switchMode(mode) {
  if (!MODES.includes(mode)) return;
  setCurrentMode(mode);

  // Update tab active state
  MODES.forEach(m => {
    const t = document.getElementById(`tab-${m}`);
    if (!t) return;
    t.classList.toggle('active',      m === mode);
    t.classList.toggle('text-gray-400', m !== mode);
  });

  // Show/hide left-panel sections
  const allSections = ['fields-embed', 'fields-embed-buttons', 'fields-v1', 'fields-v2'];
  const visible     = MODE_SECTIONS[mode] || [];
  allSections.forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', !visible.includes(id));
  });

  // Preview panel: show embed only for embed/embed_v1, components otherwise
  const showEmbed = mode === 'embed' || mode === 'embed_v1';
  document.getElementById('prevEmbed')?.classList.toggle('hidden',      !showEmbed);
  document.getElementById('prevComponents')?.classList.toggle('hidden',  mode === 'embed');

  // Badge
  const badge = document.getElementById('previewModeBadge');
  if (badge) badge.textContent = BADGE_LABELS[mode] || mode.toUpperCase();

  // Trigger correct preview
  if (mode === 'embed' || mode === 'embed_v1') updatePreview();
  if (mode === 'v1' || mode === 'embed_v1')    updateV1Preview();
  if (mode === 'v2')                           updateV2Preview();
}

export function toggleAccordion(id, btn) {
  document.getElementById(id)?.classList.toggle('open');
  btn?.classList.toggle('open');
}