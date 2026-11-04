const mongoose = require('mongoose');

const TwitterNotificationSchema = new mongoose.Schema({
    Guild: {
        type: String,
        required: true,
        unique: true, // Only one notification per guild
    },
    Channel: {
        type: String,
        required: true, // Discord channel ID where notifications will be sent
    },
    Handle: {
        type: String,
        required: true, // Twitter/X handle (without @)
    },
    Message: {
        type: String,
        default: 'New tweet posted!', // Custom message template
    },
    LastTweetId: {
        type: String,
        default: null, // Stores the ID of the last tweet sent to avoid duplicates
    },
}, { timestamps: true });

module.exports = mongoose.model('TwitterNotification', TwitterNotificationSchema);
