'use strict';

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let _client = null;
let _status  = { connected: false, status: 'disconnected', connectedAt: null, lastError: null, reconnectCount: 0 };

function _log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`\x1b[35m[Redis]\x1b[0m ${msg}`);
}

function createClient() {
  if (_client && _client.status === 'ready') return _client;

  _log('Connecting...');

  const isCluster = REDIS_URL.includes(',') || REDIS_URL.startsWith('cluster:');

  if (isCluster) {
    const nodes = REDIS_URL.replace('cluster://', '').split(',').map(u => {
      const url = new URL(u.trim());
      return { host: url.hostname, port: parseInt(url.port || '6379') };
    });
    _client = new Redis.Cluster(nodes, {
      scaleReads: 'slave',
      redisOptions: {
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          _status.reconnectCount = times;
          if (times > 10) return null;
          return Math.min(times * 200, 3000);
        },
        reconnectOnError(err) {
          const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
          return targetErrors.some(e => err.message.includes(e));
        },
      },
    });
  } else {
    _client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        _status.reconnectCount = times;
        if (times > 10) { _log('Max retries exceeded — giving up'); return null; }
        const delay = Math.min(times * 200, 3000);
        _log(`Reconnect attempt ${times} in ${delay}ms`);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some(e => err.message.includes(e));
      },
      enableOfflineQueue: true,
      lazyConnect: false,
    });
  }

  _client.on('connect', () => {
    _log('Connected');
    _status.status = 'connecting';
  });

  _client.on('ready', async () => {
    _status.connected = true;
    _status.status = 'connected';
    _status.connectedAt = Date.now();
    _status.reconnectCount = 0;
    _status.lastError = null;
    try {
      const info = await _client.info('server');
      const m = info.match(/redis_version:(\S+)/);
      _status.version = m?.[1] || null;
      const mu = info.match(/used_memory_human:(\S+)/);
      _status.usedMemory = mu?.[1] || null;
    } catch {}
    _log(`Ready (v${_status.version || '?'}, ${_status.usedMemory || '?'})`);
  });

  _client.on('error', (err) => {
    _status.lastError = err.message;
    _log(`Error: ${err.message}`);
  });

  _client.on('close', () => {
    _status.connected = false;
    _status.status = 'disconnected';
    _log('Connection closed');
  });

  _client.on('reconnecting', () => {
    _status.status = 'reconnecting';
    _log(`Reconnecting (attempt ${_status.reconnectCount})`);
  });

  return _client;
}

function getClient() {
  if (!_client) return createClient();
  if (_client.status !== 'ready' && _client.status !== 'connecting') {
    _client = null;
    return createClient();
  }
  return _client;
}

function getStatus() {
  return {
    connected:     _status.connected,
    status:        _status.status,
    connectedAt:   _status.connectedAt,
    lastError:     _status.lastError,
    reconnectCount: _status.reconnectCount,
    version:       _status.version,
    usedMemory:    _status.usedMemory,
  };
}

async function closeClient() {
  if (_client) {
    await _client.quit().catch(() => {});
    _client = null;
    _status = { connected: false, status: 'disconnected', connectedAt: null, lastError: null, reconnectCount: 0 };
  }
}

module.exports = { createClient, getClient, getStatus, closeClient };
