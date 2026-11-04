// ─────────────────────────────────────────────────────────────────────────────
//  factExtractor.js
//  Background worker that silently analyses a conversation exchange and
//  extracts permanent facts about the user using Groq Llama 3 8B.
//  Runs AFTER the main AI reply is sent — never blocks the user.
// By Sejed TRABELSSI (Github: SEJED-DEV | Discord: sejed.dev)
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const Groq = require("groq-sdk");

// Use the small/fast model to keep costs near-zero
const EXTRACTOR_MODEL   = "llama3-8b-8192";
const EXTRACTOR_TIMEOUT = 15_000; 
let _groqClient = null;

function getGroq() {
    if (_groqClient) return _groqClient;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env");
    _groqClient = new Groq({ apiKey });
    return _groqClient;
}

// ── Extraction Prompt ─────────────────────────────────────────────────────────

const EXTRACTOR_SYSTEM = `You are a memory extraction engine. Your ONLY job is to extract permanent, 
useful facts about a user from a single conversation exchange.

Rules:
- Only extract facts that are CLEARLY stated by the user (not inferred or assumed).
- Only include facts that would still be relevant weeks later (e.g. name, job, hobbies, country, pets, preferences).
- NEVER extract temporary statements like "I'm tired", "I'm going to sleep" or "I feel sad today".
- NEVER extract anything about the AI assistant — only about the user.
- Return ONLY a JSON array of short fact strings, like: ["Name is Alex", "Lives in Canada", "Likes Python programming"]
- If there are NO extractable facts, return an empty array: []
- Each fact must be under 120 characters.
- Maximum 5 facts per extraction.
- Do NOT include any explanation, markdown, or extra text. ONLY the JSON array.`;

/**
 * Extract permanent facts about a user from one conversation turn.
 * Runs silently in the background — errors are swallowed.
 *
 * @param {string} username    - Discord username (for context).
 * @param {string} userMessage - What the user said.
 * @param {string} aiReply     - What the bot replied (for context).
 * @returns {Promise<string[]>} Array of fact strings (may be empty).
 */
async function extractFacts(username, userMessage, aiReply) {
    const groq = getGroq();

    const userContent = `Username: ${username}
User said: ${userMessage.slice(0, 800)}
Assistant replied: ${aiReply.slice(0, 400)}`;

    let raw;
    try {
        const completion = await groq.chat.completions.create({
            model:       EXTRACTOR_MODEL,
            messages: [
                { role: "system", content: EXTRACTOR_SYSTEM },
                { role: "user",   content: userContent },
            ],
            max_tokens:  256,
            temperature: 0.1, 
        }, { timeout: EXTRACTOR_TIMEOUT });

        raw = completion.choices?.[0]?.message?.content?.trim();
    } catch (err) {
        if (process.env.NODE_ENV !== "production") {
            console.warn("[FactExtractor] Groq call failed (non-fatal):", err.message);
        }
        return [];
    }

  
    try {
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed  = JSON.parse(cleaned);

        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter(f => typeof f === "string" && f.trim().length > 0)
            .map(f => f.trim().slice(0, 120))
            .slice(0, 5);

    } catch {
        // if the Model returned something other than JSON it will ignore it
        return [];
    }
}

module.exports = { extractFacts };
