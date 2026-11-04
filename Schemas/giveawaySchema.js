const { model, Schema } = require("mongoose");

module.exports = model("giveaway", new Schema({
    giveawayId:      { type: String, required: true, unique: true },
    messageId:       { type: String, required: true },
    channelId:       { type: String, required: true },
    guildId:         { type: String, required: true },
    prize:           { type: String, required: true },
    winners:         { type: Number, required: true, default: 1 },
    endTime:         { type: Date,   required: true },
    host:            { type: String, required: true },
    entrants:        { type: [String], default: [] },
    requiredRole:    { type: String, default: null },
    bonusRole:       { type: String, default: null },
    bonusEntries:    { type: Number, default: 0 },
    hasEnded:        { type: Boolean, default: false },
    winnersChosen:   { type: [String], default: [] },
    // Track when it was actually drawn (may differ from endTime if late draw)
    drawnAt:         { type: Date, default: null },
    // Optional description / extra info shown in embed
    description:     { type: String, default: null },
    // Whether it was created via dashboard (for display)
    createdVia:      { type: String, default: "slash", enum: ["slash", "dashboard"] },
    // Whether the giveaway message was sent by the CB bot (affects who can edit it)
    viaCB:           { type: Boolean, default: false },
}, { timestamps: true }));
