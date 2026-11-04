/**
 * jtc/naming.js
 * Channel name template — variable insertion and live preview rendering.
 */

import { el } from './utils.js';

/** Sample values used to render the live preview */
const PREVIEW_VALUES = {
  '{username}':    'CoolGamer',
  '{displayname}': 'Cool Gamer 🎮',
  '{game}':        'Minecraft',
  '{count}':       '3',
  '{server}':      'My Discord',
  '{date}':        new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
};

/**
 * Insert a variable placeholder at the cursor position in the name template input,
 * then refresh the preview.
 * @param {string} variable - e.g. '{username}'
 */
export function insertVar(variable) {
  const input = el('nameTemplate');
  if (!input) return;

  const start  = input.selectionStart;
  const end    = input.selectionEnd;
  input.value  = input.value.slice(0, start) + variable + input.value.slice(end);
  const cursor = start + variable.length;
  input.setSelectionRange(cursor, cursor);
  input.focus();
  updatePreview();
}

/**
 * Re-render the live preview box from the current template value.
 * Called on every keystroke and after config is applied.
 */
export function updatePreview() {
  const template = el('nameTemplate')?.value || "{username}'s Channel";
  let preview = template;
  for (const [key, val] of Object.entries(PREVIEW_VALUES)) {
    preview = preview.replaceAll(key, val);
  }
  const box = el('namePreview');
  if (box) box.textContent = preview ? `🔊 ${preview}` : '🔊 Channel name preview...';
}

/**
 * Wire the live preview to the nameTemplate input's input event.
 * Call once during page init.
 */
export function initNaming() {
  el('nameTemplate')?.addEventListener('input', updatePreview);
  updatePreview();
}