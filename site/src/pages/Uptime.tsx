import { motion } from "framer-motion";
import { Globe, Server, Bot, AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import { API_BASE } from "@/config/site";

type ServiceStatus = "operational" | "down";

interface UptimeResponse {
  services: { name: string; status: ServiceStatus; ping: number | null }[];
  days: { date: string; state: "ok" | "partial" | "down" | "nodata"; uptime: number | null }[];
  overallUptime: number | null;
  trackedDays: number;
  botUptimeMs: number;
}

const icons: Record<string, LucideIcon> = { Website: Globe, Dashboard: Server, Bot };

const barColor: Record<string, string> = {
  ok: "bg-noxx-green",
  partial: "bg-yellow-500",
  down: "bg-red-500",
  nodata: "bg-muted/60",
};

const formatDuration = (ms: number) => {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const Uptime = () => {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<UptimeResponse>({
    queryKey: ["site-uptime"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/uptime`);
      if (!res.ok) throw new Error(`Uptime request failed (${res.status})`);
      return res.json();
    },
    refetchInterval: 60_000,
    retry: 1,
  });

  const allUp = data?.services.every((s) => s.status === "operational");
  const problems = data?.days.filter((d) => d.state === "down" || d.state === "partial") ?? [];

  return (
    <Layout>
      <section className="py-12">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
            {isLoading ? (
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-border/50 bg-muted/30 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" /> Checking services…
              </span>
            ) : isError || !allUp ? (
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-yellow-500/30 bg-yellow-500/5 text-sm text-yellow-500">
                <AlertCircle className="w-4 h-4" /> Some services have issues
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-noxx-green/30 bg-noxx-green/5 text-sm text-noxx-green">
                <CheckCircle2 className="w-4 h-4" /> All systems operational
              </span>
            )}
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4">
            Uptime Status
          </h1>
          <p className="text-center text-muted-foreground max-w-xl mx-auto mb-2">
            Live service status and bot availability over the past 90 days
          </p>
          <p className="text-center text-xs text-muted-foreground mb-10">
            {dataUpdatedAt ? `Last updated: ${new Date(dataUpdatedAt).toLocaleString()}` : " "}
            {" · "}
            <button onClick={() => refetch()} className="text-noxx-red hover:underline">Refresh</button>
          </p>

          <div className="max-w-3xl mx-auto space-y-6">
            {isError && (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                Could not reach the status API. The bot may be restarting — try again in a moment.
              </div>
            )}

            {data?.services.map((service, idx) => {
              const Icon = icons[service.name] ?? Server;
              const up = service.status === "operational";
              const isBot = service.name === "Bot";
              return (
                <AnimatedSection key={service.name} delay={idx * 0.1}>
                  <motion.div whileHover={{ scale: 1.01 }} className="glass-card p-6">
                    <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                          <p className={`text-sm flex items-center gap-1.5 ${up ? "text-noxx-green" : "text-red-500"}`}>
                            <span className={`w-2 h-2 rounded-full ${up ? "bg-noxx-green" : "bg-red-500"}`} />
                            {up ? "Operational" : "Down"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        {service.ping !== null && service.ping >= 0 && (
                          <div>
                            <p className="text-lg font-bold text-noxx-red">{service.ping}ms</p>
                            <p className="text-xs text-muted-foreground">ping</p>
                          </div>
                        )}
                        {isBot && data.overallUptime !== null && (
                          <div>
                            <p className="text-lg font-bold text-noxx-green">{data.overallUptime}%</p>
                            <p className="text-xs text-muted-foreground">uptime</p>
                          </div>
                        )}
                        {isBot && data.botUptimeMs > 0 && (
                          <div>
                            <p className="text-lg font-bold text-foreground">{formatDuration(data.botUptimeMs)}</p>
                            <p className="text-xs text-muted-foreground">online for</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {isBot && (
                      <>
                        <div className="flex gap-[2px] h-8 items-end">
                          {data.days.map((day) => (
                            <div
                              key={day.date}
                              title={`${day.date}: ${day.state === "nodata" ? "no data" : `${day.uptime}%`}`}
                              className={`flex-1 rounded-sm h-full ${barColor[day.state]}`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-muted-foreground">90 days ago</span>
                          <span className="text-xs text-muted-foreground">
                            {data.trackedDays} day{data.trackedDays === 1 ? "" : "s"} tracked
                          </span>
                          <span className="text-xs text-muted-foreground">Today</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatedSection>
              );
            })}

            {/* Recent Notices */}
            {data && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
                <h2 className="text-lg font-bold text-foreground mb-4">Recent Notices</h2>
                {problems.length === 0 ? (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Clock className="w-5 h-5" />
                    <p className="text-sm">No incidents recorded in the past 90 days</p>
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {problems.slice(-5).reverse().map((d) => (
                      <li key={d.date} className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${barColor[d.state]}`} />
                        {d.date} — {d.state === "down" ? "outage" : "partial outage"} ({d.uptime}% uptime)
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            <div className="text-center mt-8">
              <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors">
                ← Return Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Uptime;
