const router = require("express").Router();
const path = require("path");
const { 
  AutoModerationRuleTriggerType, 
  AutoModerationRuleEventType, 
  AutoModerationRuleKeywordPresetType, 
  AutoModerationActionType, 
  ChannelType 
} = require("discord.js");
const { isAuth, sendHTMLWithNonce , checkDashboardAccess } = require('../../middleware');

// --- AutoMod ---
const linkRegexes = ["http[s]?://", "www\\.", "\\.com", "\\.net", "\\.org", "discord\\.gg", "discord\\.com/invite"];

router.get("/guild/:id/automod", isAuth, checkDashboardAccess('moderation'), (req, res) => sendHTMLWithNonce(res, path.join(__dirname, "../../views/features/automod.html")));

router.get("/api/guild/:id/automod", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });
  try {
    // In standalone mode, fetch() returns the pre-computed summary directly from the internal API.
    // In normal mode, fetch() populates the cache and returns the manager.
    const fetchResult = await guild.autoModerationRules.fetch();

    // Standalone: fetchResult is already the final JSON { profanity, spam, ... }
    if (req.client.isStandaloneMode && fetchResult && typeof fetchResult.profanity !== "undefined") {
      return res.json(fetchResult);
    }

    // Normal (in-process) mode: query the live cache
    const profanity   = guild.autoModerationRules.cache.some(r => r.triggerType === AutoModerationRuleTriggerType.KeywordPreset && r.enabled);
    const spam        = guild.autoModerationRules.cache.some(r => r.triggerType === AutoModerationRuleTriggerType.Spam && r.enabled);
    const antilink    = guild.autoModerationRules.cache.some(r => r.triggerType === AutoModerationRuleTriggerType.Keyword && r.triggerMetadata.regexPatterns && r.triggerMetadata.regexPatterns.some(p => linkRegexes.includes(p)) && r.enabled);
    const mentionRule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam && r.enabled);
    const keywords    = guild.autoModerationRules.cache.filter(r => r.triggerType === AutoModerationRuleTriggerType.Keyword && !r.triggerMetadata.regexPatterns?.length).map(r => r.triggerMetadata.keywordFilter[0]);
    res.json({ profanity, spam, antilink, mentionSpam: { enabled: !!mentionRule, limit: mentionRule ? mentionRule.triggerMetadata.mentionTotalLimit : null }, keywords });
  } catch (err) { res.status(err.status || 500).json({ error: err.message || "Failed to fetch" }); }
});

router.post("/api/guild/:id/automod/toggle", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  const { type, enabled } = req.body;
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });

  // Standalone mode: proxy directly to internal API
  if (req.client.isStandaloneMode) {
    try {
      await guild.autoModerationRules.toggle(type, enabled);
      return res.json({ success: true });
    } catch (err) { return res.status(err.status || 500).json({ error: err.message }); }
  }

  // Normal mode: live Discord.js cache
  try {
    await guild.autoModerationRules.fetch();
    let rule = null;
    let ruleData = { enabled: true, eventType: AutoModerationRuleEventType.MessageSend, actions: [{ type: AutoModerationActionType.BlockMessage }], reason: `Dashboard Toggle` };

    if (type === 'profanity') {
      rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.KeywordPreset);
      ruleData.name = "AutoMod: Profanity";
      ruleData.triggerType = AutoModerationRuleTriggerType.KeywordPreset;
      ruleData.triggerMetadata = { presets: [AutoModerationRuleKeywordPresetType.Profanity, AutoModerationRuleKeywordPresetType.Slurs] };
    } else if (type === 'spam') {
      rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.Spam);
      ruleData.name = "AutoMod: Spam";
      ruleData.triggerType = AutoModerationRuleTriggerType.Spam;
    } else if (type === 'antilink') {
       rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.Keyword && r.triggerMetadata.regexPatterns?.some(p => linkRegexes.includes(p)));
       ruleData.name = "Anti-Link";
       ruleData.triggerType = AutoModerationRuleTriggerType.Keyword;
       ruleData.triggerMetadata = { regexPatterns: linkRegexes };
    }

    if (enabled) {
      if (rule) await rule.edit({ enabled: true });
      else await guild.autoModerationRules.create(ruleData);
    } else {
      if (rule) await rule.edit({ enabled: false });
    }
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message || "Failed" }); }
});

router.post("/api/guild/:id/automod/mention", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });
  try {
    if (req.client.isStandaloneMode) {
      await guild.autoModerationRules.mention(req.body.limit);
      return res.json({ success: true });
    }
    await guild.autoModerationRules.fetch();
    let rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam);
    if (rule) await rule.edit({ enabled: true, triggerMetadata: { mentionTotalLimit: req.body.limit } });
    else await guild.autoModerationRules.create({ name: "AutoMod: Mention Spam", enabled: true, eventType: AutoModerationRuleEventType.MessageSend, triggerType: AutoModerationRuleTriggerType.MentionSpam, triggerMetadata: { mentionTotalLimit: req.body.limit }, actions: [{ type: AutoModerationActionType.BlockMessage }] });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message || "Error" }); }
});

router.post("/api/guild/:id/automod/keyword", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });
  try {
    await guild.autoModerationRules.create({ name: `Block '${req.body.word}'`, enabled: true, eventType: AutoModerationRuleEventType.MessageSend, triggerType: AutoModerationRuleTriggerType.Keyword, triggerMetadata: { keywordFilter: [req.body.word] }, actions: [{ type: AutoModerationActionType.BlockMessage }] });
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message || "Failed" }); }
});

router.delete("/api/guild/:id/automod/keyword", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: "Guild not found" });
  try {
    if (req.client.isStandaloneMode) {
      await guild.autoModerationRules.deleteKeyword(req.body.word);
      return res.json({ success: true });
    }
    await guild.autoModerationRules.fetch();
    const rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.Keyword && r.triggerMetadata.keywordFilter?.includes(req.body.word));
    if (rule) await rule.delete();
    res.json({ success: true });
  } catch (err) { res.status(err.status || 500).json({ error: err.message || "Failed" }); }
});

router.post("/api/guild/:id/automod/logchannel", isAuth, checkDashboardAccess('moderation'), async (req, res) => {
  const guild = req.client.guilds.cache.get(req.params.id);
  const { channelId } = req.body;
  if (!guild) return res.status(404).json({ error: "Guild not found" });

  try {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) return res.status(400).json({ error: "Invalid text channel" });
    // req.client.db is not available in standalone — skip, or save to mongo directly if needed
    if (req.client.db) await req.client.db.set(`automodLog_${guild.id}`, { channelId });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save log channel" });
  }
});

module.exports = router;
