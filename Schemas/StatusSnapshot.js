const mongoose = require('mongoose');

const statusSnapshotSchema = new mongoose.Schema({
  ts:               { type: Number, required: true, index: true },
  status:           { type: String, enum: ['up', 'degraded', 'down'], required: true },
  ping:             { type: Number, default: -1 },
  degradedModules:  [{
    name:  String,
    label: String,
    state: String,
    error: String,
  }],
}, {
  versionKey: false,
  timestamps: false,
});

statusSnapshotSchema.index({ ts: -1 });
statusSnapshotSchema.index({ status: 1 });

statusSnapshotSchema.statics.recordSnapshot = async function (ts, status, ping, degradedModules = []) {
  return this.create({ ts, status, ping, degradedModules });
};

statusSnapshotSchema.statics.getHistory = async function (since) {
  const query = since ? { ts: { $gte: since } } : {};
  return this.find(query).sort({ ts: -1 }).lean();
};

statusSnapshotSchema.statics.buildDailyHistory = async function (daysBack = 90) {
  const now = Date.now();
  const since = now - daysBack * 86400000;
  const snapshots = await this.find({ ts: { $gte: since } }).sort({ ts: -1 }).lean();

  const days = [];

  for (let d = daysBack - 1; d >= 0; d--) {
    const dayStart = now - d * 86400000 - (now % 86400000);
    const dayEnd = dayStart + 86400000;
    const snaps = snapshots.filter(e => e.ts >= dayStart && e.ts < dayEnd);

    if (snaps.length === 0) {
      days.push({ date: new Date(dayStart).toISOString().slice(0, 10), state: 'nodata', uptime: null, pings: [] });
      continue;
    }

    const total    = snaps.length;
    const upCount  = snaps.filter(s => s.status === 'up').length;
    const degCount = snaps.filter(s => s.status === 'degraded').length;
    const downCount = snaps.filter(s => s.status === 'down').length;
    const pct      = ((upCount + degCount * 0.5) / total * 100);
    const pings    = snaps.filter(s => s.ping >= 0).map(s => s.ping);
    const avgPing  = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : -1;

    let state;
    if (downCount / total > 0.5) state = 'down';
    else if (upCount / total < 0.9) state = 'partial';
    else state = 'ok';

    days.push({
      date:   new Date(dayStart).toISOString().slice(0, 10),
      state,
      uptime: parseFloat(pct.toFixed(2)),
      avgPing,
    });
  }

  const knownDays = days.filter(d => d.state !== 'nodata');
  let overallUptime = null;
  if (knownDays.length > 0) {
    const score = knownDays.reduce((acc, d) => {
      if (d.state === 'ok') return acc + 1;
      if (d.state === 'partial') return acc + 0.5;
      return acc;
    }, 0);
    overallUptime = parseFloat((score / knownDays.length * 100).toFixed(2));
  }

  return { days, overallUptime, trackedDays: knownDays.length };
};

statusSnapshotSchema.statics.cleanupOld = async function (maxAgeMs = 180 * 86400000) {
  const cutoff = Date.now() - maxAgeMs;
  return this.deleteMany({ ts: { $lt: cutoff } });
};

module.exports = mongoose.models.StatusSnapshot || mongoose.model('StatusSnapshot', statusSnapshotSchema);
