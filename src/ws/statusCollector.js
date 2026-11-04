'use strict';

const os = require('os');
const { getStatus: getRedisStatus } = require('../lib/redis');

const STATUS_MAP = {
  0: 'ready',
  1: 'connecting',
  2: 'reconnecting',
  3: 'idle',
  4: 'nearly',
  5: 'disconnected',
  6: 'waiting_for_guilds',
  7: 'identifying',
  8: 'resuming',
};

function shardStatus(code) {
  return STATUS_MAP[code] || 'unknown';
}

function formatUptime(ms) {
  if (!ms || ms < 1000) return '0s';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

let _seq = 0;

function collectStatus(client) {
  _seq++;

  const ready = client?.isReady?.() ?? false;
  const ws = client?.ws;

  const shards = [];
  if (ws?.shards?.size) {
    for (const [id, shard] of ws.shards) {
      shards.push({
        id,
        status:      shardStatus(shard.status),
        ping:        shard.ping ?? -1,
        guildCount:  ready ? client.guilds.cache.filter(g => g.shardId === id).size : 0,
        state:       shardStatus(shard.status),
        lastPingAt:  shard.lastPingTimestamp || null,
      });
    }
  } else if (ready) {
    shards.push({
      id:          0,
      status:      'ready',
      ping:        ws?.ping ?? -1,
      guildCount:  client.guilds.cache.size,
      state:       'ready',
      lastPingAt:  Date.now(),
    });
  }

  const modules = {};
  try {
    if (client?.moduleManager) {
      const all = client.moduleManager.getAllStatus();
      if (Array.isArray(all)) {
        for (const m of all) {
          modules[m.name] = {
            state:         m.state,
            uptime:        m.uptime,
            error:         m.error,
            restartCount:  m.restartCount,
            label:         m.label,
            group:         m.group,
          };
        }
      }
    }
  } catch (_) {}

  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    type:      'status_update',
    seq:       _seq,
    timestamp: Date.now(),
    process: {
      pid:         process.pid,
      uptime:      process.uptime() * 1000,
      uptimeFmt:   formatUptime(process.uptime() * 1000),
      memory:      {
        rss:        Math.round(mem.rss / 1024 / 1024),
        heapUsed:   Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal:  Math.round(mem.heapTotal / 1024 / 1024),
        external:   Math.round(mem.external / 1024 / 1024),
      },
      node:        process.version,
      platform:    process.platform,
      cpus:        os.cpus().length,
      systemMem:   {
        total:     Math.round(totalMem / 1024 / 1024),
        free:      Math.round(freeMem / 1024 / 1024),
        usedPct:   Math.round((1 - freeMem / totalMem) * 100),
      },
    },
    bot: {
      id:           client?.user?.id || null,
      username:     client?.user?.username || null,
      ready,
      uptime:       client?.uptime || 0,
      uptimeFmt:    formatUptime(client?.uptime || 0),
      wsPing:       ws?.ping ?? -1,
      status:       ready ? 'online' : 'offline',
    },
    cluster: {
      id:          client?.cluster?.id ?? 0,
      shardCount:  ws?.shards?.size || 1,
      memory:      {
        rss:       Math.round(mem.rss / 1024 / 1024),
        heapUsed:  Math.round(mem.heapUsed / 1024 / 1024),
      },
    },
    shards,
    modules,
    redis: (() => {
      const rs = getRedisStatus();
      return {
        connected:    rs.connected,
        status:       rs.status,
        version:      rs.version || null,
        usedMemory:   rs.usedMemory || null,
        connectedAt:  rs.connectedAt,
      };
    })(),
    stats: {
      guildCount:   ready ? client.guilds.cache.size : 0,
      userCount:    ready ? client.users.cache.size : 0,
      channelCount: ready ? client.channels.cache.size : 0,
      commandCount: client?.commands?.size || 0,
    },
  };
}

function lookupGuild(client, guildId) {
  if (!client?.isReady?.()) {
    return {
      type:    'guild_lookup_result',
      guildId,
      found:   false,
      error:   'Bot is not ready',
    };
  }

  let guild;
  let clusterId = 0;
  let via = 'direct';

  if (client.cluster) {
    try {
      const results = client.cluster.broadcastEval(
        (c, { gid }) => {
          const g = c.guilds.cache.get(gid);
          if (!g) return null;
          return { clusterId: c.cluster.id, shardId: g.shardId };
        },
        { context: { gid: guildId } }
      );
      const found = results.find(Boolean);
      if (found) {
        return {
          type:        'guild_lookup_result',
          guildId,
          found:       true,
          clusterId:   found.clusterId,
          shardId:     found.shardId,
          via:         'broadcastEval',
        };
      }
    } catch (_) {}
  }

  guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return {
      type:    'guild_lookup_result',
      guildId,
      found:   false,
      error:   'Guild not found in any shard',
    };
  }

  return {
    type:      'guild_lookup_result',
    guildId,
    found:     true,
    clusterId,
    shardId:   guild.shardId,
    via:       'direct',
    guild:     {
      name:           guild.name,
      memberCount:    guild.memberCount,
      shardId:        guild.shardId,
    },
  };
}

function collectShardStatus(client) {
  const ws = client?.ws;
  const shards = [];

  if (ws?.shards?.size) {
    for (const [id, shard] of ws.shards) {
      shards.push({
        id:          id,
        status:      shardStatus(shard.status),
        ping:        shard.ping ?? -1,
        guildCount:  client.isReady() ? client.guilds.cache.filter(g => g.shardId === id).size : 0,
        state:       shardStatus(shard.status),
        lastPingAt:  shard.lastPingTimestamp || null,
      });
    }
  } else if (client?.isReady?.()) {
    shards.push({
      id:          0,
      status:      'ready',
      ping:        ws?.ping ?? -1,
      guildCount:  client.guilds.cache.size,
      state:       'ready',
      lastPingAt:  Date.now(),
    });
  }

  return {
    type:      'shard_update',
    timestamp: Date.now(),
    shards,
  };
}

function collectModuleUpdate(name, state, extra = {}) {
  return {
    type:      'module_update',
    timestamp: Date.now(),
    name,
    state,
    ...extra,
  };
}

module.exports = {
  collectStatus,
  lookupGuild,
  collectShardStatus,
  collectModuleUpdate,
  formatUptime,
};
