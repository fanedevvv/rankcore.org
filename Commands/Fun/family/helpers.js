const achievementSchema = require("../../../Schemas/achievementSchema");

/**
 * Grants an achievement to a user if they don't already have it.
 * Announces it in the given channel if newly granted.
 */
async function grantAchievement(userId, achievementName, channel) {
  let userAchievements = await achievementSchema.findOne({ userId });
  let granted = false;

  if (userAchievements) {
    if (!userAchievements.achievements.includes(achievementName)) {
      userAchievements.achievements.push(achievementName);
      await userAchievements.save();
      granted = true;
    }
  } else {
    await achievementSchema.create({ userId, achievements: [achievementName] });
    granted = true;
  }

  if (granted && channel) {
    await channel.send(`<:boost:1555544362455146576> <@${userId}> has earned: **${achievementName}**`);
  }

  return granted;
}

/**
 * Placeholder for economy/currency updates.
 * Replace with your actual economy schema logic.
 * @returns {boolean} true if successful / sufficient funds
 */
async function updateCurrency(userId, amount) {
  // Example: await economySchema.updateOne({ userId }, { $inc: { balance: amount } });
  if (amount < 0) {
    // return (await economySchema.findOne({ userId }))?.balance >= Math.abs(amount);
    return true; // Placeholder: assume parent always has enough
  }
  return true;
}

/**
 * Parses a duration string (e.g. "1h30m", "5d", "120m") into milliseconds.
 * @param {string} durationString
 * @returns {number|null} milliseconds, or null if invalid
 */
function parseDuration(durationString) {
  const regex = /(\d+)([dhms])/g;
  let totalMilliseconds = 0;
  let match;

  if (!durationString || typeof durationString !== "string") return null;

  while ((match = regex.exec(durationString))) {
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case "s": totalMilliseconds += value * 1000; break;
      case "m": totalMilliseconds += value * 60 * 1000; break;
      case "h": totalMilliseconds += value * 60 * 60 * 1000; break;
      case "d": totalMilliseconds += value * 24 * 60 * 60 * 1000; break;
      default: return null;
    }
  }

  return totalMilliseconds === 0 ? null : totalMilliseconds;
}

module.exports = { grantAchievement, updateCurrency, parseDuration };