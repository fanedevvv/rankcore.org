'use strict';

// Routes:
//   GET    /internal/guild/:id/automod
//   POST   /internal/guild/:id/automod/toggle
//   POST   /internal/guild/:id/automod/mention
//   POST   /internal/guild/:id/automod/keyword
//   DELETE /internal/guild/:id/automod/keyword

const { Router } = require('express');
const {
  AutoModerationRuleTriggerType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationActionType,
} = require('discord.js');

const linkRegexes = ['http[s]?://', 'www\\.', '\\.com', '\\.net', '\\.org', 'discord\\.gg', 'discord\\.com/invite'];

module.exports = (client) => {
  const router   = Router();
  const getGuild = (id) => client.guilds.cache.get(id) || null;

  // Turns Discord errors into messages the dashboard can show as-is
  const fail = (res, err) => {
    if (err.code === 50013)
      return res.status(403).json({ error: 'Roco needs the "Manage Server" permission to manage AutoMod rules.' });
    if (/maximum number/i.test(err.message || ''))
      return res.status(409).json({ error: 'Discord\'s AutoMod rule limit for this server is reached. Delete an unused rule in Server Settings → AutoMod.' });
    return res.status(500).json({ error: err.message });
  };
  const BLOCKED_WORDS = 'AutoMod: Blocked Words';
  const isWordRule = r => r.triggerType === AutoModerationRuleTriggerType.Keyword && !r.triggerMetadata.regexPatterns?.length;

  // ── Get automod status ────────────────────────────────────────────────────

  router.get('/internal/guild/:id/automod', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    try {
      await guild.autoModerationRules.fetch();
      const rules = guild.autoModerationRules.cache;

      const profanity   = rules.some(r => r.triggerType === AutoModerationRuleTriggerType.KeywordPreset && r.enabled);
      const spam        = rules.some(r => r.triggerType === AutoModerationRuleTriggerType.Spam && r.enabled);
      const antilink    = rules.some(r =>
        r.triggerType === AutoModerationRuleTriggerType.Keyword &&
        r.triggerMetadata.regexPatterns?.some(p => linkRegexes.includes(p)) && r.enabled
      );
      const mentionRule = rules.find(r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam && r.enabled);
      const keywords    = [...new Set(rules.filter(isWordRule).flatMap(r => r.triggerMetadata.keywordFilter || []))];

      res.json({
        profanity, spam, antilink,
        mentionSpam: { enabled: !!mentionRule, limit: mentionRule?.triggerMetadata.mentionTotalLimit ?? null },
        keywords,
      });
    } catch (err) {
      // 50013 = Missing Permissions: Roco needs Manage Server to read AutoMod rules
      fail(res, err);
    }
  });

  // ── Toggle profanity / spam / antilink ───────────────────────────────────

  router.post('/internal/guild/:id/automod/toggle', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });
    const { type, enabled } = req.body;
    try {
      await guild.autoModerationRules.fetch();
      let rule     = null;
      let ruleData = {
        enabled:   true,
        eventType: AutoModerationRuleEventType.MessageSend,
        actions:   [{ type: AutoModerationActionType.BlockMessage }],
        reason:    'Dashboard Toggle',
      };

      if (type === 'profanity') {
        rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.KeywordPreset);
        ruleData.name = 'AutoMod: Profanity';
        ruleData.triggerType = AutoModerationRuleTriggerType.KeywordPreset;
        ruleData.triggerMetadata = { presets: [AutoModerationRuleKeywordPresetType.Profanity, AutoModerationRuleKeywordPresetType.Slurs] };
      } else if (type === 'spam') {
        rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.Spam);
        ruleData.name = 'AutoMod: Spam';
        ruleData.triggerType = AutoModerationRuleTriggerType.Spam;
      } else if (type === 'antilink') {
        rule = guild.autoModerationRules.cache.find(r =>
          r.triggerType === AutoModerationRuleTriggerType.Keyword &&
          r.triggerMetadata.regexPatterns?.some(p => linkRegexes.includes(p))
        );
        ruleData.name = 'Anti-Link';
        ruleData.triggerType = AutoModerationRuleTriggerType.Keyword;
        ruleData.triggerMetadata = { regexPatterns: linkRegexes };
      }

      if (enabled) {
        if (rule) await rule.edit({ enabled: true });
        else      await guild.autoModerationRules.create(ruleData);
      } else {
        if (rule) await rule.edit({ enabled: false });
      }

      res.json({ success: true });
    } catch (err) { fail(res, err); }
  });

  // ── Mention spam limit ────────────────────────────────────────────────────

  router.post('/internal/guild/:id/automod/mention', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const limit = parseInt(req.body.limit);
    if (isNaN(limit) || limit < 2 || limit > 50)
      return res.status(400).json({ error: 'limit must be an integer between 2 and 50' });

    try {
      await guild.autoModerationRules.fetch();
      let rule = guild.autoModerationRules.cache.find(r => r.triggerType === AutoModerationRuleTriggerType.MentionSpam);
      if (rule) {
        try {
          await rule.edit({ enabled: true, triggerMetadata: { mentionTotalLimit: limit } });
        } catch (err) {
          // Discord allows one mention spam rule per server; one made by another app may not be editable
          if (rule.creatorId !== guild.client.user.id) {
            return res.status(409).json({ error: `This server already has a mention spam rule from another bot ("${rule.name}"). Edit or delete it in Server Settings → AutoMod, then try again.` });
          }
          throw err;
        }
      } else {
        await guild.autoModerationRules.create({
          name:            'AutoMod: Mention Spam',
          enabled:         true,
          eventType:       AutoModerationRuleEventType.MessageSend,
          triggerType:     AutoModerationRuleTriggerType.MentionSpam,
          triggerMetadata: { mentionTotalLimit: limit },
          actions:         [{ type: AutoModerationActionType.BlockMessage }],
        });
      }
      res.json({ success: true });
    } catch (err) { fail(res, err); }
  });

  // ── Keyword block / unblock ───────────────────────────────────────────────

  router.post('/internal/guild/:id/automod/keyword', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const word = typeof req.body.word === 'string' ? req.body.word.trim().slice(0, 60) : null;
    if (!word) return res.status(400).json({ error: 'word must be a non-empty string' });

    try {
      await guild.autoModerationRules.fetch();
      const rules = guild.autoModerationRules.cache;
      if (rules.some(r => isWordRule(r) && r.triggerMetadata.keywordFilter?.includes(word)))
        return res.json({ success: true });
      // Discord allows only 6 keyword rules per server, so all blocked words share one rule
      const shared = rules.find(r => isWordRule(r) && r.name === BLOCKED_WORDS && r.creatorId === client.user.id);
      if (shared) {
        await shared.edit({ triggerMetadata: { ...shared.triggerMetadata, keywordFilter: [...shared.triggerMetadata.keywordFilter, word] } });
      } else {
        await guild.autoModerationRules.create({
          name:            BLOCKED_WORDS,
          enabled:         true,
          eventType:       AutoModerationRuleEventType.MessageSend,
          triggerType:     AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: { keywordFilter: [word] },
          actions:         [{ type: AutoModerationActionType.BlockMessage }],
        });
      }
      res.json({ success: true });
    } catch (err) { fail(res, err); }
  });

  router.delete('/internal/guild/:id/automod/keyword', async (req, res) => {
    const guild = getGuild(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    const word = typeof req.body.word === 'string' ? req.body.word.trim() : null;
    if (!word) return res.status(400).json({ error: 'word must be a non-empty string' });

    try {
      await guild.autoModerationRules.fetch();
      const rule = guild.autoModerationRules.cache.find(r =>
        r.triggerType === AutoModerationRuleTriggerType.Keyword &&
        r.triggerMetadata.keywordFilter?.includes(word)
      );
      if (rule) {
        const rest = rule.triggerMetadata.keywordFilter.filter(w => w !== word);
        if (rest.length) await rule.edit({ triggerMetadata: { ...rule.triggerMetadata, keywordFilter: rest } });
        else await rule.delete();
      }
      res.json({ success: true });
    } catch (err) { fail(res, err); }
  });

  return router;
};