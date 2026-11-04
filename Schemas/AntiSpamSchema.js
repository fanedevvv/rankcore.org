const mongoose = require('mongoose');

const AntiSpamSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: Boolean,
        default: false,
    },
    detectBotSpam: {
        type: Boolean,
        default: false, // Default to false; admins must enable it
    },
    punishments: {
        MaxSpamMessageLimit: {
            limit: {
                type: Number,
                default: 5,
            },
            action: {
                type: String,
                enum: ['kick', 'ban', 'warn', 'mute'],
                default: 'warn',
            },
        },
        MaxMentionLimit: {
            limit: {
                type: Number,
                default: 10,
            },
            action: {
                type: String,
                enum: ['kick', 'ban', 'warn', 'mute'],
                default: 'warn',
            },
        },
        MaxLinksLimit: {
            limit: {
                type: Number,
                default: 3,
            },
            action: {
                type: String,
                enum: ['kick', 'ban', 'warn', 'mute'],
                default: 'warn',
            },
        },
        MaxCapsLimit: {
            limit: {
                type: Number,
                default: 70,
            },
            action: {
                type: String,
                enum: ['kick', 'ban', 'warn', 'mute'],
                default: 'warn',
            },
        },
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('AntiSpam', AntiSpamSchema);