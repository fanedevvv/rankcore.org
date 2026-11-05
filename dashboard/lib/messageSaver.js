'use strict';
/**
 * messageSaver.js
 * ─────────────────────────────────────────────────────────────────
 * MongoDB-backed saved-message store for the RankCore dashboard.
 * Replaces the old flat JSON file at data/savedMessages.json.
 *
 * Each saved message is stored per-guild with a unique nanoid-style id.
 * Schema: see Schemas/savedMessageSchema.js
 */

const SavedMessage = require('../../Schemas/savedMessageSchema');

// ─── ID generator ─────────────────────────────────────────────────────────────

function nanoid(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List all saved messages for a guild, newest first.
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
async function listMessages(guildId) {
  return SavedMessage.find({ guildId }).sort({ updatedAt: -1 }).lean();
}

/**
 * Get a single saved message.
 * @param {string} guildId
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function getMessage(guildId, id) {
  return SavedMessage.findOne({ guildId, id }).lean();
}

/**
 * Save (create or update) a message.
 * @param {string} guildId
 * @param {string} userId   - Discord ID of the saving user
 * @param {object} opts     - { id?, name, type, payload }
 * @returns {Promise<object>} the saved record
 */
async function saveMessage(guildId, userId, { id, name, type, payload }) {
  if (!name || typeof name !== 'string' || !name.trim())
    throw new Error('name is required');
  if (!['embed', 'v1', 'v2'].includes(type))
    throw new Error('type must be embed, v1, or v2');
  if (!payload || typeof payload !== 'object')
    throw new Error('payload is required');

  const trimmedName = name.trim().slice(0, 100);

  // If an id was supplied and already exists, update it — otherwise create new
  if (id) {
    const existing = await SavedMessage.findOne({ guildId, id }).lean();
    if (existing) {
      const updated = await SavedMessage.findOneAndUpdate(
        { guildId, id },
        { $set: { name: trimmedName, type, payload } },
        { new: true, lean: true }
      );
      return updated;
    }
  }

  const msgId = id || nanoid();
  const doc = await SavedMessage.create({
    id:        msgId,
    guildId,
    name:      trimmedName,
    type,
    payload,
    createdBy: userId,
  });
  return doc.toObject();
}

/**
 * Delete a saved message.
 * @param {string} guildId
 * @param {string} id
 * @returns {Promise<boolean>} true if deleted
 */
async function deleteMessage(guildId, id) {
  const result = await SavedMessage.deleteOne({ guildId, id });
  return result.deletedCount > 0;
}

/**
 * Duplicate an existing saved message under a new name.
 * @param {string} guildId
 * @param {string} id
 * @param {string} userId
 * @param {string} [newName]
 * @returns {Promise<object>} the new record
 */
async function duplicateMessage(guildId, id, userId, newName) {
  const original = await getMessage(guildId, id);
  if (!original) throw new Error('Message not found');
  return saveMessage(guildId, userId, {
    name:    newName || `${original.name} (copy)`,
    type:    original.type,
    payload: original.payload,
  });
}

/**
 * Count saved messages for a guild (for limits).
 * @param {string} guildId
 * @returns {Promise<number>}
 */
async function countMessages(guildId) {
  return SavedMessage.countDocuments({ guildId });
}

module.exports = {
  listMessages,
  getMessage,
  saveMessage,
  deleteMessage,
  duplicateMessage,
  countMessages,
};