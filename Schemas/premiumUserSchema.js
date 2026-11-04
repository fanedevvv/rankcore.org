const mongoose = require("mongoose");

const premiumSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    isPremium: {
        type: Boolean,
        default: false,
    },
    premium: {
        redeemedBy: {
            type: Array,
            default: [],
        },
        redeemedAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        plan: {
            type: String,
            default: null,
        },
        // tier: 'basic' | 'pro' | 'elite'
        tier: {
            type: String,
            enum: ['basic', 'pro', 'elite', null],
            default: null,
        },
        subscriptionId: {
            type: String,
            default: null,
        },
    },
});

module.exports = mongoose.model("PremiumUser", premiumSchema);