// Utils/webhookLogger.js
const axios = require('axios');

const webhookURL = process.env.DISCORD_LOG_WEBHOOK;
const queue = [];
let isSending = false;
const MAX_DISCORD_LENGTH = 1900; // safe limit

/**
 * Internal function to send the next message in the queue
 */
async function sendNext() {
    if (!queue.length) {
        isSending = false;
        return;
    }

    isSending = true;
    const { messageChunks, resolve, reject } = queue.shift();

    try {
        for (const chunk of messageChunks) {
            await axios.post(webhookURL, {
                content: `\`\`\`[BOT LOG]\n${chunk}\n\`\`\``
            });
        }
        resolve();
    } catch (err) {
        if (err.response?.status === 429) {
            const retryAfter = err.response.data.retry_after || 1000;
            console.warn(`Rate limited! Retrying after ${retryAfter}ms`);
            queue.unshift({ messageChunks, resolve, reject });
            setTimeout(sendNext, retryAfter);
            return;
        } else {
            console.error('Failed to send log to Discord webhook:', err.message);
            reject(err);
        }
    }

    setTimeout(sendNext, 250);
}

/**
 * Split a large message into chunks under Discord limit
 */
function chunkMessage(message) {
    const chunks = [];
    for (let i = 0; i < message.length; i += MAX_DISCORD_LENGTH) {
        chunks.push(message.slice(i, i + MAX_DISCORD_LENGTH));
    }
    return chunks;
}

/**
 * Filter out Lavalink logs
 */
function shouldIgnore(message) {
    return typeof message === 'string' && (
        message.includes('Lavalink') ||
        message.includes('[MUSIC] Lavalink')
    );
}

/**
 * Adds a message to the queue to send to Discord
 */
function sendLogToWebhook(message) {
    if (!webhookURL || shouldIgnore(message)) return Promise.resolve();

    const messageChunks = chunkMessage(message);

    return new Promise((resolve, reject) => {
        queue.push({ messageChunks, resolve, reject });
        if (!isSending) sendNext();
    });
}

module.exports = { sendLogToWebhook };
