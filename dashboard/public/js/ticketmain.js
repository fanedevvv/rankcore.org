'use strict';
import { showToast }                from './ticketjs/toast.js';
import { switchTab, initTabs }      from './ticketjs/tabs.js?v=2';
import { loadChannels, loadRoles }  from './ticketjs/roleschannels.js?v=3';
import { updatePreview, syncColorPicker } from './ticketjs/embedpreview.js';
import { addCategory, removeCategory, editCategory, updateCategory } from './ticketjs/categories.js';
import { addTag, removeTag }              from './ticketjs/tags.js';
import { addBlacklistRole, removeBlacklistRole, addManageRole, removeManageRole, addPingRole, removePingRole } from './ticketjs/rolemanagement.js';
import { loadSettings, saveSettings, saveBehaviour, saveEmbed, deployPanel, disableSystem } from './ticketjs/settings.js?v=3';
import { loadTranscripts, deleteTranscript } from './ticketjs/transcripts.js';
import { loadStats } from './ticketjs/stats.js?v=2';

const guildId = location.pathname.split('/')[2];
const reload  = () => loadSettings(guildId);

// ── Expose globals for inline onclick ────────────────────────────────────────
window.switchTab    = (tab) => switchTab(tab, guildId);
window.updatePreview    = updatePreview;
window.syncColorPicker  = syncColorPicker;

window.saveSettings  = () => saveSettings(guildId, reload);
window.saveBehaviour = () => saveBehaviour(guildId);
window.saveEmbed     = () => saveEmbed(guildId);
window.deployPanel   = () => deployPanel(guildId);
window.disableSystem = () => disableSystem(guildId, reload);

window.addCategory    = () => addCategory(guildId, reload);
window.removeCategory = (val) => removeCategory(guildId, val, reload);
window.editCategory   = (val) => editCategory(guildId, val, reload);
window.updateCategory = (val) => updateCategory(guildId, val, reload);

window.addTag    = () => addTag(guildId, reload);
window.removeTag = (encoded) => removeTag(guildId, encoded, reload);

window.addBlacklistRole    = () => addBlacklistRole(guildId, reload);
window.removeBlacklistRole = (id) => removeBlacklistRole(guildId, id, reload);
window.addManageRole       = () => addManageRole(guildId, reload);
window.removeManageRole    = (id) => removeManageRole(guildId, id, reload);
window.addPingRole         = () => addPingRole(guildId, reload);
window.removePingRole      = (id) => removePingRole(guildId, id, reload);

window.loadTranscripts  = () => loadTranscripts(guildId);
window.deleteTranscript = (id) => deleteTranscript(guildId, id, () => loadTranscripts(guildId));

// ── Boot ─────────────────────────────────────────────────────────────────────
async function init() {
  initTabs();
  await Promise.all([loadChannels(guildId), loadRoles(guildId)]);
  await loadSettings(guildId);
  loadStats(guildId);
}

init();
