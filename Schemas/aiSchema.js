const { model, Schema } = require('mongoose');

const aiConfig = new Schema({
    guildId: { type: String, required: true, unique: true },

    // ── Channel setup ──
    channelId:    { type: String, default: null },
    logChannelId: { type: String, default: null },

    // ── System toggles ──
    systemEnabled: { type: Boolean, default: false },
    imagesEnabled: { type: Boolean, default: true  },
    autoThread:    { type: Boolean, default: false },
    showRegen:     { type: Boolean, default: true  },
    showClear:     { type: Boolean, default: true  },

    // ── AI model config ──
    // Hardcoded to gemini-2.5-flash
    aiModel:     { type: String, default: 'gemini-2.5-flash' },
    maxTokens:   { type: Number, default: 1500 },
    contextSize: { type: Number, default: 20   },
    maxRegens:   { type: Number, default: 3    },

    // ── Persona ──
    botName:              { type: String, default: 'Ruby'    },
    systemPromptOverride: { type: String, default: ''        },
    embedFooter:          { type: String, default: ''        },
    embedColor:           { type: String, default: '#7289DA' },

    // ── Behaviour / modes ──
    modes: {
        swearing: { type: Boolean, default: true  },
        uwu:      { type: Boolean, default: true  },
        roasting: { type: Boolean, default: true  },
        ragebait: { type: Boolean, default: true  },
        mischief: { type: Boolean, default: true  },
        helpMode: { type: Boolean, default: false },
    },

    // ── Content filter ──
    filterEnabled: { type: Boolean,  default: false },
    badWords:      { type: [String], default: []    },

    // ── Spam protection ──
    spamWindow:    { type: Number,  default: 10   },
    spamMax:       { type: Number,  default: 5    },
    autoBlacklist: { type: Boolean, default: true  },

    // ── Limits / cooldowns ──
    cooldownSec:    { type: Number, default: 5  },
    waitThreshold:  { type: Number, default: 5  },

    // ── Custom reply messages ──
    cooldownMsg:    { type: String, default: '<:n_loading:1567796992556666982> Please wait {remaining}s before using AI again.'        },
    blacklistedMsg: { type: String, default: 'You cannot use AI here as you are blacklisted.'            },
    spamMsg:        { type: String, default: '<:restrict:1567797003638022166> You have been automatically blacklisted for spamming.'  },

    // ── Access control ──
    blacklists:   { type: [String], default: [] },
    whitelist:    { type: [String], default: [] },
    requiredRole: { type: String,   default: null },
    modRole:      { type: String,   default: null },

    // ── Log forwarding toggles ──
    logBlocks:        { type: Boolean, default: true },
    logAutoBlacklist: { type: Boolean, default: true },
    logErrors:        { type: Boolean, default: true },

    // ── Stats ──
    stats: {
        messages:    { type: Number, default: 0 },
        blacklisted: { type: Number, default: 0 },
        blocked:     { type: Number, default: 0 },
        regens:      { type: Number, default: 0 },
    },

    // ── Internal flags ──
    clearContextFlag: { type: Boolean, default: false },

}, {
    timestamps: true,
});

module.exports = model('aiConfig', aiConfig);