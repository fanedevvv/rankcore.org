const mongoose = require('mongoose');


const logSchema = new mongoose.Schema({
level: { type: String, required: true },
process: { type: String, default: 'BOT' },
content: String,
embeds: Array,
createdAt: { type: Date, default: Date.now, index: { expires: 86400 } } // 86400s = 1 day
});


// This automatically deletes logs 1 day after creation
const Log = mongoose.model('BotLogs', logSchema);


module.exports = Log;