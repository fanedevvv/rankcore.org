const { model, Schema } = require('mongoose');

let jtcpanel = new Schema({
    Guild: String,
    Channel: String,
    User: String,
    MessageId: String,
    PanelChannel: String, // set when the panel was posted in a separate text channel
});

module.exports = model('jtcpanel', jtcpanel);