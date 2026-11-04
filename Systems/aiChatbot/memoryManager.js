// ─────────────────────────────────────────────────────────────────────────────
//  memoryManager.js
//  Reads and writes long-term user facts to MongoDB (Global Memory).
//  Facts are stored per-userId, meaning the bot remembers a user
//  across ALL servers it is in.
// By Sejed TRABELSSI (Github: SEJED-DEV | Discord: sejed.dev) - 25/05/2026
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

const UserMemory = require("../../Schemas/userMemorySchema");

const MAX_FACTS_PER_USER = 25;   
const MAX_FACT_LENGTH    = 120;  

const _cache     = new Map(); 
const CACHE_TTL  = 5 * 60 * 1000;

function _isCacheValid(entry) {
    return entry && (Date.now() - entry.fetchedAt) < CACHE_TTL;
}



/**
 * Get the stored facts for a user.
 * Returns an array of fact strings (may be empty).
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getUserFacts(userId) {
    // Cache hit
    const cached = _cache.get(userId);
    if (_isCacheValid(cached)) return cached.facts;

    // DB fetch
    const doc = await UserMemory.findOne({ userId }).lean();
    const facts = (doc?.facts || [])
        .map(f => f.content)
        .filter(Boolean);

    _cache.set(userId, { facts, fetchedAt: Date.now() });
    return facts;
}

/**
 * Merge a set of newly extracted facts into the user's memory.
 * Deduplicates against existing facts, enforces MAX_FACTS_PER_USER.
 * @param {string}   userId
 * @param {string[]} newFacts  
 */
async function saveUserFacts(userId, newFacts) {
    if (!newFacts || newFacts.length === 0) return;

    const sanitised = newFacts
        .map(f => String(f).trim().slice(0, MAX_FACT_LENGTH))
        .filter(Boolean);

    if (sanitised.length === 0) return;

    let doc = await UserMemory.findOne({ userId });
    if (!doc) {
        doc = new UserMemory({ userId, facts: [] });
    }

    const existing = new Set(doc.facts.map(f => f.content.toLowerCase()));

    for (const fact of sanitised) {
        if (existing.has(fact.toLowerCase())) continue;
        existing.add(fact.toLowerCase());
        doc.facts.push({ content: fact, addedAt: new Date() });
    }

    if (doc.facts.length > MAX_FACTS_PER_USER) {
        doc.facts = doc.facts.slice(-MAX_FACTS_PER_USER);
    }

    doc.lastAnalyzed = new Date();
    await doc.save();

    _cache.delete(userId);
}

/**
 * Wipe all memory for a user (e.g. on user request via !forget command).
 * @param {string} userId
 */
async function clearUserMemory(userId) {
    await UserMemory.deleteOne({ userId });
    _cache.delete(userId);
}

/**
 * Format the user's facts as a concise block for injection into the system prompt.
 * Returns an empty string if the user has no facts.
 * @param {string[]} facts
 * @returns {string}
 */
function formatFactsForPrompt(facts) {
    if (!facts || facts.length === 0) return "";
    const lines = facts.map(f => `  - ${f}`).join("\n");
    return `\nWhat you remember about this user (global memory — across all servers):\n${lines}\n`;
}

module.exports = { getUserFacts, saveUserFacts, clearUserMemory, formatFactsForPrompt };
