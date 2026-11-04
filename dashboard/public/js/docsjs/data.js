// docsjs/data.js — Central data aggregator
import { essentialGuides }  from './guides/essentials.js';
import { moderationGuides } from './guides/moderation.js';
import { toolsGuides }      from './guides/tools.js';
import { communityGuides }  from './guides/community.js';
import { advancedGuides }   from './guides/advanced.js';
import { funGuides }        from './guides/fun.js';
import { economyGuides }    from './guides/economy.js';
export { FAQS }             from './faq.js';

export const GUIDES = {
  ...essentialGuides,
  ...moderationGuides,
  ...toolsGuides,
  ...communityGuides,
  ...advancedGuides,
  ...funGuides,
  ...economyGuides,
};

export const CATEGORIES = [
  { name:'Essentials',  icon:'rocket',    color:'#FF3333', bg:'rgba(255,51,51,.1)',   border:'rgba(255,51,51,.2)',   guides:['getting-started','dashboard-overview','premium'] },
  { name:'Moderation',  icon:'shield',    color:'#f87171', bg:'rgba(248,113,113,.1)', border:'rgba(248,113,113,.2)', guides:['moderation','logging','automod','antinuke','antiraid','antiscam','ghost-ping','ip-verification'] },
  { name:'Tools',       icon:'wrench',    color:'#6C53FF', bg:'rgba(108,83,255,.1)',  border:'rgba(108,83,255,.2)',  guides:['tickets','custom-commands','autoresponders','staff-apps','embed-builder','sticky-messages','join-to-create'] },
  { name:'Community',   icon:'users',     color:'#34d399', bg:'rgba(52,211,153,.1)',  border:'rgba(52,211,153,.2)',  guides:['welcome','autorole','leveling','reaction-roles','suggestions','giveaways','booster','invite-tracking','afk','reputation','music','notifications'] },
  { name:'Fun',         icon:'laugh',     color:'#f472b6', bg:'rgba(244,114,182,.1)', border:'rgba(244,114,182,.2)', guides:['fun-commands','polls','counting','confessions','games','family'] },
  { name:'Economy',     icon:'coins',     color:'#f59e0b', bg:'rgba(245,158,11,.1)',  border:'rgba(245,158,11,.2)',  guides:['economy'] },
  { name:'Advanced',    icon:'zap',       color:'#c084fc', bg:'rgba(192,132,252,.1)', border:'rgba(192,132,252,.2)', guides:['custom-branding','backups','ai-chatbot','mass-tools','utility-tools'] },
  { name:'Help',        icon:'life-buoy', color:'#94a3b8', bg:'rgba(148,163,184,.1)', border:'rgba(148,163,184,.2)', guides:['troubleshooting'] },
];