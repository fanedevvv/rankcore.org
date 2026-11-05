import { motion } from "framer-motion";
import { RefreshCw, Server, Wifi, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import { useDiscordBotStats } from "@/hooks/useDiscordBotStats";

const formatResetAfter = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
};

const Status = () => {
  const { data: botStats, isLoading, error, refetch } = useDiscordBotStats();

  const shardCount = botStats?.shards ?? 1;
  const totalMembers = botStats?.totalMembers ?? 0;
  const totalServers = botStats?.servers ?? 0;
  const sessionLimit = botStats?.sessionStartLimit;

  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-noxx-green/30 bg-noxx-green/5 text-sm text-noxx-green">
              <span className="w-2 h-2 rounded-full bg-noxx-green animate-pulse" />
              {error ? "Unable to sync live data" : isLoading ? "Syncing live data..." : "Live data synced"}
            </span>
          </motion.div>

          <AnimatedSection>
            <h1
              className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4"
             
            >
              Bot Status
            </h1>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-8">
              Real-time operational data pulled from Discord API.
            </p>
          </AnimatedSection>

          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
            <span className="flex items-center gap-2">
              <Server className="w-4 h-4" /> {isLoading ? "..." : totalServers.toLocaleString()} Servers
            </span>
            <span>•</span>
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" /> {isLoading ? "..." : totalMembers.toLocaleString()} Members
            </span>
            <span>•</span>
            <span className="flex items-center gap-2">
              <Wifi className="w-4 h-4" /> {isLoading ? "..." : shardCount} Shards
            </span>
          </div>

          <div className="max-w-3xl mx-auto mb-6 glass-card p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Gateway reset after: {sessionLimit ? formatResetAfter(sessionLimit.resetAfter) : "..."}
              </div>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted border border-border text-sm text-foreground font-medium hover:bg-muted/80 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="glass-card overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Gateway Session Limit</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="px-6 py-3 text-sm text-foreground">Total</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{sessionLimit?.total ?? "..."}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="px-6 py-3 text-sm text-foreground">Remaining</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{sessionLimit?.remaining ?? "..."}</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="px-6 py-3 text-sm text-foreground">Max Concurrency</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{sessionLimit?.maxConcurrency ?? "..."}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 text-sm text-foreground">Reset After</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">
                      {sessionLimit ? formatResetAfter(sessionLimit.resetAfter) : "..."}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="glass-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Shard Group</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-muted-foreground">Total Shards</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-6 py-4 text-sm text-foreground">#0 - #{Math.max(0, shardCount - 1)}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-sm text-noxx-green">
                        <span className="w-2 h-2 rounded-full bg-noxx-green" />
                        {error ? "Unknown" : "Connected"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{isLoading ? "..." : shardCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {botStats?.guilds && botStats.guilds.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Servers Connected ({botStats.guilds.length})</h3>
                <div className="glass-card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">Server</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">Members</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {botStats.guilds.map((guild, i) => (
                        <tr key={guild.id} className={i < botStats.guilds.length - 1 ? "border-b border-border/30" : ""}>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {guild.icon ? (
                                <img
                                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}?size=32`}
                                  alt={guild.name}
                                  className="w-6 h-6 rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                  {guild.name.charAt(0)}
                                </div>
                              )}
                              <span className="text-sm text-foreground truncate max-w-[200px]">{guild.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-muted-foreground">{guild.memberCount.toLocaleString()}</td>
                          <td className="px-6 py-3 text-xs text-muted-foreground font-mono">{guild.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-center mt-12">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
              >
                ← Return Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Status;
