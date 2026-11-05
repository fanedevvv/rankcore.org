import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Shield, Zap, Terminal, Music, Bot, TrendingUp, LayoutDashboard, Code, Settings, HelpCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { INVITE_URL, DASHBOARD_URL } from "@/config/site";

const sidebarItems = [
  { icon: Bot, label: "Getting Started", id: "getting-started" },
  { icon: Terminal, label: "Commands", id: "commands" },
  { icon: Shield, label: "Moderation", id: "moderation" },
  { icon: Music, label: "Music System", id: "music" },
  { icon: Zap, label: "Auto-Moderation", id: "automod" },
  { icon: TrendingUp, label: "Leveling System", id: "leveling" },
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Code, label: "API Integration", id: "api" },
  { icon: Settings, label: "Customization", id: "customization" },
  { icon: HelpCircle, label: "FAQ", id: "faq" },
];

const Docs = () => {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 border-r border-border/50 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto p-4">
          <div className="flex items-center gap-2 font-display font-bold text-lg text-noxx-red mb-4">
            <Bot className="w-5 h-5" /> RankCore Docs
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-noxx-red/50"
            />
          </div>
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeSection === item.id
                    ? "bg-noxx-red/10 text-noxx-red border border-noxx-red/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-4xl mx-auto px-4 md:px-6 py-10">
          {/* Mobile section picker (the sidebar is desktop-only) */}
          <nav className="md:hidden -mx-4 px-4 mb-6 flex gap-2 overflow-x-auto pb-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeSection === item.id
                    ? "bg-noxx-red/10 text-noxx-red border-noxx-red/30"
                    : "text-muted-foreground border-border/50 bg-muted/30"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </nav>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground mb-3">Welcome to RankCore Documentation</h1>
          <p className="text-muted-foreground mb-8">Your comprehensive guide to using the RankCore Discord bot. Jump to any section to explore features, commands, and more.</p>
          <hr className="border-border/50 mb-10" />

          {/* Getting Started */}
          <section id="getting-started" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Getting Started</h2>
            <p className="text-muted-foreground mb-6">RankCore is your all-in-one Discord bot designed to supercharge your server with powerful moderation, engaging fun commands, and essential utility features.</p>

            <div className="glass-card p-6 mb-6">
              <h3 className="text-xl font-display font-semibold text-noxx-red mb-4">How to Invite RankCore</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground text-sm">
                <li>Click <a href={INVITE_URL} target="_blank" rel="noopener noreferrer" className="text-noxx-red hover:underline">Add to Discord</a> on this website.</li>
                <li>Select the server you wish to add the bot to (you need the "Manage Server" permission).</li>
                <li>Authorize the bot's permissions. We recommend keeping defaults for full functionality.</li>
                <li>Open the <a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="text-noxx-red hover:underline">dashboard</a>, log in with Discord and pick your server.</li>
                <li>All commands work right away — type <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">/</code> in your server. You can turn off the ones you don't need in <strong>Settings → Command Manager</strong>.</li>
              </ol>
            </div>

            <div className="glass-card p-6 mb-6">
              <h3 className="text-xl font-display font-semibold text-noxx-red mb-4">Quick Setup Tips</h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground text-sm">
                <li>Configure a mod log channel for tracking moderation actions</li>
                <li>Set up welcome messages to greet new members</li>
                <li>Enable auto-moderation features for enhanced security</li>
                <li>Turn off commands your server doesn't need from the Command Manager</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-noxx-red" />
                  <h4 className="font-display font-semibold text-foreground">Security First</h4>
                </div>
                <p className="text-sm text-muted-foreground">Built-in protection against spam, raids, and malicious content to keep your community safe.</p>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-noxx-yellow" />
                  <h4 className="font-display font-semibold text-foreground">Lightning Fast</h4>
                </div>
                <p className="text-sm text-muted-foreground">Optimized performance ensures commands execute instantly, even during peak usage.</p>
              </div>
            </div>
          </section>

          {/* Commands */}
          <section id="commands" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Commands Overview</h2>
            <p className="text-muted-foreground mb-6">RankCore uses slash commands for a seamless user experience.</p>

            {[
              { title: "Moderation", cmds: ["/ban - Ban a user", "/kick - Kick a member", "/timeout add - Time out a member", "/warn add - Warn a user", "/purge all - Bulk delete messages", "/slowmode set - Set channel slowmode"] },
              { title: "Fun & Entertainment", cmds: ["/play - Play a song", "/fun 8ball - Ask the magic 8-ball", "/images meme - Get a random meme", "/images cat - Get a random cat picture", "/games-singleplayer - Play a mini-game", "/fun dice-roll - Roll a dice"] },
              { title: "Utility", cmds: ["/userinfo - View member details", "/serverinfo - Server information", "/ping - Check bot latency", "/help - Browse all commands", "/utilities avatar - Get a user's avatar", "/poll create - Create a poll"] },
              { title: "Economy", cmds: ["/economy balance - Check your wallet and bank", "/economy daily - Claim daily coins", "/economy work - Work for coins", "/economy bank deposit - Store coins in the bank", "/economy blackjack - Play blackjack", "/economy give - Send coins to a member"] },
              { title: "Leveling", cmds: ["/rank - View your rank card", "/leaderboard - Server XP leaderboard", "/level-roles set - Configure level roles", "/voiceleveling enable - Turn on voice XP"] },
              { title: "Configuration", cmds: ["/logs - Configure logging", "/welcome-message welcome - Set up welcome messages", "/auto-role add - Auto-assign roles", "/automod flagged-words - Enable a word filter", "/cmd create - Create a custom command"] },
            ].map((cat) => (
              <div key={cat.title} className="mb-6">
                <h3 className="font-display font-semibold text-foreground text-lg mb-3">{cat.title}</h3>
                <div className="glass-card p-4">
                  <ul className="space-y-1.5">
                    {cat.cmds.map((cmd) => (
                      <li key={cmd} className="text-sm text-muted-foreground font-mono">• {cmd}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </section>

          {/* Moderation */}
          <section id="moderation" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Advanced Moderation</h2>
            <p className="text-muted-foreground mb-6">RankCore provides a comprehensive moderation system. All actions are logged and reviewable through the dashboard.</p>

            {[
              { cmd: "/ban <user> [reason] [delete_days]", desc: "Permanently ban a user. Every action creates a mod case.", example: "/ban @user Spamming" },
              { cmd: "/kick <user> [reason]", desc: "Remove a member from the server. Kicked users can rejoin.", example: "/kick @user Violating rules" },
              { cmd: "/timeout add <user> <duration> [reason]", desc: "Stop a member from talking for a set time.", example: "/timeout add @user 1h Excessive caps" },
              { cmd: "/warn add <user> <reason>", desc: "Issue a formal warning. Warnings are tracked per member.", example: "/warn add @user Inappropriate language" },
              { cmd: "/purge user <count> <user>", desc: "Bulk delete messages from one member.", example: "/purge user 50 @user" },
            ].map((item) => (
              <div key={item.cmd} className="glass-card p-5 mb-4">
                <h4 className="font-mono font-semibold text-foreground mb-1">{item.cmd}</h4>
                <p className="text-sm text-muted-foreground mb-2">{item.desc}</p>
                <code className="text-xs px-2 py-1 rounded bg-muted text-foreground">Example: {item.example}</code>
              </div>
            ))}

            <div className="glass-card p-5 mt-6">
              <h3 className="font-display font-semibold text-foreground mb-3">Moderation Logs</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Member joins and leaves</li>
                <li>Bans, kicks, and timeouts</li>
                <li>Message deletions and edits</li>
                <li>Role changes and permission updates</li>
                <li>Channel modifications</li>
                <li>Warning issuance and expiry</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                Use <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">/logs</code> or the dashboard to configure.
              </p>
            </div>
          </section>

          {/* Music */}
          <section id="music" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Music System</h2>
            <p className="text-muted-foreground mb-6">Enjoy high-quality music playback from YouTube, SoundCloud and more.</p>
            <div className="glass-card p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { cmd: "/play <song>", desc: "Play a song and open the control panel" },
                  { cmd: "/music pause", desc: "Pause current playback" },
                  { cmd: "/music resume", desc: "Resume paused music" },
                  { cmd: "/music skip", desc: "Skip to next song" },
                  { cmd: "/music queue", desc: "View current queue" },
                  { cmd: "/music volume <volume>", desc: "Adjust playback volume" },
                  { cmd: "/music loop <mode>", desc: "Loop the track or the queue" },
                  { cmd: "/music shuffle", desc: "Shuffle the queue" },
                  { cmd: "/music nowplaying", desc: "Display current song info" },
                  { cmd: "/music stop", desc: "Stop playback and clear queue" },
                ].map((item) => (
                  <div key={item.cmd} className="flex flex-col">
                    <span className="font-mono text-sm text-foreground">{item.cmd}</span>
                    <span className="text-xs text-muted-foreground">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-5 mt-4">
              <h3 className="font-display font-semibold text-foreground mb-3">Advanced Music Features</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>24/7 music playback (bot stays in voice channel)</li>
                <li>Save and load personal playlists (<code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">/playlist</code>)</li>
                <li>Autoplay related tracks when the queue ends</li>
                <li>Seek forward and backward in the current song</li>
              </ul>
            </div>
          </section>

          {/* Auto-Moderation */}
          <section id="automod" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Auto-Moderation</h2>
            <p className="text-muted-foreground mb-6">Protect your server automatically with intelligent auto-moderation.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "Spam Protection", items: ["Message spam detection", "Mention spam (mass pings)", "Advanced automod: caps and emoji floods", "Discord AutoMod rules in one command", "Configurable from the dashboard"] },
                { title: "Content Filtering", items: ["Profanity and slur filter", "Custom keyword filter", "Link filtering with allowed domains", "Anti-scam phishing link detection", "Anti-racism filter"] },
                { title: "Raid Protection", items: ["Anti-raid join detection", "Server lockdown mode", "Verification gate for new members", "Anti-ghost-ping alerts", "Anti-Nuke (Premium)"] },
                { title: "Punishments", items: ["Warnings with severity levels", "Timeouts, kicks and bans", "Full mod case history per member", "Staff logs of every action", "Delete, warn or time out automatically"] },
              ].map((section) => (
                <div key={section.title} className="glass-card p-5">
                  <h3 className="font-display font-semibold text-foreground mb-3">{section.title}</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Use <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">/automod</code> commands or <strong>Moderation → Auto Moderation</strong> in the dashboard.
            </p>
          </section>

          {/* Leveling */}
          <section id="leveling" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Leveling System</h2>
            <p className="text-muted-foreground mb-6">Encourage engagement with an XP-based leveling system.</p>
            <div className="glass-card p-5 mb-4">
              <h3 className="font-display font-semibold text-foreground mb-3">How Leveling Works</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Sending messages — a random amount of XP per message, with a cooldown</li>
                <li>Time spent in voice channels (enable with <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">/voiceleveling enable</code>)</li>
                <li>XP range, cooldown, multipliers and restricted channels are set in the dashboard</li>
              </ul>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-foreground mb-3">Level Roles <span className="text-xs text-muted-foreground font-normal">(example)</span></h3>
              <div className="space-y-2">
                {[
                  { level: 5, role: "Active Member" },
                  { level: 10, role: "Regular" },
                  { level: 25, role: "Veteran" },
                  { level: 50, role: "Legend" },
                ].map((lr) => (
                  <div key={lr.level} className="flex items-center gap-3 text-sm">
                    <span className="text-noxx-red font-semibold">Level {lr.level}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground">{lr.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Dashboard */}
          <section id="dashboard" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Web Dashboard</h2>
            <p className="text-muted-foreground mb-6">Complete control over RankCore's settings for your server.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: "Command Management", desc: "Enable or disable specific commands." },
                { title: "Customization", desc: "Set welcome messages, log channels, and more." },
                { title: "Server Overview", desc: "Members, boosts, security level and your plan limits." },
                { title: "Role Management", desc: "Configure roles for auto-assignment or punishment." },
                { title: "Module Control", desc: "Toggle entire feature sets on or off." },
                { title: "Mobile Friendly", desc: "Every page works on your phone." },
              ].map((item) => (
                <div key={item.title} className="glass-card p-5">
                  <h4 className="font-display font-semibold text-foreground mb-1">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* API */}
          <section id="api" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">API Integration</h2>
            <p className="text-muted-foreground mb-6">RankCore exposes a small public, read-only JSON API — the same data this website uses. No key needed.</p>
            <div className="glass-card p-5 mb-4">
              <p className="text-sm text-muted-foreground mb-2">Base URL:</p>
              <code className="px-3 py-1.5 rounded bg-muted text-foreground text-sm font-mono break-all">https://rankcore.org/api/site/</code>
            </div>
            <div className="space-y-4">
              <div className="glass-card p-5">
                <h4 className="font-mono text-sm text-noxx-green mb-2">GET /stats</h4>
                <p className="text-sm text-muted-foreground mb-2">Bot profile, server and member counts, and the servers RankCore is in</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto text-foreground">{`{
  "bot": { "username": "RankCore", "id": "1567778843593412648", ... },
  "servers": 90,
  "totalMembers": 186176,
  "guilds": [{ "id": "...", "name": "...", "memberCount": 1500 }],
  "shards": 1
}`}</pre>
              </div>
              <div className="glass-card p-5">
                <h4 className="font-mono text-sm text-noxx-green mb-2">GET /commands</h4>
                <p className="text-sm text-muted-foreground mb-2">Every command and subcommand with its description and usage</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto text-foreground">{`{
  "commands": [{ "name": "/ban", "desc": "...", "usage": "/ban <user> [reason] ...", "parentName": "ban" }],
  "totalRaw": 109,
  "totalFlattened": 413
}`}</pre>
              </div>
              <div className="glass-card p-5">
                <h4 className="font-mono text-sm text-noxx-green mb-2">GET /uptime</h4>
                <p className="text-sm text-muted-foreground mb-2">Live service status and 90 days of daily uptime history</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto text-foreground">{`{
  "services": [{ "name": "Bot", "status": "operational", "ping": 42 }],
  "days": [{ "date": "2026-09-30", "state": "ok", "uptime": 100 }],
  "overallUptime": 100
}`}</pre>
              </div>
            </div>
            <div className="glass-card p-5 mt-4">
              <h3 className="font-display font-semibold text-foreground mb-3">Rate Limits</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>30 requests per 10 seconds per IP</li>
                <li>Responses are cached for 60 seconds — polling faster gains nothing</li>
              </ul>
            </div>
          </section>

          {/* Customization */}
          <section id="customization" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Customization Options</h2>
            <div className="space-y-4">
              <div className="glass-card p-5">
                <h3 className="font-display font-semibold text-foreground mb-3">Welcome Messages</h3>
                <p className="text-sm text-muted-foreground mb-3">Greet new members with customizable welcome messages. Supports embeds, images, and variables.</p>
                <div className="grid grid-cols-2 gap-2">
                  {["{user} - Member mention", "{username} - Member name", "{server} - Server name", "{members} - Total members"].map((v) => (
                    <code key={v} className="text-xs px-2 py-1 rounded bg-muted text-foreground">{v}</code>
                  ))}
                </div>
              </div>
              <div className="glass-card p-5">
                <h3 className="font-display font-semibold text-foreground mb-3">Auto-Roles</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Join roles for verification</li>
                  <li>Bot role separation</li>
                  <li>Level-based role rewards</li>
                  <li>Reaction role systems</li>
                </ul>
              </div>
              <div className="glass-card p-5">
                <h3 className="font-display font-semibold text-foreground mb-3">Logging Channels</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>Moderation: Bans, kicks, timeouts</span>
                  <span>Messages: Edits, deletions</span>
                  <span>Members: Joins, leaves</span>
                  <span>Voice: Join/leave VC</span>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="mb-16 scroll-mt-16">
            <h2 className="text-3xl font-display font-bold text-foreground mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {[
                { q: "How do I invite RankCore to my server?", a: "Visit our official website and click the \"Add to Discord\" button. Then select the server you'd like to add it to. Make sure you have the \"Manage Server\" permission." },
                { q: "Is there a support server?", a: "Yes! Join our Discord support server. You'll find the link on our website. Our team and community members are always ready to help." },
                { q: "Why are my slash commands not showing up?", a: "All of RankCore's commands are available as soon as the bot joins. If you just added RankCore, give Discord a minute and restart your Discord app. A server manager may also have turned some commands off in the dashboard → Settings → Command Manager." },
                { q: "Can I use RankCore for free?", a: "Yes! All core features are free. A few extras (like Anti-Nuke and the AI chatbot) are part of Premium — see the Premium page for plans." },
                { q: "How do I report a bug or request a feature?", a: "Use /bot report-bug or /bot suggest right from Discord, or tell us on the support server." },
                { q: "Does RankCore work with other bots?", a: "Yes! RankCore is designed to work alongside other bots. You can disable specific RankCore commands if needed through the dashboard." },
                { q: "Is my data safe with RankCore?", a: "We take privacy seriously. RankCore only stores necessary data for functionality. We never sell your data." },
              ].map((item) => (
                <div key={item.q} className="glass-card p-5">
                  <h4 className="font-display font-semibold text-foreground mb-2">Q: {item.q}</h4>
                  <p className="text-sm text-muted-foreground">A: {item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Docs;
