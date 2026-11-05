import { motion } from "framer-motion";
import { Bot, ArrowRight, Shield, Settings, Music, BarChart3, Wrench, Gift, MessageSquare, Activity, Lightbulb, Gamepad2, Image, Users, Server, Command, LayoutGrid, Ticket, TrendingUp, Star } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import RankCoreLogo from "@/assets/rankcore-logo.png";
import { useDiscordBotStats } from "@/hooks/useDiscordBotStats";
import { useDiscordBotCommands } from "@/hooks/useDiscordBotCommands";
import { INVITE_URL, DASHBOARD_URL, TOPGG_URL } from "@/config/site";
import { useNews, NEWS_TAGS } from "@/hooks/useNews";
import DiscordText from "@/components/DiscordText";

const heroPoints = [
  { icon: Shield, text: "Moderation, automod, anti-raid & anti-scam" },
  { icon: Music, text: "Music with queue, playlists and 24/7 mode" },
  { icon: TrendingUp, text: "Leveling, roles, economy & community features" },
  { icon: Ticket, text: "Tickets, staff apps, logging & giveaways" },
];

const featureGrid = [
  { icon: Shield, title: "Moderation", desc: "Bans, warns, timeouts and full case history" },
  { icon: Shield, title: "Automod", desc: "Anti-spam, anti-link, anti-scam and anti-raid" },
  { icon: Music, title: "Music", desc: "Queue, playlists, autoplay and 24/7 mode" },
  { icon: BarChart3, title: "Leveling", desc: "Text and voice XP with role rewards" },
  { icon: Wrench, title: "Utilities", desc: "Comprehensive toolkit for server management" },
  { icon: Gift, title: "Giveaways", desc: "Run engaging giveaways for your community" },
  { icon: MessageSquare, title: "Tickets", desc: "Efficient support ticket system" },
  { icon: Activity, title: "Economy", desc: "Global coins, bank and casino games" },
  { icon: Lightbulb, title: "Suggestions", desc: "Member feedback and suggestion system" },
  { icon: Gamepad2, title: "Fun", desc: "Entertaining commands and mini-games" },
  { icon: Image, title: "Image Tools", desc: "Creative image manipulation tools" },
  { icon: Settings, title: "Web Dashboard", desc: "Configure everything from your browser" },
];

const steps = [
  { num: "1", title: "Invite the Bot", desc: "Click the \"Add to Discord\" button and select the server you want to add the bot to." },
  { num: "2", title: "Configure Your Settings", desc: "Use the simple web dashboard or chat commands to set up features." },
  { num: "3", title: "Enjoy Your Server", desc: "Sit back and let the bot handle the hard work." },
];

const Index = () => {
  const { data: botStats } = useDiscordBotStats();
  const { data: botCommands } = useDiscordBotCommands();
  const news = useNews();
  const botAvatarUrl = botStats?.bot?.avatar
    ? `https://cdn.discordapp.com/avatars/${botStats.bot.id}/${botStats.bot.avatar}.png?size=256`
    : RankCoreLogo;
  const botTag = botStats?.bot
    ? `${botStats.bot.username}${botStats.bot.discriminator !== "0" ? `#${botStats.bot.discriminator}` : ""}`
    : "Loading bot profile...";

  return (
    <Layout>
      {/* Hero — same composition as the dashboard login page */}
      <section className="relative pt-14 pb-20 md:pt-24 md:pb-28">
        <div className="container mx-auto px-4 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
          {/* Left: pitch */}
          <div>
            <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="section-label mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-noxx-red animate-pulse" />
              RankCore · Discord Bot
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5 }}
              className="font-display font-extrabold text-[44px] sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.04em] text-foreground mb-6"
            >
              Your community.
              <br />
              <span className="text-noxx-red">Handled by RankCore.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="text-base md:text-lg text-muted-foreground max-w-xl mb-8"
            >
              The all-in-one Discord bot — moderation, automod, tickets, music, leveling and dozens more
              features, all configurable from one sleek dashboard.
            </motion.p>

            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="space-y-3 mb-9">
              {heroPoints.map((point) => (
                <li key={point.text} className="flex items-center gap-3 text-sm text-foreground/85">
                  <span className="icon-tile w-8 h-8 text-noxx-red">
                    <point.icon className="w-4 h-4" />
                  </span>
                  {point.text}
                </li>
              ))}
            </motion.ul>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="flex flex-wrap gap-3 mb-10">
              <a
                href={INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-noxx-red text-white font-semibold text-sm hover:brightness-110 transition shadow-lg shadow-noxx-red/25"
              >
                <Bot className="w-4 h-4" />
                Add to Discord
              </a>
              <a
                href={DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-foreground font-semibold text-sm hover:bg-white/[0.06] transition-colors"
              >
                <LayoutGrid className="w-4 h-4" />
                Open Dashboard
              </a>
              <a
                href={TOPGG_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-foreground font-semibold text-sm hover:bg-white/[0.06] transition-colors"
              >
                <Star className="w-4 h-4 text-noxx-yellow" />
                Vote on Top.gg
              </a>
            </motion.div>

            <div className="flex flex-wrap gap-x-10 gap-y-4 pt-6 border-t border-white/[0.055]">
              {[
                { value: botStats ? botStats.servers.toLocaleString() : "…", label: "Servers" },
                { value: botStats ? botStats.totalMembers.toLocaleString() : "…", label: "Members" },
                { value: botCommands ? botCommands.totalFlattened.toLocaleString() : "…", label: "Commands" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-mono text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="mono-label mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: live bot card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[32px] bg-noxx-red/[0.07] blur-3xl pointer-events-none" />
            <div className="relative glass-card rounded-[22px] p-7 md:p-8 bg-gradient-to-b from-noxx-red/[0.05] to-transparent">
              <div className="flex flex-col items-center text-center">
                <span className="icon-tile w-20 h-20 rounded-2xl overflow-hidden bg-noxx-red/10 border-noxx-red/25 mb-4">
                  <img src={botAvatarUrl} alt="RankCore" className="w-full h-full object-cover" />
                </span>
                <h2 className="font-display font-extrabold text-2xl text-foreground">{botStats?.bot?.username ?? "RankCore"}</h2>
                <p className="text-sm text-muted-foreground mt-1">{botTag}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-noxx-green/10 border border-noxx-green/25 font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-noxx-green">
                  <span className="w-1.5 h-1.5 rounded-full bg-noxx-green animate-pulse" />
                  {botStats ? "Online" : "Connecting"}
                </span>
              </div>

              <div className="flex items-center gap-3 my-6">
                <span className="h-px flex-1 bg-white/[0.06]" />
                <span className="mono-label">Live stats</span>
                <span className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Users, label: "Members", value: botStats?.totalMembers, bar: "bg-noxx-red" },
                  { icon: Server, label: "Servers", value: botStats?.servers, bar: "bg-noxx-yellow" },
                  { icon: Command, label: "Commands", value: botCommands?.totalFlattened, bar: "bg-noxx-purple" },
                  { icon: Activity, label: "Shards", value: botStats?.shards, bar: "bg-noxx-green" },
                ].map((stat) => (
                  <div key={stat.label} className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.055] p-4">
                    <stat.icon className="absolute right-3 top-3 w-7 h-7 text-white/[0.06]" />
                    <p className="mono-label">{stat.label}</p>
                    <p className="font-wide font-extrabold text-2xl text-foreground mt-2">
                      {stat.value !== undefined ? stat.value.toLocaleString() : "…"}
                    </p>
                    <span className={`absolute left-0 right-0 bottom-0 h-[2px] ${stat.bar} opacity-60`} />
                  </div>
                ))}
              </div>

              <Link
                to="/commands"
                className="mt-5 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-semibold text-foreground hover:bg-white/[0.06] transition-colors"
              >
                Browse all commands <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <p className="section-label text-center mb-3">Comprehensive Feature Set</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-center text-foreground mb-4">Powerful Features</h2>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-4">
              Everything you need to create an engaging Discord community
            </p>
            <div className="text-center mb-12">
              <Link to="/features" className="text-sm text-noxx-red hover:underline">View All Features →</Link>
            </div>
          </AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {featureGrid.map((feat, i) => (
              <AnimatedSection key={feat.title} delay={i * 0.06} className="h-full">
                <motion.div
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="glass-card-hover p-5 text-center h-full"
                >
                  <span className="icon-tile w-10 h-10 text-noxx-red mx-auto mb-3">
                    <feat.icon className="w-5 h-5" />
                  </span>
                  <h3 className="font-display font-semibold text-sm text-foreground mb-1">{feat.title}</h3>
                  <p className="text-xs text-muted-foreground">{feat.desc}</p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Updates */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <p className="section-label text-center mb-3">What's New</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-center text-foreground mb-4">Latest Updates</h2>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-12">
              Stay up to date with the latest features and improvements
            </p>
          </AnimatedSection>
          <div className="max-w-3xl mx-auto">
            <AnimatedSection direction="left">
              <motion.div whileHover={{ scale: 1.01 }} className="glass-card p-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="font-display font-bold text-foreground text-lg"><DiscordText text={news[0].title} /></h3>
                  {news[0].tag && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-noxx-red/20 text-noxx-red font-semibold shimmer">{NEWS_TAGS[news[0].tag]?.label ?? news[0].tag}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{news[0].date}</p>
                <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line"><DiscordText text={news[0].description} /></p>
                <Link to="/news" className="inline-flex items-center gap-1 text-sm text-noxx-red hover:underline group">
                  View all updates <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Setup Steps */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <p className="section-label text-center mb-3">GET STARTED</p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-center text-foreground mb-4">Up & Running in 3 Easy Steps</h2>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-12">
              Our intuitive setup process means you can enhance your server in minutes, not hours.
            </p>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <AnimatedSection key={step.num} delay={i * 0.15} direction={i === 0 ? "left" : i === 2 ? "right" : "up"}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="glass-card p-6 text-center relative h-full"
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-noxx-red flex items-center justify-center text-sm font-bold text-foreground shadow-lg shadow-noxx-red/30">
                    {step.num}
                  </div>
                  <h3 className="font-display font-semibold text-foreground mt-4 mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </motion.div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <div className="glass-card p-10 text-center max-w-3xl mx-auto relative overflow-hidden">
              {/* Glow accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-noxx-red/5 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-noxx-red/5 rounded-full blur-[60px] pointer-events-none" />

              <div className="relative z-10">
                <p className="text-muted-foreground text-sm mb-2">Ready to elevate your server?</p>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">Bring RankCore to Your Community</h2>
                <p className="text-muted-foreground mb-6">Start using RankCore now and see the difference.</p>
                <motion.a
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  href={INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-noxx-red text-foreground font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-noxx-red/20 btn-glow"
                >
                  Add to Discord
                  <ArrowRight className="w-4 h-4" />
                </motion.a>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
