'use strict';

const { MessageFlags } = require('discord.js');
const { parseEmoji }   = require('../../../Utils/emojis');

// ─────────────────────────────────────────────────────────────────────────────
// Priority metadata
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_META = {
  low:    { label: 'Low',    slug: 'low',    emoji: parseEmoji('<:LEgreen:1555544256356159600>'), color: 0x22c55e, hex: '#22c55e' },
  medium: { label: 'Medium', slug: 'medium', emoji: parseEmoji('<:error:1555544434601369620>'),  color: 0xeab308, hex: '#eab308' },
  high:   { label: 'High',   slug: 'high',   emoji: parseEmoji('<:error:1555544434601369620>'),  color: 0xf97316, hex: '#f97316' },
  urgent: { label: 'Urgent', slug: 'urgent', emoji: parseEmoji('<:LEred:1555544262123323422>'),  color: 0xef4444, hex: '#ef4444' },
};

// IsComponentsV2 flag — tells Discord to render Components V2 layout
const CV2 = MessageFlags.IsComponentsV2;

module.exports = { PRIORITY_META, CV2 };