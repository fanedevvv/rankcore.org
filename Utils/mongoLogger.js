const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();
const theme = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
    gray: "\x1b[90m"
};
const sep = theme.gray + '-------------------------------------------' + theme.reset;

// -------------------------------
// Console Logger
// -------------------------------
function logStep(label, message, color = theme.cyan) {
    console.log(sep);
    console.log(`${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset} ${color}${theme.bright}[${label}]${theme.reset} ${message}`);
    console.log(sep);
}

const webhookURL = process.env.MONGO_WEBHOOK;

if (!webhookURL) {
    console.warn(`${theme.yellow}[WARN] MONGO_WEBHOOK not set in .env${theme.reset}`);
}

// SEC-FIX: Redact known sensitive fields before logging documents to Discord.
// Full document dumps can expose tokens, passwords, emails, and other PII.
const SENSITIVE_KEYS = new Set([
    'token', 'secret', 'password', 'hash', 'salt', 'key', 'apiKey',
    'accessToken', 'refreshToken', 'webhookUrl', 'webhook',
    'email', 'ip', 'encryptedToken',
]);
const MAX_JSON_LENGTH = 1800; // Discord embed description limit is 4096; keep comfortable margin

function sanitizeDoc(obj, depth = 0) {
    if (depth > 10 || obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.slice(0, 5).map(v => sanitizeDoc(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase()) || SENSITIVE_KEYS.has(k)) {
            out[k] = '[REDACTED]';
        } else {
            out[k] = sanitizeDoc(v, depth + 1);
        }
    }
    return out;
}

function safeJsonDoc(doc) {
    try {
        const raw = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
        const sanitized = sanitizeDoc(raw);
        let json = JSON.stringify(sanitized, null, 2);
        if (json.length > MAX_JSON_LENGTH) {
            json = json.slice(0, MAX_JSON_LENGTH) + '\n...(truncated)';
        }
        return '```json\n' + json + '\n```';
    } catch {
        return '```[Could not serialize document]```';
    }
}

// Helper to send Discord embed
async function sendEmbed(title, description, color = 0x00FFFF) {
    if (!webhookURL) return;

    try {
        await axios.post(webhookURL, {
            embeds: [
                {
                    title,
                    description,
                    color,
                    timestamp: new Date().toISOString()
                }
            ]
        });
    } catch (err) {
        console.error(`${theme.red}[ERROR] Failed to send MongoDB embed: ${err.message}${theme.reset}`);
    }
}

// Attach logger to a schema
function attachMongoLogger(schema, collectionName) {

    // CREATE
    schema.post('save', async function (doc) {
        try {
            const json = safeJsonDoc(doc);
            const title = `<:LEgreen:1567796933307666515> [${collectionName}] Document Created`;

            logStep('MONGO', `${collectionName} CREATED: ${doc._id}`, theme.green);
            await sendEmbed(title, json, 0x57F287);
        } catch (err) {
            console.error(`${theme.red}[ERROR] Mongo CREATE log failed: ${err.message}${theme.reset}`);
        }
    });

    // UPDATE
    schema.post('findOneAndUpdate', async function (doc) {
        try {
            const json = safeJsonDoc(doc);
            const title = `<:error:1567796968758050868> [${collectionName}] Document Updated`;

            logStep('MONGO', `${collectionName} UPDATED: ${doc?._id}`, theme.yellow);
            await sendEmbed(title, json, 0xFEE75C);
        } catch (err) {
            console.error(`${theme.red}[ERROR] Mongo UPDATE log failed: ${err.message}${theme.reset}`);
        }
    });

    // DELETE
    schema.post('findOneAndDelete', async function (doc) {
        try {
            const json = safeJsonDoc(doc);
            const title = `<:LEred:1567796934545121280> [${collectionName}] Document Deleted`;

            logStep('MONGO', `${collectionName} DELETED: ${doc?._id}`, theme.red);
            await sendEmbed(title, json, 0xED4245);
        } catch (err) {
            console.error(`${theme.red}[ERROR] Mongo DELETE log failed: ${err.message}${theme.reset}`);
        }
    });

    // DELETE MANY
    schema.post('deleteMany', async function (result) {
        try {
            const title = `<:LEred:1567796934545121280> [${collectionName}] Multiple Documents Deleted`;
            const description = `Deleted Count: ${result.deletedCount || 'Unknown'}`;

            logStep('MONGO', `${collectionName} deleted many documents`, theme.red);
            await sendEmbed(title, description, 0xED4245);
        } catch (err) {
            console.error(`${theme.red}[ERROR] Mongo BULK DELETE log failed: ${err.message}${theme.reset}`);
        }
    });

    // Global error catcher
    schema.post(/^/, async function (error, res, next) {
        try {
            if (error) {
                logStep('MONGO ERROR', `Error in ${collectionName}: ${error.message}`, theme.red);
                const title = `<:crossy:1567796959648030831> [${collectionName}] Mongo Error`;
                await sendEmbed(title, error.message, 0x992D22);
            }
        } catch (err) {
            console.error(`${theme.red}[ERROR] Mongo ERROR log failed: ${err.message}${theme.reset}`);
        } finally {
            next?.(error);
        }
    });
}

// Automatically load all schemas from a folder
function setupMongoLogging(schemasFolder = path.join(__dirname, '../Schemas')) {
    try {
        const files = fs.readdirSync(schemasFolder).filter(f => f.endsWith('.js'));
        if (!files.length) {
            console.warn(`${theme.yellow}[WARN] No schemas found in ${schemasFolder}${theme.reset}`);
            return;
        }

        files.forEach(file => {
            try {
                const schemaObj = require(path.join(schemasFolder, file));
                const collectionName = schemaObj.modelName || path.basename(file, '.js');
                attachMongoLogger(schemaObj.schema || schemaObj, collectionName);
                logStep('MONGO', `Attached logger for ${collectionName}`, theme.cyan);
            } catch (err) {
                console.error(`${theme.red}[ERROR] Failed to attach logger for ${file}: ${err.message}${theme.reset}`);
            }
        });
    } catch (err) {
        console.error(`${theme.red}[ERROR] Failed to read Schemas folder: ${err.message}${theme.reset}`);
    }
}

module.exports = { attachMongoLogger, setupMongoLogging };
