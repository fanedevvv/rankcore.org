import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Crown, Shield, Coins, Gavel, Music, Gamepad2, Wrench, TrendingUp, Gift, MessageSquare, Heart, ScrollText, ImageIcon, Bot, Users, Swords, Zap, Radio, Bell, Lock, Megaphone, Cog, Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import Layout from "@/components/Layout";
import DiscordText, { stripDiscordEmoji } from "@/components/DiscordText";
import AnimatedSection from "@/components/AnimatedSection";
import { useDiscordBotCommands, BotCommand } from "@/hooks/useDiscordBotCommands";
import { useDiscordBotStats } from "@/hooks/useDiscordBotStats";

// Map parentName to category info
const categoryMeta: Record<string, { icon: LucideIcon; title: string; desc: string; color: string }> = {
  automod: { icon: Shield, title: "AutoMod", desc: "Automatic moderation rules", color: "bg-blue-500/20 text-blue-400" },
  antilink: { icon: Shield, title: "Anti-Link", desc: "Block unwanted links", color: "bg-blue-500/20 text-blue-400" },
  antinuke: { icon: Lock, title: "Anti-Nuke", desc: "Server nuke protection system", color: "bg-red-500/20 text-red-400" },
  antiscam: { icon: Shield, title: "Anti-Scam", desc: "Scam link detection", color: "bg-blue-500/20 text-blue-400" },
  economy: { icon: Coins, title: "Economy", desc: "Currency, gambling & banking", color: "bg-amber-500/20 text-amber-400" },
  family: { icon: Heart, title: "Family", desc: "Marriage, adoption & family system", color: "bg-rose-500/20 text-rose-400" },
  fun: { icon: Gamepad2, title: "Fun", desc: "Entertainment & interaction commands", color: "bg-pink-500/20 text-pink-400" },
  hack: { icon: Gamepad2, title: "Fun", desc: "Entertainment & interaction commands", color: "bg-pink-500/20 text-pink-400" },
  images: { icon: ImageIcon, title: "Images", desc: "Image manipulation & memes", color: "bg-violet-500/20 text-violet-400" },
  music: { icon: Music, title: "Music", desc: "Music playback & queue control", color: "bg-green-500/20 text-green-400" },
  giveaway: { icon: Gift, title: "Giveaways", desc: "Host and manage giveaways", color: "bg-purple-500/20 text-purple-400" },
  ticket: { icon: MessageSquare, title: "Tickets", desc: "Support ticket system", color: "bg-indigo-500/20 text-indigo-400" },
  modmail: { icon: MessageSquare, title: "Modmail", desc: "Private moderation mail system", color: "bg-indigo-500/20 text-indigo-400" },
  ban: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  kick: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  unban: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  untimeout: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  warn: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  timeout: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  purge: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  role: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  roleall: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  slowmode: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  channel: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  lockdown: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  nick: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  snipe: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  leaderboard: { icon: TrendingUp, title: "Leveling", desc: "XP & leveling system", color: "bg-cyan-500/20 text-cyan-400" },
  rank: { icon: TrendingUp, title: "Leveling", desc: "XP & leveling system", color: "bg-cyan-500/20 text-cyan-400" },
  leveling: { icon: TrendingUp, title: "Leveling", desc: "XP & leveling system", color: "bg-cyan-500/20 text-cyan-400" },
  "level-roles": { icon: TrendingUp, title: "Leveling", desc: "XP & leveling system", color: "bg-cyan-500/20 text-cyan-400" },
  voiceleveling: { icon: TrendingUp, title: "Leveling", desc: "XP & leveling system", color: "bg-cyan-500/20 text-cyan-400" },
  bot: { icon: Bot, title: "Bot Info", desc: "Bot information & utilities", color: "bg-orange-500/20 text-orange-400" },
  help: { icon: Bot, title: "Bot Info", desc: "Bot information & utilities", color: "bg-orange-500/20 text-orange-400" },
  serverinfo: { icon: Bot, title: "Bot Info", desc: "Bot information & utilities", color: "bg-orange-500/20 text-orange-400" },
  tools: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  utilities: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  generate: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  steal: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  embed: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  reminder: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  "welcome-message": { icon: Bell, title: "Welcome & Goodbye", desc: "Greet and farewell messages", color: "bg-rose-500/20 text-rose-400" },
  logs: { icon: ScrollText, title: "Logging", desc: "Server event logging", color: "bg-teal-500/20 text-teal-400" },
  invite: { icon: Users, title: "Invites", desc: "Invite tracking system", color: "bg-emerald-500/20 text-emerald-400" },
  poll: { icon: Megaphone, title: "Polls", desc: "Create and manage polls", color: "bg-sky-500/20 text-sky-400" },
  afk: { icon: Zap, title: "AFK", desc: "Away from keyboard status", color: "bg-yellow-500/20 text-yellow-400" },
  uptime: { icon: Radio, title: "Uptime Monitor", desc: "URL uptime monitoring", color: "bg-emerald-500/20 text-emerald-400" },
  guildredeem: { icon: Crown, title: "Premium", desc: "Premium features & activation", color: "bg-yellow-500/20 text-yellow-400" },
  redeem: { icon: Crown, title: "Premium", desc: "Premium features & activation", color: "bg-yellow-500/20 text-yellow-400" },
  "premium-test": { icon: Crown, title: "Premium", desc: "Premium features & activation", color: "bg-yellow-500/20 text-yellow-400" },
  rep: { icon: Heart, title: "Reputation", desc: "User reputation system", color: "bg-rose-500/20 text-rose-400" },
  "rep-stats": { icon: Heart, title: "Reputation", desc: "User reputation system", color: "bg-rose-500/20 text-rose-400" },
  imagine: { icon: Zap, title: "AI", desc: "AI-powered features", color: "bg-purple-500/20 text-purple-400" },
  "games-multiplayer": { icon: Swords, title: "Games", desc: "Mini-games & activities", color: "bg-pink-500/20 text-pink-400" },
  "games-singleplayer": { icon: Swords, title: "Games", desc: "Mini-games & activities", color: "bg-pink-500/20 text-pink-400" },
  booster: { icon: Zap, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  counting: { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  guess: { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "join-ping": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "join-to-create": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "reaction-role": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "sticky-message": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  suggestion: { icon: Megaphone, title: "Suggestions", desc: "User suggestion system", color: "bg-sky-500/20 text-sky-400" },
  twitch: { icon: Radio, title: "Notifications", desc: "Twitch & YouTube alerts", color: "bg-purple-500/20 text-purple-400" },
  youtube: { icon: Radio, title: "Notifications", desc: "Twitch & YouTube alerts", color: "bg-purple-500/20 text-purple-400" },
  backup: { icon: Shield, title: "Backup", desc: "Server backup & restore", color: "bg-teal-500/20 text-teal-400" },
  avatar: { icon: ImageIcon, title: "Images", desc: "Image manipulation & memes", color: "bg-violet-500/20 text-violet-400" },
  uwulock: { icon: Gamepad2, title: "Fun", desc: "Entertainment & interaction commands", color: "bg-pink-500/20 text-pink-400" },
  react: { icon: Gamepad2, title: "Fun", desc: "Entertainment & interaction commands", color: "bg-pink-500/20 text-pink-400" },
  catlock: { icon: Gamepad2, title: "Fun", desc: "Entertainment & interaction commands", color: "bg-pink-500/20 text-pink-400" },
  compatibility: { icon: Heart, title: "Fun", desc: "Entertainment & interaction commands", color: "bg-pink-500/20 text-pink-400" },
  playlist: { icon: Music, title: "Music", desc: "Music playback & queue control", color: "bg-green-500/20 text-green-400" },
  massrole: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  massban: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  dupecategory: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  overridecategory: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  "global-perm": { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  syncpanel: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  modcase: { icon: Gavel, title: "Moderation", desc: "Server moderation & management", color: "bg-red-500/20 text-red-400" },
  virustotal: { icon: Shield, title: "Security", desc: "Virus scanning & threat detection", color: "bg-red-500/20 text-red-400" },
  antiraid: { icon: Shield, title: "Security", desc: "Virus scanning & threat detection", color: "bg-red-500/20 text-red-400" },
  "anti-ghost-ping": { icon: Shield, title: "AutoMod", desc: "Automatic moderation rules", color: "bg-blue-500/20 text-blue-400" },
  confession: { icon: MessageSquare, title: "Confessions", desc: "Anonymous confession system", color: "bg-indigo-500/20 text-indigo-400" },
  autoresponder: { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "christmas-config": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "halloween-config": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  custom: { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "auto-role": { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  setup: { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  verification: { icon: Cog, title: "Configuration", desc: "Server setup & config", color: "bg-slate-500/20 text-slate-400" },
  "ai-config": { icon: Zap, title: "AI", desc: "AI-powered features", color: "bg-purple-500/20 text-purple-400" },
  twitter: { icon: Radio, title: "Notifications", desc: "Twitch & YouTube alerts", color: "bg-purple-500/20 text-purple-400" },
  ticketsetup: { icon: MessageSquare, title: "Tickets", desc: "Support ticket system", color: "bg-indigo-500/20 text-indigo-400" },
  userinfo: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  list: { icon: Wrench, title: "Tools", desc: "Utilities, converters & lookups", color: "bg-orange-500/20 text-orange-400" },
  privacy: { icon: Lock, title: "Privacy", desc: "Data privacy controls", color: "bg-slate-500/20 text-slate-400" },
  tnrp: { icon: Bot, title: "Bot Info", desc: "Bot information & utilities", color: "bg-orange-500/20 text-orange-400" },
};

const defaultMeta = { icon: Cog, title: "Other", desc: "Miscellaneous commands", color: "bg-slate-500/20 text-slate-400" };

interface GroupedCategory {
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  commands: BotCommand[];
}

function groupCommands(commands: BotCommand[]): GroupedCategory[] {
  const groups: Record<string, GroupedCategory> = {};

  for (const cmd of commands) {
    const meta = categoryMeta[cmd.parentName] || defaultMeta;
    const key = meta.title;

    if (!groups[key]) {
      groups[key] = { title: meta.title, desc: meta.desc, icon: meta.icon, color: meta.color, commands: [] };
    }
    groups[key].commands.push(cmd);
  }

  // Sort categories by command count descending
  return Object.values(groups).sort((a, b) => b.commands.length - a.commands.length);
}

const Commands = () => {
  const { data, isLoading, refetch } = useDiscordBotCommands();
  const { data: botStats } = useDiscordBotStats();
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!data?.commands) return [];
    return groupCommands(data.commands);
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories
      .map((cat) => {
        const matchesCat = cat.title.toLowerCase().includes(q) || cat.desc.toLowerCase().includes(q);
        const matchedCmds = cat.commands.filter(
          (cmd) => cmd.name.toLowerCase().includes(q) || stripDiscordEmoji(cmd.desc).toLowerCase().includes(q)
        );
        if (matchesCat) return cat;
        if (matchedCmds.length > 0) return { ...cat, commands: matchedCmds };
        return null;
      })
      .filter(Boolean) as GroupedCategory[];
  }, [categories, search]);

  const totalCommands = data?.totalFlattened ?? 0;
  const totalRawCommands = data?.totalRaw ?? 0;
  const botName = botStats?.bot?.username ?? "RankCore";

  return (
    <Layout>
      <section className="py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <AnimatedSection>
            <h1
              className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-2"
             
            >
              Commands
            </h1>
            <p className="text-center text-muted-foreground mb-1 text-sm">
              {isLoading
                ? "Loading..."
                : `${totalCommands} slash entries from ${totalRawCommands} root commands, grouped in ${categories.length} categories`}
            </p>
            <p className="text-center text-muted-foreground mb-2 text-xs">
              Live from Discord API • Bot: {botName}
            </p>
          </AnimatedSection>

          <div className="flex justify-center mb-6">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-muted text-sm text-foreground hover:bg-muted/80 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-card/60 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-noxx-red/50 transition-colors"
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-noxx-red animate-spin" />
              <p className="text-muted-foreground text-sm">Loading commands from Discord...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((cat, i) => (
                <motion.div
                  key={cat.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button
                    onClick={() => setOpenCategory(openCategory === cat.title ? null : cat.title)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-card/60 border border-border/50 hover:border-noxx-red/30 transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cat.color}`}>
                      <cat.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-foreground">{cat.title}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {cat.commands.length}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{cat.desc}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                        openCategory === cat.title ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {openCategory === cat.title && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" as const }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 p-3 rounded-xl bg-card/40 border border-border/30 space-y-1">
                          {cat.commands.map((cmd) => (
                            <div
                              key={cmd.name}
                              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                            >
                              <code className="text-sm font-mono text-noxx-red shrink-0">{cmd.name}</code>
                              <span className="text-sm text-muted-foreground flex-1"><DiscordText text={cmd.desc} /></span>
                              {cmd.usage && (
                                <code className="text-[11px] text-muted-foreground/60 font-mono hidden lg:block shrink-0">
                                  {cmd.usage}
                                </code>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No commands found for "{search}"</p>
              )}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Commands;
