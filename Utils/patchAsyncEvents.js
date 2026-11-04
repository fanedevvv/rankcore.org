'use strict';
/**
 * patchAsyncEvents.js
 *
 * Patches EventEmitter so every async listener registered via .on() / .once()
 * is automatically wrapped in a try/catch. Any unhandled error is logged but
 * NEVER re-thrown — the bot stays alive no matter what any individual event
 * handler does.
 *
 * Call patchAsyncEvents() once at startup before the Discord client is created.
 * After that, every client.on('messageCreate', async () => { ... }) and similar
 * calls are automatically safe.
 */

const EventEmitter = require('events');

let _patched = false;

function patchAsyncEvents() {
  if (_patched) return;
  _patched = true;

  const _on   = EventEmitter.prototype.on;
  const _once = EventEmitter.prototype.once;
  const _addListener = EventEmitter.prototype.addListener;

  function wrapListener(event, listener, source) {
    if (typeof listener !== 'function') return listener;
    // Only wrap async functions (they return Promises that can reject)
    // Sync listeners either don't throw or are caught by EventEmitter's own error path
    const isAsync = listener.constructor?.name === 'AsyncFunction' ||
                    listener.toString().startsWith('async ');
    if (!isAsync) return listener;

    return async function wrappedAsyncListener(...args) {
      try {
        await listener.apply(this, args);
      } catch (err) {
        // Swallow dead interaction errors silently
        const dead = new Set([10062, 40060, 10008]);
        if (dead.has(err?.code)) return;
        if (/unknown interaction/i.test(err?.message ?? '')) return;
        if (/already.*acknowledged/i.test(err?.message ?? '')) return;

        console.error(
          `\x1b[31m[ASYNC EVENT ERROR]\x1b[0m Event: \x1b[33m${String(event)}\x1b[0m` +
          (source ? ` | Source: ${source}` : '') +
          `\n${err?.stack ?? err?.message ?? err}`
        );
      }
    };
  }

  EventEmitter.prototype.on = function patchedOn(event, listener) {
    return _on.call(this, event, wrapListener(event, listener));
  };

  EventEmitter.prototype.addListener = function patchedAddListener(event, listener) {
    return _addListener.call(this, event, wrapListener(event, listener));
  };

  EventEmitter.prototype.once = function patchedOnce(event, listener) {
    return _once.call(this, event, wrapListener(event, listener));
  };

  console.log('\x1b[32m[patchAsyncEvents]\x1b[0m All async EventEmitter listeners are now crash-protected.');
}

module.exports = { patchAsyncEvents };
