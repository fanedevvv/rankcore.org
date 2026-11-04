const blacklistDB = require("../Schemas/blacklistSchema");

/**
 * Checks if a user is blacklisted.
 * @param {string} userId - Discord user ID
 * @returns {Promise<{blacklisted: boolean, reason?: string}>}
 */
async function checkBlacklist(userId) {
    const entry = await blacklistDB.findOne({ userId });
    if (entry) {
        return { blacklisted: true, reason: entry.reason };
    }
    return { blacklisted: false };
}

module.exports = checkBlacklist;
