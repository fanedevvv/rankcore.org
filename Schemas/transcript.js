const { model, Schema } = require('mongoose');

let transcriptSchema = new Schema({
    TicketID: String,
    GuildID: String,
    ChannelName: String,
    OpenedBy: { id: String, username: String, avatar: String },
    ClosedBy: { id: String, username: String, avatar: String },
    ClosedAt: { type: Date, default: Date.now },
    Encrypted: { type: Boolean, default: false },
    EncryptedData: { type: String, default: null },
    Messages: [
        {
            authorId: String,
            authorName: String,
            authorAvatar: String,
            content: String,
            // Store array of attachments with types
            attachments: [{ 
                url: String, 
                name: String, 
                contentType: String 
            }], 
            // Store full embed objects
            embeds: [{
                title: String,
                description: String,
                color: Number,
                fields: [{ name: String, value: String, inline: Boolean }],
                footer: { text: String, iconURL: String },
                image: { url: String },
                thumbnail: { url: String },
                author: { name: String, iconURL: String },
                timestamp: String
            }],
            timestamp: Number,
            isBot: Boolean
        }
    ]
});

module.exports = model('transcript', transcriptSchema);