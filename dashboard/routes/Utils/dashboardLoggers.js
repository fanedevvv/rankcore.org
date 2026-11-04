'use strict';
/**
 * dashboard/routes/Utils/dashboardLoggers.js
 *
 * MongoDB-backed loggers for the Roco dashboard.
 * Replaces the old flat JSON files:
 *   - dashboard/logs/embed_sends.json
 *   - dashboard/logs/verify/verify_sends.json
 *
 * Schemas: Schemas/dashboardLogSchema.js (EmbedSendLog, VerifySendLog)
 * Request logs remain in-memory (short-lived, dev dashboard only).
 */

const axios = require('axios');
const { EmbedSendLog, VerifySendLog } = require('../../../Schemas/dashboardLogSchema');

// ─── In-memory request logs (dev dashboard only, never persisted) ─────────────
let requestLogs = [];
const MAX_LOGS  = 50;

function addRequestLog(entry) {
  requestLogs.unshift(entry);
  if (requestLogs.length > MAX_LOGS) requestLogs.pop();
}

function getRequestLogs() {
  return requestLogs;
}

// ─── Embed send logger ────────────────────────────────────────────────────────

async function logEmbedSend(entry) {
  try {
    await EmbedSendLog.create({
      userId:    entry.userId,
      guildId:   entry.guildId,
      channelId: entry.channelId,
      command:   entry.command,
      content:   entry.content   || null,
      embed:     entry.embed     || null,
      components:entry.components|| null,
      messageId: entry.messageId || null,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    });
  } catch (err) {
    console.error('[dashboardLoggers] Failed to save embed log:', err.message);
  }

  // Discord webhook notification (unchanged behaviour)
  if (process.env.EMBED_SEND_LOG) {
    axios.post(process.env.EMBED_SEND_LOG, {
      embeds: [{
        title:  '📨 Embed Sent via Dashboard',
        color:  0x2b2d31,
        fields: [
          { name: 'User ID',    value: entry.userId,    inline: true },
          { name: 'Guild ID',   value: entry.guildId,   inline: true },
          { name: 'Channel ID', value: entry.channelId, inline: true },
          { name: 'Command',    value: entry.command,   inline: true },
          { name: 'Content',    value: entry.content
              ? `\`\`\`${entry.content.slice(0, 900)}\`\`\``
              : '*None*' },
          { name: 'Embed Data', value: entry.embed
              ? `\`\`\`json\n${JSON.stringify(entry.embed, null, 2).slice(0, 900)}\n\`\`\``
              : '*None*' },
        ],
        footer:    { text: `Message ID: ${entry.messageId}` },
        timestamp: entry.timestamp,
      }],
    }).catch(() => {});
  }
}

// ─── Verify send logger ───────────────────────────────────────────────────────

async function logVerifyAction(entry) {
  try {
    await VerifySendLog.create({
      userId:    entry.userId,
      guildId:   entry.guildId,
      channelId: entry.channelId,
      messageId: entry.messageId || null,
      command:   entry.command,
      embed:     entry.embed  || null,
      fields:    entry.fields || null,
      footer:    entry.footer || null,
      timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
    });
  } catch (err) {
    console.error('[dashboardLoggers] Failed to save verify log:', err.message);
  }

  // Discord webhook notification (unchanged behaviour)
  if (process.env.VERIFY_LOG_WEBHOOK_URL) {
    axios.post(process.env.VERIFY_LOG_WEBHOOK_URL, {
      embeds: [{
        title:     '🔒 Verification Panel Sent',
        color:     0x6C53FF,
        fields:    entry.fields,
        footer:    entry.footer,
        timestamp: entry.timestamp,
      }],
    }).catch(() => {});
  }
}

// ─── Formatting helpers (unchanged) ──────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k     = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
  logEmbedSend,
  logVerifyAction,
  formatBytes,
  formatUptime,
  addRequestLog,
  getRequestLogs,
};