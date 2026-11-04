"use strict";

// Events/Others/cat.js
// Intercepts messages from cat-locked users and replaces them with cattified text via webhook.

const { Events, TextChannel } = require("discord.js");
const catSchema = require("../../Schemas/catschema");

// ─── Caches ───────────────────────────────────────────────────────────────────
const webhookCache = new Map(); // channelId → webhook
const sendQueues   = new Map(); // channelId → Promise chain
const RATE_DELAY   = 1200;      // ms between sends per channel

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function sanitize(text) {
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

function isEmojiOnly(text) {
    if (!text?.trim()) return true;
    let s = text
        .replace(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g, "")
        .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FA9F}]/gu, "")
        .replace(/[\uFE00-\uFE0F\u200D]/g, "");
    return s.trim().length === 0;
}

// ─── Cattify ──────────────────────────────────────────────────────────────────

function cattify(text) {
    if (!text) return "";

    // Word substitutions — cat brain replaces human concepts
    const catWords = {
        yes:     "mrrp",
        no:      "hiss",
        hello:   "meow",
        hey:     "mew~",
        hi:      "mew",
        bye:     "prrr~",
        goodbye: "mrrrow",
        okay:    "mreow",
        ok:      "mreow",
        please:  "purrr",
        sorry:   "*slow blinks*",
        help:    "mrowww",
        thanks:  "prr prr prr",
        love:    "headbutt",
        hate:    "hissssss",
        food:    "treats",
        eat:     "nom",
        hungry:  "*paws at bowl*",
        sleep:   "nap",
        tired:   "curled up",
        bored:   "*knocks things off tables*",
        happy:   "purring",
        sad:     "*flattened ears*",
        mad:     "*puffed tail*",
        angry:   "HISSSSS",
        scared:  "*hides under bed*",
        the:     "the",
        good:    "good (for treats)",
        bad:     "no treat",
        go:      "zoom",
        run:     "ZOOMIES",
        play:    "chase the dot",
        stop:    "*ignores you completely*",
        look:    "*stares unblinking*",
        what:    "mrrp??",
        why:     "meow???",
        how:     "mew?",
        when:    "*knocks it off the counter*",
        where:   "*sits on it*",
        work:    "nap time",
        school:  "nap time",
    };

    let out = text;
    for (const [word, replacement] of Object.entries(catWords)) {
        out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), replacement);
    }

    // Random letter quirks — cats don't type well
    out = out.split("").map(char => {
        const r = Math.random();
        // Occasionally drop a letter (clumsy paws)
        if (r < 0.04) return "";
        // Occasionally double-tap a key
        if (r < 0.08 && char.match(/[a-z]/i)) return char + char;
        return char;
    }).join("");

    // Sprinkle "nya" mid-sentence
    const nyaForms = ["nya~", "nyaa~", "mrrp", "mew", "purr~", "prrrr", "nyan~", "mrow"];
    out = out.replace(/(\s+)/g, m =>
        Math.random() < 0.10
            ? ` ${nyaForms[Math.floor(Math.random() * nyaForms.length)]} `
            : m
    );

    // Cat actions
    const actions = [
        "*knocks your message off the table*",
        "*sits directly on keyboard*",
        "*stares at wall for no reason*",
        "*brings you a dead bird as a gift*",
        "*headbutts your shin*",
        "*ignores everything you just said*",
        "*zoomies through the room*",
        "*slow blink*",
        "*chirps at the window*",
        "*bites your hand then licks it*",
        "*knocks over water glass*",
        "*yells at 3am*",
        "*claims your warm spot*",
        "*drapes self over laptop*",
        "*paws at face*",
        "*demands pets then bites you*",
    ];

    // Almost always tack on a cat action (88%)
    if (Math.random() < 0.88)
        out += " " + actions[Math.floor(Math.random() * actions.length)];

    // Sometimes two actions (35%)
    if (Math.random() < 0.35)
        out += " " + actions[Math.floor(Math.random() * actions.length)];

    // Cat faces / endings
    const faces = ["=^.^=", "^͜^ ", ":3", "≽^•⩊•^≼", "(=ↀωↀ=)", "ฅ^•ﻌ•^ฅ", "😸", "🐱", "🐈", "😼", "😺"];
    if (Math.random() < 0.92)
        out += " " + faces[Math.floor(Math.random() * faces.length)];

    // Tilde on punctuation
    out = out.replace(/[.!?]/g, m =>
        Math.random() < 0.75 ? m + "~".repeat(Math.floor(Math.random() * 3) + 1) : m
    );

    return out;
}

// ─── Webhook (cached, with invalidation on failure) ──────────────────────────

async function getWebhook(channel, client) {
    if (webhookCache.has(channel.id)) return webhookCache.get(channel.id);

    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find(w => w.name === "CatLock Webhook");

    if (!wh) {
        wh = await channel.createWebhook({
            name:   "CatLock Webhook",
            avatar: client.user.displayAvatarURL(),
        });
    }

    webhookCache.set(channel.id, wh);
    return wh;
}

async function sendViaWebhook(channel, client, payload) {
    // First attempt with cached (or freshly fetched) webhook
    try {
        const wh = await getWebhook(channel, client);
        await wh.send(payload);
        return;
    } catch (err) {
        // 404 = webhook deleted/invalidated; clear cache and retry once
        // 429 = rate limited; Discord.js will have already waited and retried
        // Any other error: try a fresh webhook once before giving up
        webhookCache.delete(channel.id);
    }

    try {
        const wh = await getWebhook(channel, client);
        await wh.send(payload);
    } catch {
        // Second attempt failed — drop silently rather than spamming errors
    }
}

// ─── Send queue (per-channel, rate-limit safe) ────────────────────────────────
// Delay is inserted AFTER a send, not before, so the first message in an
// idle queue goes out immediately with no visible lag.

function queueSend(channelId, task) {
    const last = sendQueues.get(channelId) || Promise.resolve();
    const next = last
        .then(() => task())
        .then(() => sleep(RATE_DELAY))   // wait AFTER sending before the next one
        .catch(() => sleep(RATE_DELAY))  // even on failure, respect the cooldown
        .finally(() => {
            if (sendQueues.get(channelId) === next) sendQueues.delete(channelId);
        });
    sendQueues.set(channelId, next);
}

// ─── Event ────────────────────────────────────────────────────────────────────

module.exports = {
    name: Events.MessageCreate,

    async execute(message, client) {
        if (message.author.bot || !message.guild)                      return;
        if (!(message.channel instanceof TextChannel))                  return;
        if (message.stickers.size > 0)                                  return;
        if (message.attachments.size > 0)                               return;
        if (containsLink(message.content))                              return;
        if (isEmojiOnly(message.content))                               return;

        const record = await catSchema.findOne({
            Guild: message.guild.id,
            User:  message.author.id,
        });
        if (!record) return;

        const clean = sanitize(message.content);
        if (!clean) return;

        const catText = cattify(clean);

        message.delete().catch(() => null);

        queueSend(message.channel.id, () =>
            sendViaWebhook(message.channel, client, {
                content:   catText || "*meows incoherently* 🐱",
                username:  message.author.username,
                avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            })
        );
    },
};