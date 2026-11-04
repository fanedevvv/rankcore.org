// countingjs/failAction.js
// Manages the Fail Action card selector (Hard Reset vs Soft Warn).
// We cannot use Tailwind's peer-checked: variant with the CDN build because
// those classes are never pre-generated. Instead we drive all visual state
// through a single JS update function wired to each radio's change event.

const STYLES = {
  active: {
    reset: { border: '2px solid #ef4444', background: 'rgba(239,68,68,0.12)' },
    warn:  { border: '2px solid #facc15', background: 'rgba(250,204,21,0.10)' },
  },
  inactive: { border: '1px solid rgba(255,255,255,0.10)', background: 'transparent' },
};

/**
 * Call once on DOMContentLoaded to wire up the change listeners.
 */
export function initFailAction() {
  const radios = document.querySelectorAll('input[name="failAction"]');
  radios.forEach(radio => radio.addEventListener('change', updateFailActionCards));
}

/**
 * Set the active radio and refresh card styles.
 * @param {'reset'|'warn'} value
 */
export function setFailAction(value) {
  const el = document.getElementById(value === 'warn' ? 'faWarn' : 'faReset');
  if (el) el.checked = true;
  updateFailActionCards();
}

/**
 * Return the currently selected value.
 * @returns {'reset'|'warn'}
 */
export function getFailAction() {
  return document.querySelector('input[name="failAction"]:checked')?.value || 'reset';
}

// ── Internal ──────────────────────────────────────────────────────────────────

function updateFailActionCards() {
  const selected = getFailAction();

  document.querySelectorAll('input[name="failAction"]').forEach(radio => {
    // The styled card sits in the label's next element sibling
    const card = radio.closest('label')?.querySelector('[data-fail-card]');
    if (!card) return;

    const isActive = radio.value === selected;
    const activeStyle = STYLES.active[radio.value] || STYLES.active.reset;
    const s = isActive ? activeStyle : STYLES.inactive;

    card.style.border      = s.border;
    card.style.background  = s.background;
    card.style.transition  = 'border 0.18s, background 0.18s';
  });
}