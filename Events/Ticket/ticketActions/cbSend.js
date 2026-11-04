'use strict';

const { apiPost } = require('../../../dashboard/lib/botClient');
const cbm         = require('../../../src/core/CustomBrandingManager');

/**
 * Sends a message to a channel, routing through the Custom Branding API when
 * active and falling back to the standard Discord.js channel.send() otherwise.
 *
 * @param {string}  guildId
 * @param {import('discord.js').TextChannel} channel
 * @param {object}  payload
 * @returns {Promise<string|null>} The sent message ID, or null on failure.
 */
async function cbSendToChannel(guildId, channel, payload) {
  const norm = {
    ...payload,
    embeds:     payload.embeds?.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
    components: payload.components?.map(c => (typeof c.toJSON === 'function' ? c.toJSON() : c)),
  };
  try {
    if (cbm.isActive(guildId)) {
      const result = await apiPost('/internal/cb/send', { guildId, channelId: channel.id, payload: norm });
      if (result?.messageId) return result.messageId;
      console.warn(`[Ticket CB Send] failed: ${result?.error ?? 'unknown'} — falling back to Roco`);
    }
  } catch (err) {
    console.warn(`[Ticket CB Send] CB error: ${err.message} — falling back`);
  }
  const msg = await channel.send(payload);
  return msg?.id ?? null;
}

module.exports = { cbSendToChannel };