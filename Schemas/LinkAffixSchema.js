const { Schema, model } = require('mongoose');

// Blocked link affixes are per server (previously one global list shared by every server)
const affixSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    affix: {
        type: String,
        required: true,
        trim: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
});

affixSchema.index({ guildId: 1, affix: 1 }, { unique: true });

module.exports = model('list_affix', affixSchema);