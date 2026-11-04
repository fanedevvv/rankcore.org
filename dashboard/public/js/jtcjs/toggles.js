/**
 * jtc/toggles.js
 * Manages conditional show/hide of sub-sections that depend on a parent checkbox:
 *   - Control Panel options  (depends on #panelEnabled)
 *   - Panel destination row  (depends on #panelDest value)
 *   - Log options            (depends on #logEnabled)
 *   - Welcome message opts   (depends on #welcomeEnabled)
 */

import { el } from './utils.js';

/** Enable or disable a container block based on a boolean. */
function setSection(containerEl, enabled) {
  if (!containerEl) return;
  containerEl.style.opacity       = enabled ? '1'    : '0.4';
  containerEl.style.pointerEvents = enabled ? ''     : 'none';
}

// ── Panel ──────────────────────────────────────────────────────

/**
 * Reflect the state of #panelEnabled onto the options block.
 * Also wires the destination <select> watcher (idempotent).
 */
export function togglePanelOptions() {
  const on = el('panelEnabled')?.checked ?? false;
  setSection(el('panelOptions'), on);
  if (on) watchPanelDest();
}

/**
 * Show / hide the "Panel Text Channel" row depending on the
 * selected panel destination. Safe to call multiple times —
 * the event listener is only added on the first call.
 */
export function watchPanelDest() {
  const dest = el('panelDest');
  if (!dest || dest._jtcWatched) return;
  dest._jtcWatched = true;

  const update = () => {
    const row = el('panelChannelRow');
    if (row) row.style.display = (dest.value === 'textchannel' || dest.value === 'persistent') ? '' : 'none';
    const hint = el('panelPersistentHint');
    if (hint) hint.style.display = dest.value === 'persistent' ? '' : 'none';
  };
  update();
  dest.addEventListener('change', update);
}

// ── Logging ────────────────────────────────────────────────────

/** Reflect the state of #logEnabled onto the log options block. */
export function toggleLogOptions() {
  setSection(el('logOptions'), el('logEnabled')?.checked ?? false);
}

// ── Welcome message ────────────────────────────────────────────

/** Reflect the state of #welcomeEnabled onto the welcome options block. */
export function toggleWelcomeOptions() {
  setSection(el('welcomeOptions'), el('welcomeEnabled')?.checked ?? false);
}

/**
 * Wire all toggle checkboxes to their handlers.
 * Call once during page init.
 */
export function initToggles() {
  el('panelEnabled')?.addEventListener('change', togglePanelOptions);
  el('logEnabled')?.addEventListener('change', toggleLogOptions);
  el('welcomeEnabled')?.addEventListener('change', toggleWelcomeOptions);

  // Apply initial state
  togglePanelOptions();
  toggleLogOptions();
  toggleWelcomeOptions();
}