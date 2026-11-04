const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  incidentId:        { type: String, required: true, unique: true },
  openedAt:          { type: Number, required: true, index: true },
  resolvedAt:        { type: Number, default: null },
  status:            { type: String, enum: ['ongoing', 'resolved'], default: 'ongoing', index: true },
  severity:          { type: String, enum: ['degraded', 'down'], default: 'degraded' },
  title:             { type: String, required: true },
  body:              { type: String, default: '' },
  modulesAtOpen:     { type: [String], default: [] },
  manuallyTriggered: { type: Boolean, default: false },
  triggeredBy:       { type: String, default: null },
  updates:           [{
    ts:   Number,
    body: String,
  }],
}, {
  versionKey: false,
  timestamps: false,
});

incidentSchema.index({ status: 1, openedAt: -1 });

incidentSchema.statics.getOngoing = async function () {
  return this.findOne({ status: 'ongoing' }).lean();
};

incidentSchema.statics.getRecent = async function (limit = 5) {
  return this.find({ status: 'resolved' }).sort({ resolvedAt: -1 }).limit(limit).lean();
};

incidentSchema.statics.createIncident = async function (data) {
  const id = data.incidentId || `inc_${Date.now()}`;
  const existing = await this.findOne({ status: 'ongoing' });
  if (existing) return existing;

  return this.create({
    incidentId: id,
    openedAt: data.openedAt || Date.now(),
    resolvedAt: null,
    status: 'ongoing',
    severity: data.severity || 'degraded',
    title: data.title || 'Incident',
    body: data.body || '',
    modulesAtOpen: data.modulesAtOpen || [],
    manuallyTriggered: data.manuallyTriggered || false,
    triggeredBy: data.triggeredBy || null,
    updates: data.updates || [],
  });
};

incidentSchema.statics.addUpdate = async function (body) {
  const inc = await this.findOne({ status: 'ongoing' });
  if (!inc) return null;

  inc.updates.push({ ts: Date.now(), body });
  return inc.save();
};

incidentSchema.statics.resolveIncident = async function (context = {}) {
  const inc = await this.findOne({ status: 'ongoing' });
  if (!inc) return null;

  inc.status = 'resolved';
  inc.resolvedAt = Date.now();
  inc.body += ' ' + (context.body || '');
  if (context.body) {
    inc.updates.push({ ts: inc.resolvedAt, body: context.body });
  }
  return inc.save();
};

incidentSchema.statics.cleanupOld = async function (maxAgeMs = 90 * 86400000) {
  const cutoff = Date.now() - maxAgeMs;
  return this.deleteMany({ resolvedAt: { $lt: cutoff } });
};

module.exports = mongoose.models.Incident || mongoose.model('Incident', incidentSchema);
