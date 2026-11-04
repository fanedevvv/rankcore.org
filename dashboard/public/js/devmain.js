// dev.js — Main Entry Point for Developer Panel
// ─────────────────────────────────────────────────────────────────────────────

import { switchTab }                                         from './devjs/tabs.js';
import { showToast }                                          from './devjs/core.js';
import { loadServerStats }                                   from './devjs/stats.js';
import { loadBotServers, leaveServer, changeServerPage }     from './devjs/guilds.js';
import { loadIPRequests, changeIpPage }                      from './devjs/traffic.js';
import {
  loadBlacklists, filterUsers, filterServers,
  toggleUserBlacklist, removeUserBlacklist,
  toggleServerBlacklist, removeServerBlacklist,
} from './devjs/blacklist.js';
import {
  loadPremium, filterPremium,
  grantPremium, revokePremium, revokePremiumId, quickUpgrade,
  grantBranding, revokeBranding, prefillBranding,
} from './devjs/premium.js';
import { sendBroadcast }                                     from './devjs/broadcast.js';
import {
  loadCbConfig, toggleCbGlobal, toggleCbBlacklist, removeCbBlacklist,
  filterCbBlacklist, filterCbBots, cbBotAction, cbQuickBlacklist,
} from './devjs/cb.js';
import {
  loadMaintenance, updateMaintenanceBadge,
  clearETA, saveMaintenance,
} from './devjs/maintenance.js';
import {
  reloadBot, clearCache, syncCommands,
  exportLogs, confirmRestart,
  setBotPresence, clearBotPresence,
} from './devjs/actions.js';
import { loadCodes, filterCodes, generateCodes, copyGeneratedCodes, copyCode, deleteCode } from './devjs/codes.js';
import { loadNotes, onShareToggle, saveNotes, newNote, deleteNote, selectNote, selectNoteAndGoToEditor, notesPage, renderNoteList, onNoteTitleChange, notesSearch, renderAllNotes } from './devjs/notes.js';
import {
  initConsole, loadRecentLogs, clearConsole,
  togglePause, toggleAutoScroll,
  setConsoleFilter, setLevelFilter,
} from './devjs/consolelogs.js';

// ─── Re-export allBotServers for broadcast guild count ────────────────────────
import { allBotServers } from './devjs/guilds.js';
import { initGranular, startGranularPolling, stopGranularPolling } from './devjs/granular.js'

// ─── Expose globals for inline onclick= handlers in HTML ─────────────────────

window.switchTab              = switchTab;
window.showToast              = showToast;

window.filterUsers            = filterUsers;
window.filterServers          = filterServers;
window.filterPremium          = filterPremium;

window.toggleUserBlacklist    = toggleUserBlacklist;
window.removeUserBlacklist    = removeUserBlacklist;
window.toggleServerBlacklist  = toggleServerBlacklist;
window.removeServerBlacklist  = removeServerBlacklist;

window.toggleCbGlobal         = toggleCbGlobal;
window.toggleCbBlacklist      = toggleCbBlacklist;
window.removeCbBlacklist      = removeCbBlacklist;
window.filterCbBlacklist      = filterCbBlacklist;
window.filterCbBots           = filterCbBots;
window.cbBotAction            = cbBotAction;
window.cbQuickBlacklist       = cbQuickBlacklist;

window.grantPremium           = grantPremium;
window.loadCodes             = loadCodes;
window.filterCodes           = filterCodes;
window.generateCodes         = generateCodes;
window.copyGeneratedCodes    = copyGeneratedCodes;
window.copyCode              = copyCode;
window.deleteCode            = deleteCode;
window.revokePremium          = revokePremium;
window.revokePremiumId        = revokePremiumId;
window.quickUpgrade           = quickUpgrade;
window.grantBranding          = grantBranding;
window.revokeBranding         = revokeBranding;
window.prefillBranding        = prefillBranding;
window.grantGuildPremium      = async function() {
  const id       = document.getElementById('premiumGuildId')?.value.trim();
  const tier     = document.getElementById('premiumGuildTier')?.value || 'basic';
  const duration = document.getElementById('premiumGuildDuration')?.value || 'monthly';
  if (!id) return window.showToast('Guild ID required', true);
  // Reuse grant with type=guild
  const { secureFetch } = await import('./devjs/core.js');
  const res = await secureFetch('/api-dev/premium/grant', {
    method: 'POST', body: JSON.stringify({ id, type: 'guild', tier, duration }),
  }).then(r => r.json());
  if (res.error) return window.showToast(res.error, true);
  window.showToast( `✓ Guild ${tier} premium granted (${duration})!`);
  document.getElementById('premiumGuildId').value = '';
  loadPremium();
};
window.revokeGuildPremium     = async function() {
  const id = document.getElementById('premiumGuildId')?.value.trim();
  if (!id) return window.showToast('Guild ID required', true);
  const { secureFetch } = await import('./devjs/core.js');
  const res = await secureFetch('/api-dev/premium/revoke', {
    method: 'POST', body: JSON.stringify({ id, type: 'guild' }),
  }).then(r => r.json());
  if (res.error) return window.showToast(res.error, true);
  window.showToast('Guild premium revoked');
  loadPremium();
};

window.sendBroadcast          = () => sendBroadcast(allBotServers.length);

window.leaveServer            = leaveServer;
window.changeServerPage       = changeServerPage;
window.changeIpPage           = changeIpPage;

window.loadIPRequests         = loadIPRequests;

window.clearETA               = clearETA;
window.saveMaintenance        = saveMaintenance;

window.reloadBot              = reloadBot;
window.clearCache             = clearCache;
window.syncCommands           = syncCommands;
window.exportLogs             = exportLogs;
window.confirmRestart         = confirmRestart;

window.setBotPresence         = setBotPresence;
window.clearBotPresence       = clearBotPresence;
window.clearBotPresence       = clearBotPresence;

window.onShareToggle          = onShareToggle;
window.saveNotes              = saveNotes;
window.newNote                = newNote;
window.deleteNote             = deleteNote;
window.selectNote             = selectNote;
window.selectNoteAndGoToEditor = selectNoteAndGoToEditor;
window.notesPage              = notesPage;
window.renderNoteList         = renderNoteList;
window.onNoteTitleChange      = onNoteTitleChange;
window.notesSearch            = notesSearch;
window.renderAllNotes         = renderAllNotes;

window.loadRecentLogs         = loadRecentLogs;
window.clearConsole           = clearConsole;
window.togglePause            = togglePause;
window.toggleAutoScroll       = toggleAutoScroll;
window.setConsoleFilter       = setConsoleFilter;
window.setLevelFilter         = setLevelFilter;

window._granularRefresh       = () => { stopGranularPolling(); startGranularPolling(); };
window._granularStartPolling  = startGranularPolling;
window._granularStopPolling   = stopGranularPolling;

// ─── Boot ─────────────────────────────────────────────────────────────────────

var TAB_INIT = {
  overview:     [loadServerStats, loadMaintenance, loadHealth, loadChangelogs],
  reports:      [loadReports],
  blacklist:    [loadBlacklists],
  cb:           [loadCbConfig],
  premium:      [loadPremium],
  codes:        [loadCodes],
  guilds:       [loadBotServers],
  traffic:      [loadIPRequests],
  maintenance:  [loadMaintenance],
  notes:        [loadNotes],
  console:      [initConsole],
  modules:      [initModules],
  granular:     [initGranular],
  health:       [loadHealth],
  changelog:    [loadChangelogs],
  owners:       [loadOwners],
  statusevents: [seLoad],
  pagemgr:      [pmLoad],
  "analytics-db": [loadServerAnalytics],
};

function safeCall(fn) {
  try { return fn(); } catch (e) { console.warn(e); }
}

function init() {
  var active = document.querySelector('.nav-tab.active');
  var tab = active ? active.getAttribute('data-tab') : 'overview';
  var fns = TAB_INIT[tab] || [];
  fns.forEach(function (fn) { safeCall(fn); });

  setInterval(function () { safeCall(loadHealth); }, 30_000);
  setInterval(function () { safeCall(loadServerStats); }, 15_000);
}

init();
// ── New modules ───────────────────────────────────────────────────────────────
import {
  initModules, fetchModules,
  openModuleLogs, closeModuleLogs,
  startModulePolling, stopModulePolling,
} from './devjs/modules.js';
import { runLookup, quickBlacklist, quickPremium, quickRevokePremium, generateInvite } from './devjs/lookup.js';
import { loadChangelogs, publishChangelog, deleteChangelog, editChangelog, cancelEditChangelog } from './devjs/changelog.js';
import { loadReports, setReportFilter, searchReports, openReport, closeReportDetail, markReviewing, openResolveModal, closeResolveModal, submitResolve, loadReportStats } from './devjs/reports.js';
import { showToast as _showToast, setReason as _setReason, updateIndicator, switchMainTab as _switchMainTab, switchTab as _switchTab, updateExtendedStats } from './devjs/ui.js';
import { dispApply, dispPreset, dispResetColors, dispSave, dispLoad, dispSlidUpdate } from './devjs/display.js';
import { seLoad, seSetOverride, seClearOverride, seOpenIncident, seUpdateIncident, seResolveIncident } from './devjs/statusevents.js';
import { pmLoad, pmFilter, pmRender, pmDisable, pmEnable } from './devjs/pagemgr.js';
import './devjs/modulelock.js';
import './devjs/selectwrap.js';
import './devjs/globals.js';
import { loadHealth }                                                    from './devjs/health.js';
import { loadOwners, addOwner, removeOwner }                            from './devjs/owners.js';
import { loadServerAnalytics, loadPremiumAnalytics }                    from './devjs/stats.js';

window.runLookup          = runLookup;
window.quickBlacklist     = quickBlacklist;
window.quickPremium       = quickPremium;
window.quickRevokePremium = quickRevokePremium;
window.generateInvite     = generateInvite;

window.publishChangelog       = publishChangelog;
window.deleteChangelog        = deleteChangelog;
window.editChangelog          = editChangelog;
window.cancelEditChangelog    = cancelEditChangelog;
window.loadChangelogs         = loadChangelogs;

window.addOwner           = addOwner;
window.removeOwner        = removeOwner;

window.loadHealth             = loadHealth;
window.loadServerAnalytics    = loadServerAnalytics;
window.loadPremiumAnalytics   = loadPremiumAnalytics;
window.loadPremium            = loadPremium;
window.loadReports         = loadReports;
window.setReportFilter     = setReportFilter;
window.searchReports       = searchReports;
window.openReport          = openReport;
window.closeReportDetail   = closeReportDetail;
window.markReviewing       = markReviewing;
window.openResolveModal    = openResolveModal;
window.closeResolveModal   = closeResolveModal;
window.submitResolve       = submitResolve;
window.loadReportStats     = loadReportStats;
// ui.js
window.showToast           = _showToast;
window.setReason           = _setReason;
window.updateIndicator     = updateIndicator;
window.switchMainTab       = _switchMainTab;
window.switchTab           = _switchTab;
window._updateExtendedStats = updateExtendedStats;
// display.js
window.dispApply           = dispApply;
window.dispPreset          = dispPreset;
window.dispResetColors     = dispResetColors;
window.dispSave            = dispSave;
window.dispLoad            = dispLoad;
window.dispSlidUpdate      = dispSlidUpdate;
// statusevents.js
window.seLoad              = seLoad;
window.seSetOverride       = seSetOverride;
window.seClearOverride     = seClearOverride;
window.seOpenIncident      = seOpenIncident;
window.seUpdateIncident    = seUpdateIncident;
window.seResolveIncident   = seResolveIncident;
// pagemgr.js
window.pmLoad              = pmLoad;
window.pmFilter            = pmFilter;
window.pmDisable           = pmDisable;
window.pmEnable            = pmEnable;

// ── Modules tab globals ───────────────────────────────────────────────────────
window.fetchModules       = fetchModules;
window.openModuleLogs     = openModuleLogs;
window.closeModuleLogs    = closeModuleLogs;

// Patch switchMainTab to load tab data + start/stop polling when switching tabs
(function patchSwitchMainTab() {
  const _orig = window.switchMainTab;
  window.switchMainTab = function(name, el) {
    if (_orig) _orig(name, el);
    var fns = TAB_INIT[name] || [];
    fns.forEach(function (fn) { safeCall(fn); });
    if (name === 'modules') {
      startModulePolling();
    } else {
      stopModulePolling();
    }
    if (name === 'granular') {
      startGranularPolling();
    } else {
      stopGranularPolling();
    }
  };
})();