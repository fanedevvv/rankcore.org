import { motion } from "framer-motion";
import { Shield, ShieldAlert, Music, Coins, Wrench, Gift, MessageSquare, Lightbulb, Gamepad2, Sparkles, CheckCircle2, ArrowRight, TrendingUp, UserPlus, Bell } from "lucide-react";
import { INVITE_URL } from "@/config/site";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";

// Every item below maps to real RankCore commands / dashboard pages.
const features = [
  {
    icon: Shield, title: "Moderation", desc: "Full moderation toolkit with case tracking",
    longDesc: "Keep your server safe with ban, kick, timeout and warn commands, a complete infraction history for every member and detailed mod logs. Lock channels, purge messages by type and snipe deleted or edited messages.",
    keyFeatures: ["Ban, kick, timeout and warn", "Mod cases with notes, lookup and stats", "Purge by user, bot, links, images or mentions", "Channel lock, hide and nuke", "Server lockdown mode", "Snipe deleted, edited and reaction messages"],
  },
  {
    icon: ShieldAlert, title: "Automod & Security", desc: "Stop spam, scams and raids automatically",
    longDesc: "Discord AutoMod rules set up in one click, plus RankCore's own protection layers: anti-link, anti-scam, anti-raid and anti-ghost-ping. Premium servers also get Anti-Nuke with per-event thresholds and a trusted whitelist.",
    keyFeatures: ["Flagged words, spam and mention spam rules", "Anti-link with allowed domains", "Anti-scam phishing link detection", "Anti-raid and verification gate", "Anti-ghost-ping alerts", "Anti-Nuke (Premium)"],
  },
  {
    icon: MessageSquare, title: "Tickets", desc: "Support tickets with panels and transcripts",
    longDesc: "Professional support for your members: ticket panels built in the dashboard, staff claiming, locking, reminders and close requests, with transcripts saved when a ticket closes.",
    keyFeatures: ["Custom ticket panels", "Claim, lock and add members", "Close requests and reminders", "Ticket transcripts", "Staff ratings after support", "Configured from the dashboard"],
  },
  {
    icon: Music, title: "Music", desc: "High-quality playback with saved playlists",
    longDesc: "Play music in voice channels with a full queue, loop, shuffle, seek and autoplay. Save your favourite tracks into personal playlists and keep RankCore in the channel 24/7.",
    keyFeatures: ["Play from YouTube, SoundCloud and more", "Queue, shuffle, loop and replay", "Forward, backward and volume control", "Autoplay related tracks", "Personal playlists", "24/7 mode"],
  },
  {
    icon: TrendingUp, title: "Leveling", desc: "XP, ranks and role rewards",
    longDesc: "Reward active members with XP for chatting and time spent in voice. Hand out roles automatically at chosen levels and show off the leaderboard.",
    keyFeatures: ["Text XP and rank cards", "Voice leveling", "Level role rewards", "Server leaderboard", "Custom level-up messages", "Channel and role restrictions"],
  },
  {
    icon: UserPlus, title: "Welcome & Roles", desc: "Greet members and assign roles",
    longDesc: "Welcome and goodbye messages with image cards, auto roles for new members, reaction roles, booster thank-you messages, join pings and invite tracking.",
    keyFeatures: ["Welcome and goodbye image cards", "Auto roles on join", "Reaction roles", "Booster messages", "Invite tracking and leaderboard", "Join-to-create voice channels"],
  },
  {
    icon: Gift, title: "Giveaways", desc: "Run giveaways from Discord or the dashboard",
    longDesc: "Start, edit, end and reroll giveaways with any number of winners — from a slash command or from the dashboard.",
    keyFeatures: ["Custom duration and winners", "Edit running giveaways", "Reroll winners", "List active giveaways", "Manage from the dashboard", "Automatic winner selection"],
  },
  {
    icon: Lightbulb, title: "Community", desc: "Suggestions, confessions, polls and QOTD",
    longDesc: "Give your members a voice: a suggestion system with staff review, anonymous confessions with moderation, polls, a daily Question of the Day, reputation and sticky messages.",
    keyFeatures: ["Suggestions with approve / reject / implement", "Anonymous confessions with review", "Polls", "Question of the Day", "Reputation system", "Sticky messages"],
  },
  {
    icon: Coins, title: "Economy", desc: "A global economy with games",
    longDesc: "One account that follows members across every server with RankCore. Work, fish, beg and claim daily rewards, keep coins safe in the bank, and gamble them in blackjack, slots, roulette and heists.",
    keyFeatures: ["Daily rewards, work and fishing", "Bank deposits and withdrawals", "Blackjack, slots and roulette", "Heists and robbing", "Give coins to friends", "Global balance across servers"],
  },
  {
    icon: Gamepad2, title: "Fun & Games", desc: "Games, reactions and image commands",
    longDesc: "Keep chat lively with single and multiplayer games, truth or dare, would you rather, a family system (marry, adopt and more), reaction GIFs and image commands.",
    keyFeatures: ["Single and multiplayer games", "Truth or dare and would you rather", "Family system: marry, adopt, relationships", "Hug, pat, slap and reaction GIFs", "Image effects: wasted, triggered, pixelate", "Counting and guess the number"],
  },
  {
    icon: Bell, title: "Notifications", desc: "YouTube, Twitch and uptime alerts",
    longDesc: "Announce new YouTube uploads and Twitch streams automatically, and let RankCore watch your websites and alert you when they go down.",
    keyFeatures: ["YouTube upload alerts", "Twitch live alerts", "Website uptime monitoring", "Custom alert messages", "Role pings", "Configured from the dashboard"],
  },
  {
    icon: Wrench, title: "Customization & Tools", desc: "Custom commands, embeds and utilities",
    longDesc: "Build your own commands and autoresponders, design embeds and message templates in the dashboard, and use everyday tools like translate, weather, reminders and a calculator.",
    keyFeatures: ["Custom commands", "Autoresponders", "Embed builder and message templates", "Staff applications and staff list", "Translate, weather, calculator, TTS", "Reminders"],
  },
];

const Features = () => {
  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-noxx-red/30 bg-noxx-red/5 text-sm text-noxx-red">
              <Sparkles className="w-4 h-4" /> Everything You Need
            </span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4">
            All Features
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-16">
            Discover every feature RankCore has to offer. From powerful moderation to engaging entertainment, we've built everything you need to create the perfect Discord community.
          </p>

          <div className="max-w-4xl mx-auto space-y-8">
            {features.map((feat, i) => (
              <AnimatedSection key={feat.title} delay={i * 0.05}>
              <motion.div
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="glass-card p-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-noxx-red/20 flex items-center justify-center">
                        <feat.icon className="w-6 h-6 text-noxx-red" />
                      </div>
                      <div>
                        <h2 className="font-display font-bold text-foreground text-xl">{feat.title}</h2>
                        <p className="text-sm text-muted-foreground">{feat.desc}</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">{feat.longDesc}</p>
                    <Link to="/commands" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-noxx-red/10 border border-noxx-red/30 text-sm text-noxx-red font-medium hover:bg-noxx-red/20 transition-colors">
                      View Commands <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">Key Features</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {feat.keyFeatures.map((kf) => (
                        <div key={kf} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-noxx-red shrink-0 mt-0.5" />
                          {kf}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
              </AnimatedSection>
            ))}
          </div>

          {/* CTA */}
          <AnimatedSection>
            <div className="text-center mt-16">
              <h2 className="text-2xl font-display font-bold text-foreground mb-4">Ready to get started?</h2>
              <p className="text-muted-foreground mb-6">Add RankCore to your server today and unlock these features for free.</p>
              <a
                href={INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-noxx-red text-foreground font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-noxx-red/20"
              >
                Add to Discord <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </Layout>
  );
};

export default Features;
