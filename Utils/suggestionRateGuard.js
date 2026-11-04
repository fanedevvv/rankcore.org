"use strict";

/**
 * suggestionRateGuard.js
 *
 * Centralises every Discord-API call made by the suggestion system so we never
 * hammer a single route bucket.  Four layers of protection:
 *
 *  1. Per-message edit deduplication — if the embed for a given messageId was
 *     already queued / sent within EDIT_DEBOUNCE_MS we skip the redundant edit.
 *     This is the most important guard: rapid simultaneous votes on a popular
 *     suggestion would otherwise fire one msg.edit() per vote.
 *
 *  2. Global sequential queue — all outbound API calls (send, edit, DM, thread)
 *     are enqueued and dispatched one-at-a-time with a MIN_INTERVAL_MS gap
 *     between them.  Discord allows ~50 req/s globally but each route bucket is
 *     much tighter; spacing calls is the safest approach.
 *
 *  3. Per-channel bucket throttle — channel.send / message.edit share the same
 *     Discord route bucket (5 req / 5 s per channel).  We track the last send/
 *     edit time per channelId and delay calls that arrive too soon.
 *
 *  4. Automatic retry on 429 — if Discord.js still surfaces a RateLimitError
 *     we wait retry_after ms and re-attempt once before logging and giving up.
 */

// ── Tunables ─────────────────────────────────────────────────────────────────

/** Minimum gap between consecutive outbound API calls (ms). */
const MIN_INTERVAL_MS   = 300;

/** If we already queued an edit for this messageId within this window, drop the
 *  duplicate.  Set to 0 to disable deduplication. */
const EDIT_DEBOUNCE_MS  = 1_500;

/** Per-channel minimum gap between send / edit calls (ms).
 *  Discord's channel message bucket is 5 req / 5 000 ms = 1 000 ms safe floor. */
const CHANNEL_GAP_MS    = 1_100;

/** How long to wait before giving up on a queued call entirely (ms). */
const CALL_TIMEOUT_MS   = 15_000;

// ── State ─────────────────────────────────────────────────────────────────────

/** Queue of { fn, resolve, reject, timeoutHandle } */
const _queue = [];
let   _running = false;

/** messageId → timestamp of last queued edit */
const _editDebounce = new Map();

/** channelId → timestamp of last send/edit */
const _channelBucket = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Run the queue one item at a time. */
async function _drain() {
  if (_running) return;
  _running = true;

  while (_queue.length > 0) {
    const item = _queue.shift();
    clearTimeout(item.timeoutHandle);

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      // Retry once on a Discord rate-limit
      if (err?.status === 429 || err?.code === 429 || err?.name === "RateLimitError") {
        const retryAfter = (err.retryAfter ?? err.timeout ?? 1000);
        console.warn(`[SugRateGuard] 429 hit — waiting ${retryAfter}ms before retry`);
        await sleep(retryAfter + 50);
        try {
          const result = await item.fn();
          item.resolve(result);
        } catch (retryErr) {
          console.error("[SugRateGuard] retry also failed:", retryErr?.message ?? retryErr);
          item.reject(retryErr);
        }
      } else {
        item.reject(err);
      }
    }

    // Mandatory inter-call gap
    await sleep(MIN_INTERVAL_MS);
  }

  _running = false;
}

/**
 * Enqueue a Discord API call.
 * @param {Function} fn   Async function that performs the API call.
 * @param {object}  opts  { priority: bool }  — priority items jump the queue.
 * @returns {Promise<any>} Resolves/rejects with the result of fn().
 */
function enqueue(fn, opts = {}) {
  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      // Remove from queue if not yet running
      const idx = _queue.findIndex(i => i.resolve === resolve);
      if (idx !== -1) _queue.splice(idx, 1);
      reject(new Error("[SugRateGuard] call timed out after " + CALL_TIMEOUT_MS + "ms"));
    }, CALL_TIMEOUT_MS);

    const item = { fn, resolve, reject, timeoutHandle };

    if (opts.priority) {
      _queue.unshift(item);
    } else {
      _queue.push(item);
    }

    _drain();
  });
}

/**
 * Wait until the per-channel bucket allows another send/edit.
 * Call this inside the fn passed to enqueue().
 */
async function waitForChannelBucket(channelId) {
  const last = _channelBucket.get(channelId) ?? 0;
  const wait = CHANNEL_GAP_MS - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  _channelBucket.set(channelId, Date.now());
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Edit a suggestion message.
 * Deduplicates — if an edit for this messageId was already queued within
 * EDIT_DEBOUNCE_MS, we skip and return null instead of hammering.
 */
async function editSuggestionMessage(msg, payload) {
  const messageId = msg.id;
  const channelId = msg.channelId;
  const now = Date.now();

  const lastEdit = _editDebounce.get(messageId) ?? 0;
  if (now - lastEdit < EDIT_DEBOUNCE_MS) {
    // Duplicate edit within debounce window — drop it
    return null;
  }
  _editDebounce.set(messageId, now);

  return enqueue(async () => {
    await waitForChannelBucket(channelId);
    return msg.edit(payload);
  });
}

/**
 * Send a message to a channel.
 */
async function sendToChannel(channel, payload) {
  return enqueue(async () => {
    await waitForChannelBucket(channel.id);
    return channel.send(payload);
  });
}

/**
 * Send a DM to a user.
 * DMs have a separate bucket; we still serialize them through the global queue
 * so we never fire several DMs at once (e.g. bulk-approve scenario).
 */
async function sendDM(user, payload) {
  return enqueue(async () => {
    return user.send(payload);
  });
}

/**
 * Fetch a message (read-only, lower risk but still rate-limited).
 * Results are not cached here — callers should use .cache first.
 */
async function fetchMessage(channel, messageId) {
  return enqueue(async () => {
    return channel.messages.fetch(messageId);
  }, { priority: true }); // fetches are priority — they unblock edits
}

/**
 * Fetch a user (read-only).
 */
async function fetchUser(client, userId) {
  return enqueue(async () => {
    return client.users.fetch(userId);
  }, { priority: true });
}

/**
 * Start a thread on a message.
 */
async function startThread(msg, opts) {
  return enqueue(async () => {
    return msg.startThread(opts);
  });
}

/**
 * Delete a message.
 */
async function deleteMessage(msg) {
  return enqueue(async () => {
    return msg.delete();
  });
}

/**
 * Clears stale debounce entries to prevent the Map growing without bound.
 * Called automatically every 10 minutes.
 */
function _gcDebounceMap() {
  const cutoff = Date.now() - EDIT_DEBOUNCE_MS * 10;
  for (const [k, v] of _editDebounce) {
    if (v < cutoff) _editDebounce.delete(k);
  }
  for (const [k, v] of _channelBucket) {
    if (v < cutoff) _channelBucket.delete(k);
  }
}
setInterval(_gcDebounceMap, 10 * 60 * 1000).unref();

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  enqueue,
  editSuggestionMessage,
  sendToChannel,
  sendDM,
  fetchMessage,
  fetchUser,
  startThread,
  deleteMessage,
};