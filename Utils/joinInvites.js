"use strict";

/**
 * Hands the invite a member joined with from the invite tracker (guildMemberAdd_invite)
 * to the welcome message, which runs at the same time on the same event.
 * The tracker publishes, the welcome system waits a few seconds for it.
 */

const TTL = 15_000;
const slots = new Map(); // "guildId:memberId" -> { promise, resolve }

function slot(guildId, memberId) {
  const key = `${guildId}:${memberId}`;
  let s = slots.get(key);
  if (!s) {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    s = { promise, resolve };
    slots.set(key, s);
    setTimeout(() => { s.resolve(null); slots.delete(key); }, TTL).unref?.();
  }
  return s;
}

/**
 * info: { inviterId, inviterName, code, isVanity, invites, regular, fake, left, bonus, fakeAccount }
 * or null when it couldn't be worked out
 */
function publish(guildId, memberId, info) {
  slot(guildId, memberId).resolve(info);
}

function waitFor(guildId, memberId, timeoutMs = 5000) {
  return Promise.race([
    slot(guildId, memberId).promise,
    new Promise(r => setTimeout(() => r(null), timeoutMs)),
  ]);
}

/** "Invited by" text for welcome/goodbye messages (mentions render in embeds without pinging). */
function describe(info) {
  if (!info) return 'Unknown';
  if (info.isVanity) return `Vanity URL${info.code ? ` (\`${info.code}\`)` : ''}`;
  if (!info.inviterId) return 'Unknown';
  const n = info.invites;
  return `<@${info.inviterId}>${n != null ? ` · **${n}** invite${n === 1 ? '' : 's'}` : ''}`;
}

/** Fills a stats object from an InviteStats document (total = invites + bonus). */
function statsInfo(doc) {
  if (!doc) return { invites: 0, regular: 0, fake: 0, left: 0, bonus: 0 };
  return {
    invites: (doc.invites || 0) + (doc.bonus || 0),
    regular: doc.regular || 0,
    fake:    doc.fake || 0,
    left:    doc.left || 0,
    bonus:   doc.bonus || 0,
  };
}

const num = v => (v != null ? String(v) : '0');

/** {inviter} {inviterName} {invites} {regular} {fake} {left} {bonus} {inviteCode} {fakeAccount} */
function applyInviteVars(str, info) {
  if (!str) return str;
  const who = info?.isVanity ? 'Vanity URL' : null;
  return str
    .replace(/{inviterName}/g, who || info?.inviterName || 'Unknown')
    .replace(/{inviter}/g, who || (info?.inviterId ? `<@${info.inviterId}>` : 'Unknown'))
    .replace(/{invites}/g, num(info?.invites))
    .replace(/{regular}/g, num(info?.regular))
    .replace(/{fake}/g, num(info?.fake))
    .replace(/{left}/g, num(info?.left))
    .replace(/{bonus}/g, num(info?.bonus))
    .replace(/{inviteCode}/g, info?.code || 'unknown')
    .replace(/{fakeAccount}/g, info?.fakeAccount ? 'yes' : 'no');
}

const DEFAULT_TITLE = '📨 Invited by';

/**
 * The invite block for a welcome/goodbye message, using the server's own title/text when set.
 * vars: the message's normal placeholder function (for {user}, {server}, …) applied on top.
 */
function inviteBlock(data, info, vars = s => s) {
  const title = (data.inviteTitle || '').trim() || DEFAULT_TITLE;
  const text  = (data.inviteText  || '').trim()
    ? vars(applyInviteVars(data.inviteText, info))
    : describe(info);
  return { title: vars(title).slice(0, 256), text: text.slice(0, 1024) || 'Unknown' };
}

/**
 * Embed titles, author names, footers and field names show mentions as raw <@id> text,
 * so swap them for plain @names there. names: { userId: displayName }
 */
function unmention(str, names = {}) {
  if (!str) return str;
  return str.replace(/<@!?(\d+)>/g, (_, id) => `@${names[id] || 'user'}`);
}

module.exports = { publish, waitFor, describe, applyInviteVars, inviteBlock, statsInfo, unmention };
