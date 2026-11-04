const { model, Schema } = require("mongoose");

module.exports = model("messageTemplate", new Schema({
    id:          { type: String, required: true },
    guildId:     { type: String, required: true, index: true },
    name:        { type: String, required: true, default: "Unnamed" },
    description: { type: String, default: "" },
    tags:        { type: [String], default: [] },
    type:        { type: String, required: true, default: "text", enum: ["text", "embed", "v2"] },
    // Stores the type-specific payload (content / embed / v2Components / buttons / selectMenus)
    data:        { type: Schema.Types.Mixed, default: {} },
}, {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    // Compound unique index: one id per guild
    index: [{ fields: { guildId: 1, id: 1 }, options: { unique: true } }],
}));