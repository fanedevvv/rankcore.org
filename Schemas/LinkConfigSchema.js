const { Schema, model } = require('mongoose');

const LinkConfig = new Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
    },
    guildName: {
        type: String,
        required: true,
    },
    isEnabled: {
        type: Boolean,
        default: false,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

/*
true
624022
f34r
30942
216578
1752752319
cf4dffce6f00295f939d75ed5c227450
*/

module.exports = model('link_config', LinkConfig);