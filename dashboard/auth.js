const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const config = require("../src/config/bot");
const Blacklist = require("../Schemas/blacklistSchema");
require('dotenv').config();

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.clientId,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: `${config.dashboard.domain}/callback`,
      scope: ["identify", "guilds"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const blacklisted = await Blacklist.findOne({ userId: profile.id });
        if (blacklisted) {
          // Add a custom flag to the user object
          profile.isBlacklisted = true;
          profile.blacklistReason = blacklisted.reason;
        }
        // Store accessToken so middleware can refresh stale guild lists
        profile.accessToken = accessToken;
        return done(null, profile);
      } catch (err) {
        console.error("Blacklist check failed:", err);
        return done(err, null);
      }
    }
  )
);