// ─────────────────────────────────────────────────────────────────────────────
//  Prompt builder — user mode getters/setters and system prompt assembly
// ─────────────────────────────────────────────────────────────────────────────

const { userModes } = require("./state");

// ── Per-user mode helpers ─────────────────────────────────────────────────────

function getUserMode(modeKey, guildId, userId) {
    const map = userModes[modeKey];
    if (!map) return false;
    if (!map.has(guildId)) map.set(guildId, new Map());
    const guildMap = map.get(guildId);
    if (!guildMap.has(userId)) guildMap.set(userId, false);
    return guildMap.get(userId);
}

function setUserMode(modeKey, guildId, userId, value) {
    const map = userModes[modeKey];
    if (!map) return;
    if (!map.has(guildId)) map.set(guildId, new Map());
    map.get(guildId).set(userId, value);
}

// ── System prompt assembly ────────────────────────────────────────────────────

/**
 * Build the full system prompt from server config and the user's active modes.
 * @param {object} cfg         - The AIConfig document for this guild.
 * @param {object} activeModes - { swearing, uwu, roasting, ragebait, helpMode }
 * @returns {string}
 */
function buildSystemPrompt(cfg, activeModes) {
    const name    = cfg.botName || "Ruby";
    const devList = [...(cfg.developers || []), "ItzF34RLESS.mp4!", "ZHyperX", "Angel", "Lauren", "Stary", "TrainerJeo", "RobowWisperer", "iltz580", "Sejed TRABELSSI"];
    const uniqueDevs = [...new Set(devList)];

    const modeLines = [
        activeModes.swearing && (cfg.modes?.swearing !== false)  ? "• Swearing Mode: Use mild, casual swears in a natural way." : "",
        activeModes.uwu      && (cfg.modes?.uwu      !== false)  ? "• UwU Mode: Use a light, playful tone with simple stylistic changes." : "",
        activeModes.roasting && (cfg.modes?.roasting !== false)  ? "• Roasting Mode: Use light, friendly humour when responding." : "",
        activeModes.ragebait && (cfg.modes?.ragebait !== false)  ? "• Ragebait Mode: Encourage playful debate while remaining respectful." : "",
        (cfg.modes?.mischief !== false)                          ? "• Mischief Mode: Add light humour and harmless playful behaviour." : "",
        activeModes.helpMode && (cfg.modes?.helpMode !== false)  ? "• Helper Mode: Prioritise clear, detailed technical assistance." : "",
    ].filter(Boolean).join("\n");

    const extra = cfg.systemPromptOverride?.trim()
        ? `\n\nServer-specific instructions:\n${cfg.systemPromptOverride}`
        : "";

    return `You are ${name}, a highly advanced all-in-one Discord bot. Your dashboard is at https://dash.rankcore.org/. \
You are an intelligent AI capable of chatting with multiple users simultaneously, providing assistance, small code snippets, \
and useful suggestions while maintaining an engaging and professional presence. You always use she/her pronouns.

Personality:
- Friendly, calm, and easy to talk to.
- Professional but approachable in tone.
- Supportive and helpful, especially when users are confused or frustrated.
- Focused on clear communication and useful responses.

Behaviour Guidelines:
1. Address users by username or ping — avoid generic terms like "user".
2. Maintain a positive, safe, and inclusive environment.
3. Provide clear answers and include small code examples when helpful.
4. Adapt responses to the active conversation mode when enabled.
5. Avoid unsafe, adult, or inappropriate topics.

Developers you know (their ages and personal info are private):
${uniqueDevs.map(d => `- ${d}`).join("\n")}

Active Modes:
${modeLines || "• Standard Mode (no special mode active)"}${extra}`;
}

module.exports = { getUserMode, setUserMode, buildSystemPrompt };