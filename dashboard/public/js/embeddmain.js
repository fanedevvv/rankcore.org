// ─── Main Entry Point ─────────────────────────────────────────────────────────

import { loadChannels }                                   from './embedjs/state.js';
import { switchMode, toggleAccordion }                    from './embedjs/tabs.js';
import { updatePreview, addField, setColor, initColorSync } from './embedjs/preview.js';
import {
  addV1Row, addEmbedBtnRow, addV1Button,
  toggleV1BtnFields, updateV1Preview,
  toggleActionFields, saveButtonAction,
} from './embedjs/v1builder.js';
import {
  addV2Block, toggleSectionAccessory,
  addGalleryItem, addV2RowButton,
  onV2BtnStyleChange, updateV2Preview,
} from './embedjs/v2builder.js';
import {
  openSavedPanel, closeSavedPanel,
  loadSavedMessage, sendSavedMessage,
  deleteSaved, duplicateSaved,
  renderSaved, saveCurrentMessage,
  closeSaveDialog, confirmSave,
  openTemplatesPanel, closeTemplatesPanel,
  renderTemplatesPanel, loadFromTemplate,
} from './embedjs/saved.js';
import { sendMessage, copyJSON, resetAll } from './embedjs/sender.js';

const guildId = location.pathname.split('/')[2];

// ─── Globals for inline onclick handlers ─────────────────────────────────────

window.switchMode      = switchMode;
window.toggleAccordion = toggleAccordion;

window.updatePreview   = updatePreview;
window.addField        = addField;
window.setColor        = setColor;

window.updatePlainCounter = function () {
  const inp = document.getElementById('plainMessage');
  const ctr = document.getElementById('plainCounter');
  if (!inp || !ctr) return;
  const len = inp.value.length;
  ctr.textContent = `${len}/2000`;
  ctr.style.color = len > 2000 ? '#f87171' : '';
};

// V1 rows
window.addV1Row         = addV1Row;
window.addEmbedBtnRow   = addEmbedBtnRow;
window.addV1Button      = addV1Button;
window.toggleV1BtnFields = toggleV1BtnFields;
window.updateV1Preview  = updateV1Preview;

// Button actions (shared V1 + V2)
window.toggleActionFields = toggleActionFields;
window.saveButtonAction   = saveButtonAction;

// V2 blocks
window.addV2Block             = addV2Block;
window.toggleSectionAccessory = toggleSectionAccessory;
window.addGalleryItem         = addGalleryItem;
window.addV2RowButton         = addV2RowButton;
window.onV2BtnStyleChange     = onV2BtnStyleChange;
window.updateV2Preview        = updateV2Preview;

// Saved messages
window.openSavedPanel   = () => openSavedPanel(guildId);
window.closeSavedPanel  = closeSavedPanel;
window.renderSaved      = renderSaved;
window.loadSavedMessage = id => loadSavedMessage(id);
window.sendSavedMessage = id => sendSavedMessage(id, guildId);
window.deleteSaved      = id => deleteSaved(id, guildId);
window.duplicateSaved   = id => duplicateSaved(id, guildId);
window.saveCurrentMessage = saveCurrentMessage;
window.closeSaveDialog  = closeSaveDialog;
window.confirmSave      = () => confirmSave(guildId);

// Templates panel
window.openTemplatesPanel   = () => openTemplatesPanel(guildId);
window.closeTemplatesPanel  = closeTemplatesPanel;
window.renderTemplatesPanel = renderTemplatesPanel;
window.loadFromTemplate     = id => loadFromTemplate(id);

// Send / copy / reset
window.sendMessage = () => sendMessage(guildId);
window.copyJSON    = copyJSON;
window.resetAll    = resetAll;

// Tooltip hover fix for dynamically-created action panels
document.addEventListener('mouseover', e => {
  const helpBtn = e.target.closest('.help-btn');
  if (!helpBtn) return;
  const tip = helpBtn.nextElementSibling;
  if (tip?.classList.contains('tip-box')) tip.style.opacity = '1';
});
document.addEventListener('mouseout', e => {
  const helpBtn = e.target.closest('.help-btn');
  if (!helpBtn) return;
  const tip = helpBtn.nextElementSibling;
  if (tip?.classList.contains('tip-box')) tip.style.opacity = '0';
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  initColorSync();
  await loadChannels(guildId);
  updatePreview();
}

init();