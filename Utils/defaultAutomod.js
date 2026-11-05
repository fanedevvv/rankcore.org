"use strict";

/**
 * Basic Discord-native AutoMod rules created when RankCore joins a server.
 * Native rules created by the app also count towards Discord's "Uses AutoMod" app badge.
 * Only runs on join, so a server that deletes or edits these rules keeps its choice.
 */

const {
  PermissionsBitField,
  AutoModerationRuleTriggerType,
  AutoModerationRuleEventType,
  AutoModerationActionType,
  AutoModerationRuleKeywordPresetType,
} = require("discord.js");

const block = [{ type: AutoModerationActionType.BlockMessage }];

const DEFAULT_RULES = [
  {
    name: "AutoMod: Spam",
    triggerType: AutoModerationRuleTriggerType.Spam,
    triggerMetadata: {},
  },
  {
    name: "AutoMod: Mention Spam",
    triggerType: AutoModerationRuleTriggerType.MentionSpam,
    triggerMetadata: { mentionTotalLimit: 10, mentionRaidProtectionEnabled: true },
  },
  {
    name: "AutoMod: Slurs",
    triggerType: AutoModerationRuleTriggerType.KeywordPreset,
    triggerMetadata: { presets: [AutoModerationRuleKeywordPresetType.Slurs] },
  },
];

/** Creates the default rules the server doesn't have yet. Returns how many were created. */
async function createDefaultAutomodRules(guild) {
  if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageGuild)) return 0;

  const existing = await guild.autoModerationRules.fetch().catch(() => null);
  if (!existing) return 0;

  let created = 0;
  for (const rule of DEFAULT_RULES) {
    // Discord allows only one rule of each of these trigger types per server
    if (existing.some(r => r.triggerType === rule.triggerType)) continue;
    try {
      await guild.autoModerationRules.create({
        ...rule,
        enabled: true,
        eventType: AutoModerationRuleEventType.MessageSend,
        actions: block,
        reason: "RankCore default protection",
      });
      created++;
    } catch (err) {
      console.warn(`[AutoMod] Could not create "${rule.name}" in ${guild.id}: ${err.message}`);
    }
  }
  return created;
}

module.exports = { DEFAULT_RULES, createDefaultAutomodRules };
