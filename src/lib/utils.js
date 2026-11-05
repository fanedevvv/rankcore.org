// -------------------------------
// UwUify Function
// -------------------------------
function uwuify(text) {
    if (!text) return "";

    // Base letter conversions
    let uwuText = text
        .normalize('NFKD') // helps with fancy letters
        .replace(/r|l/g, 'w')
        .replace(/R|L/g, 'W')
        .replace(/n([aeiou])/gi, 'ny$1')
        .replace(/ove/g, 'uv')
        .replace(/!+/g, '!!~')
        .replace(/\?+/g, '??~');

    // Cute stutters and letter doubling
    uwuText = uwuText.split('').map(char => {
        const rand = Math.random();
        if (rand < 0.07) return char + char;                  // double letters
        if (rand >= 0.07 && rand < 0.15 && char.match(/[aeiou]/i)) return char + 'w'; // cute vowels
        if (rand >= 0.15 && rand < 0.20 && char.match(/[bcdfghjklmnpqrstvwxyz]/i)) return char + '-' + char; // stutter
        return char;
    }).join('');

    // Random kawaii faces
    const faces = [
        '(｡<:Red_Heart:1567796949271191642>‿<:Red_Heart:1567796949271191642>｡)', '(≧◡≦)', '(*≧ω≦)', '(U ᵕ U<:dot:1567796963624226826>)', 'uwu', 'owo', '>w<', '^w^', 'rawr~', 'nya~', '*blushes*', 'mwehehe~', 'teehee~', 'meow~'
    ];

    // Extra cute suffixes
    const suffixes = [
        '~', ' >w<', ' uwu', ' owo', ' <:boost:1567796953599836280>', ' <:Red_Heart:1567796949271191642>', ' rawr~', ' nya~', ' *snuggles*', ' *huggles*', ' *giggles*'
    ];

    // Add faces/suffixes to words randomly
    uwuText = uwuText.split(' ').map(word => {
        const r = Math.random();
        if (r < 0.15) return word + ' ' + faces[Math.floor(Math.random() * faces.length)];
        if (r >= 0.15 && r < 0.25) return word + suffixes[Math.floor(Math.random() * suffixes.length)];
        return word;
    }).join(' ');

    // Sprinkle hearts and sparkles at sentence ends
    uwuText = uwuText.replace(/([.?!])/g, (match) => {
        const extras = [' <:Red_Heart:1567796949271191642>', ' <:boost:1567796953599836280>', ' >w<', ' owo', ' uwu', ' rawr~', ' *blushes*'];
        return match + ' ' + extras[Math.floor(Math.random() * extras.length)];
    });

    // Add a final mega cute ending
    const endings = [' >w~ <:Red_Heart:1567796949271191642><:boost:1567796953599836280>', ' uwu~ <:Red_Heart:1567796949271191642>', ' *snuggles you*', ' mwehehe~ <:Red_Heart:1567796949271191642>', ' nyaaa~ <:boost:1567796953599836280>'];
    uwuText += endings[Math.floor(Math.random() * endings.length)];

    return uwuText;
}

// -------------------------------
// DM Cleanup Utility
// -------------------------------

async function deleteRecentDMs(client) {
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

    const logStep = (label, message, color = theme.cyan) => {
        console.log(sep);
        console.log(`${theme.gray}[${new Date().toLocaleTimeString()}]${theme.reset} ${color}${theme.bright}[${label}]${theme.reset} ${message}`);
        console.log(sep);
    };

    try {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const dmChannels = client.channels.cache.filter(c => c.isDMBased() && c.type === 1);

        logStep('DM CLEANUP', `Found ${dmChannels.size} DM channels in cache to process.`, theme.cyan);

        for (const [id, channel] of dmChannels) {
            if (!channel.messages || !channel.messages.fetch) {
                logStep('DM CLEANUP', `Skipping invalid or incomplete channel ID: ${id}`, theme.yellow);
                continue;
            }

            let lastMessageId;
            let deletedCount = 0;
            const recipientTag = channel.recipient?.tag || 'Unknown User';

            while (true) {
                const messages = await channel.messages.fetch({ limit: 100, before: lastMessageId }).catch(fetchErr => {
                    logStep('DM CLEANUP', `Error fetching messages for ${recipientTag} (${id}): ${fetchErr.message}`, theme.red);
                    return new Map();
                });

                if (!messages.size) break;

                const botMessages = messages.filter(msg => msg.author.id === client.user.id && msg.createdTimestamp > oneWeekAgo);
                for (const [msgId, msg] of botMessages) {
                    await msg.delete().catch(() => null);
                    deletedCount++;
                }

                lastMessageId = messages.last()?.id;
                if (!lastMessageId || messages.last().createdTimestamp < oneWeekAgo) break;
            }

            if (deletedCount > 0) {
                logStep('DM CLEANUP', `Deleted ${deletedCount} messages in DM with ${recipientTag} (${id}).`, theme.green);
            }
        }

        logStep('DM CLEANUP', 'Finished deleting DMs sent in the past 7 days.', theme.green);
    } catch (err) {
        logStep('DM CLEANUP', `Critical Error during DM processing: ${err}`, theme.red);
    }
}

module.exports = deleteRecentDMs;


// -------------------------------
// API Helper Functions
// -------------------------------
function getClusterStatus(statusCode) {
  const map = { 0: 'online', 1: 'connecting', 2: 'reconnecting', 3: 'idle', 4: 'nearly', 5: 'offline', 6: 'waiting_for_guilds', 7: 'identifying', 8: 'resuming' };
  const status = map[statusCode];
  if (!status) return 'unknown';
  if (status === 'connecting' || status === 'reconnecting' || status === 'resuming') return 'restarting';
  if (status === 'offline') return 'offline';
  return 'online';
}

function formatUptime(ms) {
  if (!ms || ms < 1000) return '0s';
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(' ') || `${seconds}s`;
}

module.exports = {
    uwuify,
    deleteRecentDMs,
    getClusterStatus,
    formatUptime
};