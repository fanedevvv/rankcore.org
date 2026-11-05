const fs   = require('fs');
const path = require('path');

// -------------------------------
// Logger Colors
// -------------------------------
const theme = {
    reset:   '\x1b[0m',
    bright:  '\x1b[1m',
    dim:     '\x1b[2m',
    cyan:    '\x1b[36m',
    yellow:  '\x1b[33m',
    green:   '\x1b[32m',
    blue:    '\x1b[34m',
    magenta: '\x1b[35m',
    red:     '\x1b[31m',
    gray:    '\x1b[90m',
};

const logFile = (type, name, extra = '') => {
    console.log(
        `${theme.gray} ├─ [${type}]${theme.reset} ` +
        `${theme.dim}Loaded:${theme.reset} ${theme.yellow}${name}${theme.reset} ${theme.gray}${extra}${theme.reset}`
    );
};

// -------------------------------
// Event Handler
// -------------------------------
module.exports = (client) => {
    if (!client._eventListeners)  client._eventListeners  = [];

    const { instance: granular } = require('../src/core/GranularManager');
    client.granularManager = granular;

    /**
     * Derive a stable, human-readable group name from the file path.
     * e.g. Events/Others/logs/messageLogs.js → "Others/logs"
     *      Events/Client/ready.js            → "Client"
     */
    function deriveGroup(filePath) {
        const rel   = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
        const parts = rel.split('/');
        // Strip the leading "Events" segment and the filename
        const inner = parts.slice(1, -1);
        return inner.join('/') || 'Root';
    }

    client.handleEvents = async (dirPath) => {
        const files = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);

            if (file.isDirectory()) {
                await client.handleEvents(fullPath);
                continue;
            }

            if (!file.name.endsWith('.js')) continue;

            let event;
            try {
                event = require(fullPath);
            } catch (err) {
                console.log(`[handelEvents] Failed to load ${fullPath}:`, err.message);
                continue;
            }
            if (!event?.name || typeof event.execute !== 'function') {
                console.log(`[handelEvents] Skipping ${file.name} - name: ${event?.name}, execute: ${typeof event?.execute}`);
                continue;
            }

            // Stable key:  "<discordEventName>:<relativeFilePath>"
            // e.g. "messageCreate:Events/Others/welcome.js"
            const relPath = path.relative(path.join(__dirname, '..'), fullPath).replace(/\\/g, '/');
            const key     = `${event.name}:${relPath}`;
            const group   = deriveGroup(fullPath);

            // Register in granular registry so the dev panel can list it
            granular.registerEvent(key, {
                event:   event.name,
                file:    relPath,
                group,
                label:   path.basename(file.name, '.js'),
            });

    // Wrap the real handler: if granular has it disabled, skip silently
    const handler = async (...args) => {
        if (!granular.isEventEnabled(key)) return;   // ← granular gate

        // ── Custom Branding gate ─────────────────────────────────────────────
        // If a CB bot is actively running for this guild, the main RankCore bot
        // should stay silent and let the CB worker handle everything.
        //
        // EXCEPTION: Ticket and confession handlers are RankCore-core features and
        // must always run regardless of CB state. The CB bot does not replicate
        // ticket/confession functionality, so silencing these would break them
        // entirely for guilds that have CB enabled.
        const CB_GATE_EXEMPT = [
            'Events/Ticket/',
            'Events/Others/confession',
            'Events/Others/uwu',
            'Events/Others/cat',
        ];
        const isCBExempt = CB_GATE_EXEMPT.some(prefix => relPath.startsWith(prefix));

        if (!isCBExempt) {
            try {
                const cbMgr = require('../src/core/CustomBrandingManager');
                const guildId = _extractGuildId(args);
                if (guildId) {
                  // In standalone mode, wait for the first poll to complete before
                  // making any isActive() decision — the cache starts empty and
                  // would incorrectly pass all events through until populated.
                  if (cbMgr._ready && !cbMgr._pollSucceeded) await cbMgr._ready;
                  if (cbMgr.isActive(guildId)) return;
                }
            } catch { /* non-critical — continue if manager unavailable */ }
        }
        // ────────────────────────────────────────────────────────────────────

        await event.execute(...args, client);
    };

            if (event.once) {
                client.once(event.name, handler);
            } else {
                client.on(event.name, handler);
            }

            // Track for bulk-removal when the events module stops
            client._eventListeners.push({ event: event.name, fn: handler, once: !!event.once, key });

            logFile('EVENT', relPath);
        }
    };

    /** Remove every listener registered via handleEvents — used by modules/index stop() */
    client.removeAllHandledEvents = () => {
        for (const { event, fn } of client._eventListeners) {
            client.removeListener(event, fn);
        }
        client._eventListeners = [];
        console.log(`${theme.yellow}[EVENTS] All event listeners removed.${theme.reset}`);
    };

    console.log(`${theme.magenta}[INIT] Event Loader Initialized${theme.reset}`);
};

/**
 * Best-effort extraction of a guild ID from Discord.js event arguments.
 * Handles the most common event arg shapes used throughout RankCore's event files.
 * Returns null if no guild can be determined (e.g. DM events).
 * @param {any[]} args
 * @returns {string|null}
 */
function _extractGuildId(args) {
    if (!args?.length) return null;
    const a = args[0];
    if (!a) return null;

    // GuildMember, Message, Interaction, Invite, VoiceState, Presence, etc.
    if (typeof a.guild?.id === 'string') return a.guild.id;

    // Guild itself
    if (typeof a.id === 'string' && typeof a.members !== 'undefined') return a.id;

    // [oldState, newState] voice state change — args[0] is VoiceState
    // already covered above via a.guild.id

    // Some events emit (guild, ...) where guild is first arg
    if (typeof a === 'object' && typeof a.id === 'string') return a.id;

    return null;
}