const GLOBAL_COOLDOWN_TIME = 10 * 1000;
const ERROR_LIMIT = 3;
const ERROR_RESET_TIME = 60_000;
const SPAM_LIMIT = 5;
const SPAM_INTERVAL = 5000;

const globalCooldown = new Map();
const errorSpamMap = new Map();
const spamMap = new Map();

module.exports = {
  GLOBAL_COOLDOWN_TIME,
  ERROR_LIMIT,
  ERROR_RESET_TIME,
  SPAM_LIMIT,
  SPAM_INTERVAL,
  globalCooldown,
  errorSpamMap,
  spamMap
};
