// ─── Advanced AutoMod — Main Entry Point ──────────────────────────────────────
// Mirrors the pattern used by countingmain.js / confessionmain.js etc.
// Everything the HTML's inline onclick= handlers need is hung on window here.

import { rateRules, warnSteps, wordGroups, linkGroups, regexRules } from './advancedautomodjs/state.js';
import { toast }                  from './advancedautomodjs/toast.js';
import { esc, toggleFilterSection } from './advancedautomodjs/helpers.js';
import {
  renderAllConditions, renderConditions,
  toggleCondDetail, updateCondLabel,
  updateRule, addCondition, removeCondition,
} from './advancedautomodjs/conditions.js';
import {
  manageRoles, manageChannels,
  closeExemptModal, onExemptModeChange,
  addExemptId, removeExemptId,
  exemptPickerSearch,
} from './advancedautomodjs/exemptModal.js';
import { renderWarnSteps, addWarnStep, removeWarnStep } from './advancedautomodjs/warnSteps.js';
import { renderWordGroups, addWordGroup, removeWordGroup, addWordToGroup, removeWordFromGroup } from './advancedautomodjs/wordGroups.js';
import { renderLinkGroups, addLinkGroup, removeLinkGroup, addDomainToGroup, removeDomainFromGroup } from './advancedautomodjs/linkGroups.js';
import { renderRegexRules, addRegexRule, removeRegexRule, testRegex } from './advancedautomodjs/regexRules.js';
import { load, save } from './advancedautomodjs/api.js';

// ── Expose live state arrays so inline onchange= handlers can mutate them ──────
// e.g. onchange="window.warnSteps[0].action = this.value"
window.rateRules  = rateRules;
window.warnSteps  = warnSteps;
window.wordGroups = wordGroups;
window.linkGroups = linkGroups;
window.regexRules = regexRules;

// ── Expose functions called from HTML onclick / onchange ───────────────────────
window.toast                = toast;
window.esc                  = esc;
window.toggleFilterSection  = toggleFilterSection;

// Conditions
window.renderAllConditions  = renderAllConditions;
window.renderConditions     = renderConditions;
window.toggleCondDetail     = toggleCondDetail;
window.updateCondLabel      = updateCondLabel;
window.updateRule           = updateRule;
window.addCondition         = addCondition;
window.removeCondition      = removeCondition;

// Exempt modal
window.manageRoles          = manageRoles;
window.manageChannels       = manageChannels;
window.closeExemptModal     = closeExemptModal;
window.onExemptModeChange   = onExemptModeChange;
window.addExemptId          = addExemptId;
window.removeExemptId       = removeExemptId;
window.exemptPickerSearch   = exemptPickerSearch;

// Warn steps
window.renderWarnSteps      = renderWarnSteps;
window.addWarnStep          = addWarnStep;
window.removeWarnStep       = removeWarnStep;

// Word groups
window.renderWordGroups     = renderWordGroups;
window.addWordGroup         = addWordGroup;
window.removeWordGroup      = removeWordGroup;
window.addWordToGroup       = addWordToGroup;
window.removeWordFromGroup  = removeWordFromGroup;

// Link groups
window.renderLinkGroups     = renderLinkGroups;
window.addLinkGroup         = addLinkGroup;
window.removeLinkGroup      = removeLinkGroup;
window.addDomainToGroup     = addDomainToGroup;
window.removeDomainFromGroup = removeDomainFromGroup;

// Regex rules
window.renderRegexRules     = renderRegexRules;
window.addRegexRule         = addRegexRule;
window.removeRegexRule      = removeRegexRule;
window.testRegex            = testRegex;

// Save
window.save = save;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', load);