// ─────────────────────────────────────────────────────────────────────────────
//  Vision Client - Gemini 1.5 Flash
//  Handles image and file attachments from Discord messages.
//  Falls back gracefully if GEMINI_API_KEY is not set.
// By Sejed TRABELSSI (Github: SEJED-DEV | Discord: sejed.dev) - 25/05/2026
// ─────────────────────────────────────────────────────────────────────────────

const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// Supported image MIME types from Discord CDN
const SUPPORTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
];

// Supported file types for text extraction
const SUPPORTED_TEXT_TYPES = [
    "text/plain",
    "application/json",
    "text/markdown",
    "text/csv",
];

const GEMINI_VISION_MODEL = "gemini-1.5-flash";
const MAX_IMAGE_SIZE_MB   = 10;  

let _geminiClient = null;

function getGemini() {
    if (_geminiClient) return _geminiClient;
    const apiKey = process.env.GEMINI_API_KEY || process.env.gemini_api;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env");
    _geminiClient = new GoogleGenerativeAI(apiKey);
    return _geminiClient;
}

/**
 * Download a Discord attachment as a base64 buffer.
 * @param {string} url  - The Discord CDN URL of the attachment.
 * @returns {Promise<{ data: string, mimeType: string }>}
 */
async function downloadAttachment(url, mimeType) {
    const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15_000,
        maxContentLength: MAX_IMAGE_SIZE_MB * 1024 * 1024,
    });
    const base64 = Buffer.from(response.data).toString("base64");
    return { data: base64, mimeType };
}

/**
 * Download a text-based file attachment as a plain string.
 * @param {string} url
 * @returns {Promise<string>}
 */
async function downloadTextFile(url) {
    const response = await axios.get(url, {
        responseType: "text",
        timeout: 10_000,
        maxContentLength: 500 * 1024, 
    });
    return response.data;
}

/**
 * Analyse one or more Discord attachments using Gemini Vision.
 *
 * @param {string}   systemPrompt   - The bot's current system prompt (personality + modes).
 * @param {object[]} historyMsgs    - Prior conversation turns in { role, content } format.
 * @param {string}   userMessage    - The user's text message (may be empty if they only sent an image).
 * @param {import("discord.js").Collection} attachments - message.attachments collection.
 * @returns {Promise<string>} The assistant's reply.
 */
async function askVision(systemPrompt, historyMsgs, userMessage, attachments) {
    const gemini = getGemini();
    const model  = gemini.getGenerativeModel({ model: GEMINI_VISION_MODEL });

    const parts = [];

    if (historyMsgs.length > 0) {
        const historyText = historyMsgs
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");
        parts.push({ text: `Previous conversation:\n${historyText}\n\n` });
    }

    parts.push({ text: `[System Instructions]\n${systemPrompt}\n\n` });

    let attachmentCount = 0;
    for (const [, attachment] of attachments) {
        const contentType = attachment.contentType?.split(";")[0]?.trim() || "";

        if (SUPPORTED_IMAGE_TYPES.includes(contentType)) {
            if (attachment.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                parts.push({ text: `[Note: Image "${attachment.name}" was skipped - too large (>${MAX_IMAGE_SIZE_MB}MB)]\n` });
                continue;
            }

            try {
                const imgData = await downloadAttachment(attachment.url, contentType);
                parts.push({ inlineData: imgData });
                attachmentCount++;
            } catch (err) {
                parts.push({ text: `[Note: Could not load image "${attachment.name}": ${err.message}]\n` });
            }

        } else if (SUPPORTED_TEXT_TYPES.includes(contentType)) {
            try {
                const text = await downloadTextFile(attachment.url);
                const preview = text.length > 8000 ? text.slice(0, 8000) + "\n...(truncated)" : text;
                parts.push({ text: `[File: ${attachment.name}]\n\`\`\`\n${preview}\n\`\`\`\n` });
                attachmentCount++;
            } catch (err) {
                parts.push({ text: `[Note: Could not read file "${attachment.name}": ${err.message}]\n` });
            }

        } else {
            parts.push({ text: `[Note: Attachment "${attachment.name}" (${contentType}) is not supported for analysis.]\n` });
        }
    }
    const promptText = userMessage?.trim() || "What do you see in this image? Describe it and respond naturally.";
    parts.push({ text: `\nUser: ${promptText}` });

    const result   = await model.generateContent({ contents: [{ role: "user", parts }] });
    const response = result.response;
    const text     = response.text();

    if (!text) throw new Error("Empty response from Gemini Vision.");
    return text;
}

/**
 * Check if a message's attachments contain anything we can analyse.
 * @param {import("discord.js").Collection} attachments
 * @returns {boolean}
 */
function hasAnalysableAttachment(attachments) {
    if (!attachments || attachments.size === 0) return false;
    const supported = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_TEXT_TYPES];
    return attachments.some(a => {
        const ct = a.contentType?.split(";")[0]?.trim() || "";
        return supported.includes(ct);
    });
}

module.exports = { askVision, hasAnalysableAttachment };
