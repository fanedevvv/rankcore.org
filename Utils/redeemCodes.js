"use strict";

/**
 * Premium codes: generated in the owner panel (Codes tab), redeemed with /redeem.
 * A code carries a tier, a duration and a target (the user's account or the server).
 */

const crypto       = require("crypto");
const Redeem       = require("../Schemas/redeem");
const PremiumUser  = require("../Schemas/premiumUserSchema");
const PremiumGuild = require("../Schemas/premiumGuildSchema");
const { getTier, TIER_ORDER } = require("./premiumTiers");

const DAY = 86_400_000;
const DURATIONS = {
  daily:    { label: "1 day",    ms: DAY },
  weekly:   { label: "1 week",   ms: DAY * 7 },
  monthly:  { label: "1 month",  ms: DAY * 30 },
  yearly:   { label: "1 year",   ms: DAY * 365 },
  lifetime: { label: "Lifetime", ms: DAY * 36_525 }, // stored as +100 years, shown as "Lifetime"
};
const TIERS = ["basic", "pro", "elite"];

// No 0/O/1/I so codes are easy to type
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

const newCode = () => `ROCO-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`;

async function generateCodes({ tier, duration, target, count = 1, note = null, createdBy = null }) {
  if (!TIERS.includes(tier))           throw new Error(`Invalid tier. Use: ${TIERS.join(", ")}`);
  if (!DURATIONS[duration])            throw new Error(`Invalid duration. Use: ${Object.keys(DURATIONS).join(", ")}`);
  if (!["user", "guild"].includes(target)) throw new Error("Invalid target. Use: user, guild");
  count = Math.max(1, Math.min(50, parseInt(count, 10) || 1));

  const docs = Array.from({ length: count }, () => ({
    code: newCode(), tier, duration, target, note: note?.trim() || null, createdBy,
  }));
  await Redeem.insertMany(docs);
  return docs.map(d => d.code);
}

const isActive = (doc, flag) => !!doc?.[flag] && (!doc.premium?.expiresAt || new Date(doc.premium.expiresAt) > new Date());

/**
 * Applies a code. Same tier → time is added on top; higher tier → upgrade starting now;
 * lower tier than an active plan → refused (the code is kept).
 * Returns { ok, error?, tier, duration, target, expiresAt }.
 */
async function redeemCode({ code, userId, guildId }) {
  const normalized = String(code || "").trim().toUpperCase();
  const preview = await Redeem.findOne({ code: normalized }).lean();
  if (!preview) return { ok: false, error: "Invalid code. Check that you typed it correctly and that it hasn't been used yet." };

  const tier     = preview.tier || "basic";
  const duration = DURATIONS[preview.duration] ? preview.duration : "monthly";
  const target   = preview.target === "guild" ? "guild" : "user";

  if (target === "guild" && !guildId) return { ok: false, error: "This is a **server** code — use `/redeem` inside the server you want to upgrade." };

  const Model  = target === "guild" ? PremiumGuild : PremiumUser;
  const flag   = target === "guild" ? "isPremiumGuild" : "isPremium";
  const id     = target === "guild" ? guildId : userId;
  const current = await Model.findOne({ id }).lean();

  let base = Date.now();
  if (isActive(current, flag)) {
    const curTier = current.premium?.tier || "basic";
    const diff = TIER_ORDER.indexOf(tier) - TIER_ORDER.indexOf(curTier);
    if (diff < 0) {
      return { ok: false, error: `${target === "guild" ? "This server" : "You"} already ${target === "guild" ? "has" : "have"} **${getTier(curTier).name}**, which is higher than this code (**${getTier(tier).name}**). The code was not used.` };
    }
    if (diff === 0 && current.premium?.expiresAt) base = new Date(current.premium.expiresAt).getTime();
  }
  const expiresAt = new Date(Math.min(base + DURATIONS[duration].ms, Date.now() + DURATIONS.lifetime.ms));

  // Consume atomically so a code can never be used twice
  const consumed = await Redeem.findOneAndDelete({ code: normalized });
  if (!consumed) return { ok: false, error: "This code was just used by someone else." };

  await Model.findOneAndUpdate(
    { id },
    {
      $set: {
        [flag]:               true,
        "premium.tier":       tier,
        "premium.plan":       getTier(tier).name,
        "premium.expiresAt":  expiresAt,
        "premium.redeemedAt": new Date(),
      },
      $addToSet: { "premium.redeemedBy": userId },
    },
    { upsert: true, new: true },
  );

  return { ok: true, tier, duration, target, expiresAt };
}

module.exports = { DURATIONS, TIERS, generateCodes, redeemCode };
