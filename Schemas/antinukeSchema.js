const mongoose = require('mongoose');

const PERMANENT_USER_ID = process.env.clientId;

const eventSettingSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: true },
    action: { type: String, default: 'inherit' },
    threshold: { type: Number, default: 0 },
    thresholdWindow: { type: Number, default: 10 }
}, { _id: false });

const punishmentLogSchema = new mongoose.Schema({
    executorId: String,
    executorTag: String,
    type: String,
    details: String,
    actionTaken: String,
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const antinukeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },

    // Global settings
    whitelist: { 
        type: [String], 
        default: () => [PERMANENT_USER_ID].filter(Boolean) // always added on new docs
    },

    trustedRoles: { type: [String], default: [] },
    logChannelId: { type: String, default: null },
    action: { type: String, default: 'log' },
    dmOwner: { type: Boolean, default: false },
    alertPing: { type: String, default: null },

    events: {
        memberKick:      { type: eventSettingSchema, default: () => ({}) },
        memberBan:       { type: eventSettingSchema, default: () => ({}) },
        banRemove:       { type: eventSettingSchema, default: () => ({}) },
        roleCreate:      { type: eventSettingSchema, default: () => ({}) },
        roleDelete:      { type: eventSettingSchema, default: () => ({}) },
        roleUpdate:      { type: eventSettingSchema, default: () => ({}) },
        channelCreate:   { type: eventSettingSchema, default: () => ({}) },
        channelDelete:   { type: eventSettingSchema, default: () => ({}) },
        channelUpdate:   { type: eventSettingSchema, default: () => ({}) },
        webhookCreate:   { type: eventSettingSchema, default: () => ({}) },
        botAdd:          { type: eventSettingSchema, default: () => ({}) },
        emojiCreate:     { type: eventSettingSchema, default: () => ({}) },
        emojiDelete:     { type: eventSettingSchema, default: () => ({}) },
        guildUpdate:     { type: eventSettingSchema, default: () => ({}) },
        memberRoleUpdate:{ type: eventSettingSchema, default: () => ({}) },
        integrationCreate:{ type: eventSettingSchema, default: () => ({}) },
    },

    punishmentLog: { type: [punishmentLogSchema], default: [] },

    createdAt: { type: Date, default: Date.now }
});

// <:lockk:1555544494441635860> Force permanent ID in whitelist
antinukeSchema.pre('save', function(next) {
    if (PERMANENT_USER_ID && !this.whitelist.includes(PERMANENT_USER_ID)) {
        this.whitelist.push(PERMANENT_USER_ID);
    }
    next();
});

module.exports = mongoose.model('antinuke', antinukeSchema);