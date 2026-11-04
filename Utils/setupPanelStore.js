/**
 * setupPanelStore.js
 *
 * A global Map that stores the context needed to handle button/modal interactions
 * for setup command panels — replacing ephemeral message-component collectors.
 *
 * Key:   message.id  (the panel message)
 * Value: { interaction, accent, guildId, userId, command, data?, pageState? }
 *
 * Because this lives in the module cache it persists for the bot's lifetime and
 * survives across slash-command invocations, so buttons never "expire".
 *
 * modalStore maps  `${userId}:${guildId}` → { messageId, command, ... }
 * so modal submits can locate the owning panel even though Discord doesn't give
 * us the original message ID in a modal submit.
 */

const panelStore = new Map();   // messageId → PanelEntry
const modalStore = new Map();   // `${userId}:${guildId}` → { messageId, command }

/**
 * Register a newly-opened setup panel.
 *
 * @param {string}      messageId   - ID of the panel message
 * @param {object}      entry       - { interaction, accent, guildId, userId, command, data? }
 */
function registerPanel(messageId, entry) {
  panelStore.set(messageId, entry);
}

/** Retrieve a panel entry by message ID. */
function getPanel(messageId) {
  return panelStore.get(messageId) || null;
}

/** Update `data` on an existing panel entry. */
function updatePanelData(messageId, data) {
  const entry = panelStore.get(messageId);
  if (entry) entry.data = data;
}

/** Register the modal context so a modal submit can find its panel. */
function registerModal(userId, guildId, messageId, command, extra = {}) {
  modalStore.set(`${userId}:${guildId}`, { messageId, command, ...extra });
}

/** Retrieve modal context for a user in a guild. */
function getModal(userId, guildId) {
  return modalStore.get(`${userId}:${guildId}`) || null;
}

/** Clear modal context after use. */
function clearModal(userId, guildId) {
  modalStore.delete(`${userId}:${guildId}`);
}

module.exports = { registerPanel, getPanel, updatePanelData, registerModal, getModal, clearModal };
