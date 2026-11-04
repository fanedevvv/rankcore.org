const ACHIEVEMENTS = {
  FIRST_MARRIAGE: "First Marriage 💍",
  FIRST_ADOPTION: "First Adoption 👶",
  BIG_FAMILY: "Big Family 👨‍👩‍👧‍👦",     // 3+ children
  LOVING_COUPLE: "Loving Couple <:Red_Heart:1555544329605615758>",       // Married for 7+ days
  KIDNAPPER: "Master Kidnapper 😈",        // 5+ successful kidnaps
  GUIDING_LIGHT: "Guiding Light <:boost:1555544362455146576>",       // 10+ Parental Guidance uses
};

const KIDNAP_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours
const BASE_KIDNAP_CHANCE = 0.4;              // 40%
const MAX_GROUNDING_MINUTES = 720;           // 12 hours

module.exports = { ACHIEVEMENTS, KIDNAP_COOLDOWN, BASE_KIDNAP_CHANCE, MAX_GROUNDING_MINUTES };