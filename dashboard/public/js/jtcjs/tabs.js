/**
 * jtc/tabs.js
 * Tab navigation — activates the correct pane and highlights the correct button.
 */

import { el } from './utils.js';

/**
 * Switch the visible tab pane.
 * @param {string} name - matches data-tab attribute and tab-{name} pane id
 */
export function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  el(`tab-${name}`)?.classList.add('active');
  document.querySelector(`[data-tab="${name}"]`)?.classList.add('active');
}