// ─── State ────────────────────────────────────────────────────────────────────
export const guildId = location.pathname.split('/')[2];

export let rateRules  = [];
export let warnSteps  = [];
export let wordGroups = [];
export let linkGroups = [];
export let regexRules = [];

export function setRateRules(v)  { rateRules.length  = 0; rateRules.push(...v);  }
export function setWarnSteps(v)  { warnSteps.length  = 0; warnSteps.push(...v);  }
export function setWordGroups(v) { wordGroups.length  = 0; wordGroups.push(...v); }
export function setLinkGroups(v) { linkGroups.length  = 0; linkGroups.push(...v); }
export function setRegexRules(v) { regexRules.length  = 0; regexRules.push(...v); }

export const RATE_TYPES = ['messages','mentions','attachments','emojis','newlines','caps','duplicates','links'];

export const RATE_LABELS = {
  messages:    'messages',
  mentions:    'mentions',
  attachments: 'attachments',
  emojis:      'emojis',
  newlines:    'lines',
  caps:        '% caps',
  duplicates:  'duplicates',
  links:       'links',
};

export const ACTIONS = [
  { value: 'warn',   label: 'Warn'   },
  { value: 'delete', label: 'Delete' },
  { value: 'mute',   label: 'Mute'   },
  { value: 'kick',   label: 'Kick'   },
  { value: 'ban',    label: 'Ban'    },
];