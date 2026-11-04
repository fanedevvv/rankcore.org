'use strict';

const { getClient } = require('./redis');

const DEFAULT_TTL   = 60;
const PREFIX        = 'noxx:cache:';
const STALE_MS      = 5000;

function _key(namespace, key) {
  return `${PREFIX}${namespace}:${key}`;
}

/**
 * Get a cached value. Returns null on miss or error.
 */
async function get(namespace, key) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return null;
    const raw = await redis.get(_key(namespace, key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set a cached value with a TTL in seconds.
 */
async function set(namespace, key, value, ttl = DEFAULT_TTL) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return;
    const k = _key(namespace, key);
    const payload = JSON.stringify({
      v: value,
      ts: Date.now(),
    });
    await redis.setex(k, ttl, payload);
  } catch {}
}

/**
 * Invalidate a specific cache key.
 */
async function del(namespace, key) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return;
    await redis.del(_key(namespace, key));
  } catch {}
}

/**
 * Invalidate all keys under a namespace (uses SCAN for safety).
 */
async function invalidateNamespace(namespace) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return;
    const pattern = `${PREFIX}${namespace}:*`;
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {}
}

/**
 * Wrap a function with read-through caching.
 * On cache hit, returns cached value.
 * On miss, calls fn(), caches the result, and returns it.
 * Handles stale-while-revalidate: if TTL is expired but within STALE_MS, returns
 * the stale value while asynchronously refreshing in the background.
 */
async function wrap(namespace, key, fn, ttl = DEFAULT_TTL) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return fn();

    const k = _key(namespace, key);
    const raw = await redis.get(k);

    if (raw) {
      const parsed = JSON.parse(raw);
      const age = Date.now() - parsed.ts;
      const ttlMs = ttl * 1000;

      if (age < ttlMs) {
        return parsed.v;
      }

      if (age < ttlMs + STALE_MS) {
        fn().then(v => set(namespace, key, v, ttl)).catch(() => {});
        return parsed.v;
      }
    }

    const value = await fn();
    await set(namespace, key, value, ttl);
    return value;
  } catch {
    return fn();
  }
}

/**
 * Rate limiter using Redis sorted sets (sliding window).
 * Returns { allowed: boolean, remaining: number, resetMs: number }
 */
async function checkRateLimit(key, maxRequests, windowMs) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return { allowed: true, remaining: maxRequests, resetMs: 0 };

    const rk = `${PREFIX}ratelimit:${key}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(rk, 0, cutoff);
    pipeline.zcard(rk);
    pipeline.zadd(rk, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
    pipeline.expire(rk, Math.ceil(windowMs / 1000) + 1);
    const results = await pipeline.exec();

    const count = results?.[1]?.[1] || 0;
    const allowed = count < maxRequests;
    const remaining = Math.max(0, maxRequests - count - 1);

    const oldest = await redis.zrange(rk, 0, 0, 'WITHSCORES');
    const oldestTs = oldest?.[1] ? parseInt(oldest[1]) : now;
    const resetMs = oldestTs + windowMs - now;

    return { allowed, remaining: Math.max(0, remaining), resetMs: Math.max(0, resetMs) };
  } catch {
    return { allowed: true, remaining: maxRequests, resetMs: 0 };
  }
}

/**
 * Increment a counter. Returns the new value.
 */
async function incr(key, ttl = 3600) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return null;
    const rk = `${PREFIX}counter:${key}`;
    const val = await redis.incr(rk);
    if (val === 1) await redis.expire(rk, ttl);
    return val;
  } catch {
    return null;
  }
}

/**
 * Get a counter value without incrementing.
 */
async function getCounter(key) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return 0;
    const val = await redis.get(`${PREFIX}counter:${key}`);
    return parseInt(val) || 0;
  } catch {
    return 0;
  }
}

/**
 * Simple distributed lock. Returns unlock function or null if already held.
 */
async function lock(name, ttlMs = 10_000) {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return null;
    const lk = `${PREFIX}lock:${name}`;
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const acquired = await redis.set(lk, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return null;
    return async () => {
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
      await redis.eval(script, 1, lk, token).catch(() => {});
    };
  } catch {
    return null;
  }
}

module.exports = {
  get,
  set,
  del,
  invalidateNamespace,
  wrap,
  checkRateLimit,
  incr,
  getCounter,
  lock,
};
