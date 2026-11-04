const mongoose = require("mongoose");

const userMemorySchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    facts: [{
        content: { type: String, required: true },
        addedAt: { type: Date, default: Date.now }
    }],
    lastAnalyzed: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model("UserMemory", userMemorySchema);
