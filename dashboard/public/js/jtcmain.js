/**
 * jtc/main.js
 * Entry point — imports all modules, boots the dashboard on DOMContentLoaded,
 * and exposes functions that HTML inline handlers (onclick/oninput) need.
 */

import { guildId, showToast, populateSelect, setStatus } from './jtcjs/utils.js';
import { switchTab }                                      from './jtcjs/tabs.js';
import { syncLimit, syncLimitInput, syncBitrate }        from './jtcjs/sliders.js';
import { insertVar, initNaming }                         from './jtcjs/naming.js';
import { initToggles,
         togglePanelOptions, toggleLogOptions,
         toggleWelcomeOptions }                          from './jtcjs/toggles.js?v=3';
import { applyConfig, collectPayload, validatePayload }  from './jtcjs/form.js?v=3';
import { fetchInitialData, saveConfig, resetConfig }     from './jtcjs/api.js?v=3';

// ──────────────────────────────────────────────────────────────
// Expose to global scope (needed by HTML inline onclick/oninput)
// ──────────────────────────────────────────────────────────────

Object.assign(window, {
  // Navigation
  switchTab,

  // Sliders
  syncLimit,
  syncLimitInput,
  syncBitrate,

  // Naming
  insertVar,

  // Toggles (called by onchange attributes)
  togglePanelOptions,
  toggleLogOptions,
  toggleWelcomeOptions,

  // Actions
  save,
  resetForm,
  disable,
});

// ──────────────────────────────────────────────────────────────
// Initialisation
// ──────────────────────────────────────────────────────────────

async function init() {
  try {
    const { categories, channels, textChannels, roles, config } = await fetchInitialData();

    // Voice channels come from /voice-channels, text channels from /channels
    const voiceList = channels;
    const textList  = textChannels.map(c => ({ ...c, name: '#' + c.name }));

    // Populate selects
    populateSelect('category',    categories, 'Select a category…');
    populateSelect('channel',     voiceList,  'Select a voice channel…');
    populateSelect('panelChannel', textList,  'Select a channel…');
    populateSelect('logChannel',   textList,  'Select a channel…');
    populateSelect('requiredRole', roles,     'No requirement (everyone)');
    populateSelect('blacklistRole', roles,    'None');

    // Apply saved config if present
    if (config) {
      applyConfig(config);
      setStatus(!!(config.Channel && config.Category));
    }

    // Boot sub-modules
    initNaming();
    initToggles();

  } catch (err) {
    console.error('[JTC] init failed:', err);
    showToast('Failed to load server data', 'error');
  }
}

// ──────────────────────────────────────────────────────────────
// Save
// ──────────────────────────────────────────────────────────────

async function save() {
  const btn = document.getElementById('saveBtn');
  if (!btn) return;
  btn.disabled    = true;
  btn.textContent = '⏳ Saving…';

  try {
    const payload = collectPayload(guildId);
    const err     = validatePayload(payload);
    if (err) { showToast(err, 'warn'); return; }

    const result = await saveConfig(payload);
    setStatus(true);
    if (result?.panel?.posted === false) showToast(`Saved, but the panel wasn't posted: ${result.panel.error}`, 'warn');
    else if (result?.panel?.posted) showToast('Saved — the permanent panel is posted ✓', 'success');
    else showToast('Settings saved successfully!', 'success');
  } catch (e) {
    console.error('[JTC] save failed:', e);
    showToast('Failed to save changes', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Settings';
  }
}

// ──────────────────────────────────────────────────────────────
// Discard changes (reload config from server)
// ──────────────────────────────────────────────────────────────

async function resetForm() {
  try {
    const { config } = await fetchInitialData();
    if (config) {
      applyConfig(config);
      showToast('Changes discarded', 'warn');
    } else {
      showToast('No saved config to reload', 'warn');
    }
  } catch {
    showToast('Could not reload config', 'error');
  }
}

// ──────────────────────────────────────────────────────────────
// Reset / delete config
// ──────────────────────────────────────────────────────────────

async function disable() {
  const confirmed = confirm(
    '⚠️ Are you sure you want to reset the Join To Create configuration for this server?\n\n' +
    'This will stop all channel automation. Active channels will not be affected.'
  );
  if (!confirmed) return;

  try {
    await resetConfig();
    setStatus(false);
    showToast('Configuration reset', 'warn');
    setTimeout(() => location.reload(), 1200);
  } catch {
    showToast('Failed to reset configuration', 'error');
  }
}

// ──────────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);