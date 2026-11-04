const { Events } = require('discord.js');
const TwitterNotification = require('../../Schemas/twitterSchema');
// Native fetch (Node 18+); node-fetch v3 is ESM-only and can't be require()d on Node 21
const fetch = globalThis.fetch;

// Map to store last tweeted ID per handle to avoid duplicates
const lastTweetMap = new Map();

// Function to get latest tweet from a user using Twitter/X API v2
async function getLatestTweet(handle, bearerToken) {
    const url = `https://api.twitter.com/2/users/by/username/${handle}`;
    const userResponse = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
        },
    });

    if (!userResponse.ok) return null;
    const userData = await userResponse.json();
    const userId = userData.data?.id;
    if (!userId) return null;

    const tweetsResponse = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at`, {
        headers: { 'Authorization': `Bearer ${bearerToken}` },
    });

    if (!tweetsResponse.ok) return null;
    const tweetsData = await tweetsResponse.json();
    return tweetsData.data?.[0] || null;
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const bearerToken = 'AAAAAAAAAAAAAAAAAAAAAGI53wEAAAAAspHYEoJbixEvmA8icTvwyt%2BILzU%3DKlJOgGefMD5jGT5ZFOBSIKkLR6SI5AEDeT8Gcg1gK7Rh2lLfW9'; 
        if (!bearerToken) return console.error('Twitter Bearer Token not set!');

        setInterval(async () => {
            const configs = await TwitterNotification.find();

            for (const config of configs) {
                const handle = config.Handle;
                try {
                    const latestTweet = await getLatestTweet(handle, bearerToken);
                    if (!latestTweet) continue;

                    const lastSentId = lastTweetMap.get(handle) || config.LastTweetId;
                    if (latestTweet.id !== lastSentId) {
                        const channel = await client.channels.fetch(config.Channel);
                        if (channel) {
                            const message = `${config.Message}\n>>> [**New tweet from @${handle}**](https://twitter.com/${handle}/status/${latestTweet.id})`;
                            await channel.send({ content: message });

                            // Update LastTweetId in DB and map
                            config.LastTweetId = latestTweet.id;
                            await config.save();
                            lastTweetMap.set(handle, latestTweet.id);
                        }
                    }
                } catch (err) {
                    console.error(`Error checking tweets for @${handle}:`, err);
                }
            }
        }, 60000); // Check every 60 seconds
    },
};
