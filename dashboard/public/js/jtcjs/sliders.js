/**
 * jtc/sliders.js
 * Keeps the range sliders and their paired number inputs / display labels in sync.
 */

import { el } from './utils.js';

/**
 * Sync the user-limit slider, number input, display label, and stat card.
 * @param {number|string} val
 */
export function syncLimit(val) {
  const v = Math.min(99, Math.max(0, parseInt(val) || 0));
  const display = v === 0 ? '∞' : String(v);

  const limitDisplay = el('limitDisplay');
  const limitInput   = el('limit');
  const limitSlider  = el('limitSlider');
  const statLimit    = el('statLimit');

  if (limitDisplay) limitDisplay.textContent = display;
  if (limitInput)   limitInput.value          = v;
  if (limitSlider)  limitSlider.value         = v;
  if (statLimit)    statLimit.textContent     = display;
}

/**
 * Called by the number input's oninput — clamps then delegates to syncLimit.
 * @param {number|string} val
 */
export function syncLimitInput(val) {
  syncLimit(Math.min(99, Math.max(0, parseInt(val) || 0)));
}

/**
 * Sync the bitrate display label to the slider's current value.
 * @param {number|string} val - kbps
 */
export function syncBitrate(val) {
  const display = el('bitrateDisplay');
  if (display) display.textContent = `${val} kbps`;
}