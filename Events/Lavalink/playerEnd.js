module.exports = {
    name: 'playerEnd',
    async execute(client, player) {
        const autoplay = player.data.get("autoplay");
        if (!autoplay) return;

        const requester = player.data.get("requester");
        const identifier = player.data.get("identifier");
        if (!identifier) return;

        const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
        const res = await player.search(search, { requester });

        if (!res || !res.tracks || res.tracks.length < 2) {
            console.log("[Autoplay] No related tracks found or insufficient results.");
            return;
        }

        const nextTrack = res.tracks[2] || res.tracks[1] || res.tracks[0];
        if (!nextTrack) {
            console.log("[Autoplay] No suitable next track found.");
            return;
        }

        player.queue.add(nextTrack);
        await player.play();
        console.log(`[Autoplay] Queued next track: ${nextTrack.title}`);
    },
};