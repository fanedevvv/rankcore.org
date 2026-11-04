const { Schema, model } = require("mongoose");

const Playlist = new Schema({
    Username: {
        type: String,
        required: false
    },
    UserId: {
        type: String,
        required: true
    },
    PlaylistName: {
        type: String,
        required: true
    },
    /*
true
624022
f34r
58427
186070
1752838856
e5732f870d366f8ef24a9603c455d66d
*/
    Playlist: {
        type: Array,
        required: true
    },
    CreatedOn: {
        type: Number,
        required: true
    }
});

module.exports = model('playlist', Playlist);