import { motion } from "framer-motion";
import { Bot, Users, Server, Layers, RefreshCw, Command } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import { useDiscordBotStats } from "@/hooks/useDiscordBotStats";
import { useDiscordBotCommands } from "@/hooks/useDiscordBotCommands";

const formatResetAfter = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

const Stats = () => {
  const { data: botStats, isLoading, refetch, dataUpdatedAt } = useDiscordBotStats();
  const { data: botCommands } = useDiscordBotCommands();

  const botAvatarUrl = botStats?.bot?.avatar
    ? `https://cdn.discordapp.com/avatars/${botStats.bot.id}/${botStats.bot.avatar}.png?size=256`
    : null;

  const statCards = [
    { icon: Users, value: botStats?.totalMembers?.toLocaleString() ?? "...", label: "Total Members" },
    { icon: Server, value: botStats?.servers?.toLocaleString() ?? "...", label: "Servers" },
    { icon: Layers, value: botStats?.shards?.toLocaleString() ?? "...", label: "Shards" },
    { icon: Command, value: botCommands?.totalFlattened?.toLocaleString() ?? "...", label: "Slash Commands" },
  ];

  const guildsSorted = [...(botStats?.guilds ?? [])].sort((a, b) => b.memberCount - a.memberCount);
  const sessionLimit = botStats?.sessionStartLimit;

  return (
    <Layout>
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-noxx-red/30 bg-noxx-red/10 text-sm text-noxx-red font-medium">
              <span className="w-2 h-2 rounded-full bg-noxx-red animate-pulse" />
              LIVE
            </span>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-muted text-sm text-foreground hover:bg-muted/80 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <AnimatedSection>
            <h1
              className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-2"
             
            >
              Bot Information
            </h1>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-2">
              Real bot profile and operational metrics from Discord API.
            </p>
            <p className="text-center text-xs text-muted-foreground mb-8">
              Last sync: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleString() : "Waiting for first sync..."}
            </p>
          </AnimatedSection>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-8 glass-card p-6"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
              <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {botAvatarUrl ? (
                  <img src={botAvatarUrl} alt={botStats?.bot?.username ?? "Bot avatar"} className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-8 h-8 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Discord Bot</p>
                <h2 className="text-xl font-bold text-foreground">
                  {botStats?.bot?.username ?? "Loading..."}
                  {botStats?.bot?.discriminator && botStats.bot.discriminator !== "0" ? `#${botStats.bot.discriminator}` : ""}
                </h2>
                <p className="text-sm text-muted-foreground font-mono">ID: {botStats?.bot?.id ?? "..."}</p>
              </div>
            </div>
          </motion.div>

          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-5"
              >
                <div className="w-10 h-10 rounded-xl bg-noxx-red/10 flex items-center justify-center mb-3">
                  <stat.icon className="w-5 h-5 text-noxx-red" />
                </div>
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="max-w-4xl mx-auto mb-10">
            <h2 className="text-xl font-bold text-foreground mb-4">Gateway Session Limit</h2>
            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <tbody>
                  {[
                    { label: "Total", value: sessionLimit?.total ?? "..." },
                    { label: "Remaining", value: sessionLimit?.remaining ?? "..." },
                    { label: "Max Concurrency", value: sessionLimit?.maxConcurrency ?? "..." },
                    { label: "Reset After", value: sessionLimit ? formatResetAfter(sessionLimit.resetAfter) : "..." },
                  ].map((item, i, arr) => (
                    <tr key={item.label} className={i < arr.length - 1 ? "border-b border-border/30" : ""}>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{item.label}</td>
                      <td className="px-5 py-3 text-sm text-foreground text-right font-mono">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {guildsSorted.length > 0 && (
            <div className="max-w-4xl mx-auto mb-10">
              <h2 className="text-xl font-bold text-foreground mb-4">Connected Servers ({guildsSorted.length})</h2>
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Server</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Members</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guildsSorted.map((guild, i) => (
                      <tr key={guild.id} className={i < guildsSorted.length - 1 ? "border-b border-border/30" : ""}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {guild.icon ? (
                              <img
                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}?size=32`}
                                alt={guild.name}
                                className="w-7 h-7 rounded-full"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {guild.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-foreground">{guild.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{guild.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-foreground">{guild.memberCount.toLocaleString()}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{guild.owner ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
            >
              ← Return Home
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Stats;
