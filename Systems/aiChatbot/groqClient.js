// ─────────────────────────────────────────────────────────────────────────────
//  Groq API client
// ─────────────────────────────────────────────────────────────────────────────

const Groq         = require("groq-sdk");
const { GROQ_MODEL } = require("./constants");

let _groqClient = null;

function getGroq() {
    if (_groqClient) return _groqClient;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env");
    _groqClient = new Groq({ apiKey });
    return _groqClient;
}

/**
 * Send a chat completion request to Groq.
 * @param {string}   systemPrompt   - The system prompt string.
 * @param {object[]} historyMessages - Prior conversation turns in OpenAI message format.
 * @param {string}   userMessage    - The latest user message.
 * @returns {Promise<string>} The assistant's reply text.
 */
async function askGroq(systemPrompt, historyMessages, userMessage) {
    const groq  = getGroq();
    const model = process.env.GROQ_MODEL || GROQ_MODEL;

    const messages = [
        { role: "system",    content: systemPrompt },
        ...historyMessages,
        { role: "user",      content: userMessage  },
    ];

    const completion = await groq.chat.completions.create({
        model,
        messages,
        max_tokens:  Number(process.env.GROQ_MAX_TOKENS)  || 1024,
        temperature: Number(process.env.GROQ_TEMPERATURE) || 0.8,
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) throw new Error("Empty response from Groq.");
    return text;
}

module.exports = { askGroq };