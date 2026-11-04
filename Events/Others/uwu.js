// Events/Guild/messageCreate.js
const { Events, TextChannel, EmbedBuilder } = require('discord.js');
const uwuSchema = require('../../Schemas/uwuschema');
const { uwuify } = require('../../src/lib/utils.js');

// -------------------- CACHES --------------------
const webhookCache = new Map(); // channelId => webhook
const sendQueues = new Map();   // channelId => Promise chain
const rateLimitDelay = 1200;    // ms between sends per channel (safe under 5/5s)

// -------------------- HELPERS --------------------
function sanitizeMessage(text) {
    if (!text) return "";
    return text
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[^\x20-\x7E]/g, "")
        .trim();
}

function containsLink(text) {
    if (!text) return false;
    return /(https?:\/\/[^\s]+)|(www\.[^\s]+)|discord\.gg\/[^\s]+/i.test(text);
}

// Returns true if the message is ONLY standard/custom/animated emoji (nothing else substantive)
function isEmojiOnly(text) {
    if (!text || !text.trim()) return true;

    // Strip Discord custom emoji <:name:id> and animated <a:name:id>
    let stripped = text.replace(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g, "");
    // Strip unicode emoji (broad range)
    stripped = stripped.replace(
        /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/gu,
        ""
    );
    // Strip variation selectors and ZWJ sequences
    stripped = stripped.replace(/[\uFE00-\uFE0F\u200D]/g, "");
    return stripped.trim().length === 0;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function ultraUwuify(text) {
    if (!text) return "";

    let uwu = uwuify(text);

    // Stutter effect (more aggressive — 25% chance)
    uwu = uwu.replace(/\b([a-zA-Z])/g, (m, c) =>
        Math.random() < 0.25 ? `${c}-${c}-${c}` : (Math.random() < 0.15 ? `${c}-${c}` : c)
    );

    // Elongate vowels randomly
    uwu = uwu.replace(/([aeiou])/gi, (m, v) =>
        Math.random() < 0.2 ? v.repeat(Math.floor(Math.random() * 3) + 2) : v
    );

    const cursedMap = {
        you: "uu",
        your: "urrr",
        love: "wuv",
        small: "smol",
        cute: "kawaii~",
        hello: "hewwoo",
        hey: "haiiii",
        hi: "hiiiii",
        no: "nuuuuu",
        yes: "yussss",
        god: "gawd",
        fuck: "fwickk",
        shit: "poopie",
        the: "da",
        this: "dis",
        that: "dat",
        very: "vewy",
        sorry: "sowwy",
        please: "pwease",
        stop: "s-stop it!!",
        cool: "kewl",
        good: "gwood",
        bad: "meanie",
        friend: "fwend",
        friends: "fwendss",
        okay: "owkay",
        ok: "owkay",
        what: "whaaat",
        why: "wwhyy",
        help: "hewp",
        think: "fink",
        really: "weawwy",
        like: "wike",
        little: "wittle",
    };

    for (const [key, value] of Object.entries(cursedMap)) {
        uwu = uwu.replace(new RegExp(`\\b${key}\\b`, "gi"), value);
    }

    // Cringe action suffixes (higher frequency)
    const actions = [
        "*nuzzles u super hard*",
        "*wiggles tail furiously*",
        "*rawr x3 nuzzles ur neck*",
        "*blushes into oblivion*",
        "*giggles uncontrollably*",
        "*hides face in paws*",
        "*tail goes absolutely feral*",
        "*happy squeaking noises*",
        "*bounces off the walls*",
        "*rolls around on floor*",
        "*gives u headpats*",
        "*trips over own tail*",
        "*spins around cutely*",
        "*makes grabby hands at u*",
        "*melts into a puddle*",
        "*glomps u to the ground*",
    ];

    // Almost always add an action (90%)
    if (Math.random() < 0.9)
        uwu += " " + actions[Math.floor(Math.random() * actions.length)];

    // Sometimes add a second action (40%)
    if (Math.random() < 0.4)
        uwu += " " + actions[Math.floor(Math.random() * actions.length)];

    // Face suffixes
    const faces = ["owo", "uwu", ">w<", "^w^", "x3", "(*^ω^*)", "(⁄ ⁄•⁄ω⁄•⁄ ⁄)", "≧◡≦", "OwO", "UwU", "(*˘︶˘*)", ":3"];
    if (Math.random() < 0.95)
        uwu += " " + faces[Math.floor(Math.random() * faces.length)];

    // Double face occasionally
    if (Math.random() < 0.3)
        uwu += " " + faces[Math.floor(Math.random() * faces.length)];

    // Tilde spam on punctuation
    uwu = uwu.replace(/[.!?]/g, m => {
        const tildes = "~".repeat(Math.floor(Math.random() * 3) + 1);
        return Math.random() < 0.85 ? m + tildes : m;
    });

    // Random "nya~" or "mrrp~" interjections mid-text (10% per word boundary)
    const interjections = ["nyan~", "mrrp~", "murr~", "squee~", "eep~"];
    uwu = uwu.replace(/(\s+)/g, (m) =>
        Math.random() < 0.08
            ? ` ${interjections[Math.floor(Math.random() * interjections.length)]} `
            : m
    );

    return uwu;
}

// -------------------- WEBHOOK FETCH (CACHED, with invalidation) --------------------
async function getWebhook(channel, client) {
    if (webhookCache.has(channel.id)) {
        return webhookCache.get(channel.id);
    }

    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(w => w.name === "UwULock Webhook");

    if (!webhook) {
        webhook = await channel.createWebhook({
            name: "UwULock Webhook",
            avatar: client.user.displayAvatarURL(),
        });
    }

    webhookCache.set(channel.id, webhook);
    return webhook;
}

async function sendViaWebhook(channel, client, payload) {
    // First attempt with cached (or freshly fetched) webhook
    try {
        const wh = await getWebhook(channel, client);
        await wh.send(payload);
        return;
    } catch {
        // 404 = webhook deleted/invalidated — clear cache and retry once
        webhookCache.delete(channel.id);
    }

    try {
        const wh = await getWebhook(channel, client);
        await wh.send(payload);
    } catch {
        // Second attempt failed — drop silently
    }
}

// -------------------- QUEUED SEND (delay AFTER send, not before) --------------------
// Inserting the delay before the send caused the first message in an idle queue
// to visibly lag (original deleted, nothing appears for 1200ms). Moving it after
// means the first send fires immediately; subsequent rapid messages are spaced out.
function queueSend(channelId, task) {
    const last = sendQueues.get(channelId) || Promise.resolve();
    const next = last
        .then(() => task())
        .then(() => sleep(rateLimitDelay))   // wait AFTER sending
        .catch(() => sleep(rateLimitDelay))  // respect cooldown even on failure
        .finally(() => {
            if (sendQueues.get(channelId) === next) {
                sendQueues.delete(channelId);
            }
        });

    sendQueues.set(channelId, next);
}

// -------------------- EVENT --------------------
module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;
        if (!(message.channel instanceof TextChannel)) return;

        // Ignore sticker-only messages
        if (message.stickers.size > 0) return;

        // Ignore messages with attachments
        if (message.attachments.size > 0) return;

        // Ignore links
        if (containsLink(message.content)) return;

        // Ignore emoji-only messages (nothing to uwuify)
        if (isEmojiOnly(message.content)) return;

        const uwuData = await uwuSchema.findOne({
            Guild: message.guild.id,
            User: message.author.id,
        });
        if (!uwuData) return;

        const clean = sanitizeMessage(message.content);

        // After sanitize, double-check something remains
        if (!clean) return;

        const uwuText = ultraUwuify(clean);

        // Delete original (non-blocking)
        message.delete().catch(() => null);

        // Queue webhook send to avoid rate limits
        queueSend(message.channel.id, () =>
            sendViaWebhook(message.channel, client, {
                content: uwuText || "*<empty and vewy shy>* uwu",
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            })
        );
    },
};