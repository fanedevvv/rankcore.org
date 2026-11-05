import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, X, Palette, ArrowRight, Ticket, LayoutDashboard } from "lucide-react";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import { DASHBOARD_URL, SUPPORT_URL } from "@/config/site";
import { TIERS, COMPARISON, BRANDING } from "@/data/premium";

type Billing = "monthly" | "yearly";

const renderCell = (v: boolean | number | string) => {
  if (v === true) return <Check className="w-4 h-4 text-green-400 mx-auto" />;
  if (v === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  if (v === Infinity) return <span className="text-foreground font-semibold">Unlimited</span>;
  return <span className="text-foreground">{v}</span>;
};

const steps = [
  { icon: Ticket, title: "Open a ticket", desc: "Join the RankCore support server and open a premium ticket with the plan you want — for your account or for a whole server." },
  { icon: Crown, title: "Get your code", desc: "Our team sends you a premium code like ROCO-XXXX-XXXX-XXXX." },
  { icon: LayoutDashboard, title: "Redeem it", desc: "Run /redeem code:ROCO-XXXX-XXXX-XXXX in Discord — premium is activated instantly. Check it any time with /premium status." },
];

const Premium = () => {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-noxx-red/30 bg-noxx-red/5 text-sm text-noxx-red mb-4">
              <Crown className="w-4 h-4" /> RankCore Premium
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">
              Unlock more of <span className="text-noxx-red">RankCore</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              RankCore is free to use. Premium adds extra protection, AI features and higher limits — for you or your whole server.
            </p>

            <div className="inline-flex mt-8 p-1 rounded-xl bg-muted border border-border">
              {(["monthly", "yearly"] as Billing[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    billing === b ? "bg-noxx-red text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b === "monthly" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>
          </AnimatedSection>

          {/* Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-6 flex flex-col relative"
                style={tier.popular ? { borderColor: `${tier.color}80` } : undefined}
              >
                {tier.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-black"
                    style={{ background: tier.color }}
                  >
                    Most popular
                  </span>
                )}
                <div className="text-3xl mb-2">{tier.emoji}</div>
                <h2 className="font-display font-bold text-xl" style={{ color: tier.color }}>{tier.name}</h2>
                <p className="text-sm text-muted-foreground mb-4">{tier.tagline}</p>
                <div className="mb-5">
                  <span className="text-3xl font-extrabold text-foreground">{tier.price[billing]}</span>
                  {tier.key !== "free" && (
                    <span className="text-sm text-muted-foreground">/{billing === "monthly" ? "month" : "year"}</span>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: tier.color }} />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                {tier.key === "free" ? (
                  <a
                    href={DASHBOARD_URL}
                    className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
                  >
                    Open Dashboard
                  </a>
                ) : (
                  <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-black transition-opacity hover:opacity-90"
                    style={{ background: tier.color }}
                  >
                    Get {tier.name.replace("RankCore ", "")} <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>

          {/* Custom branding add-on */}
          <AnimatedSection className="max-w-7xl mx-auto mt-8">
            <div className="glass-card p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                <Palette className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-foreground text-lg">{BRANDING.name} <span className="text-sm font-normal text-muted-foreground">· add-on</span></h3>
                <p className="text-sm text-muted-foreground">{BRANDING.desc}</p>
              </div>
              <div className="text-left md:text-right">
                <div className="text-2xl font-extrabold text-purple-400">
                  {BRANDING.price[billing]}
                  <span className="text-sm font-normal text-muted-foreground">/{billing === "monthly" ? "month" : "year"}</span>
                </div>
                <div className="text-xs text-muted-foreground">per server</div>
              </div>
            </div>
          </AnimatedSection>

          {/* Comparison */}
          <AnimatedSection className="max-w-5xl mx-auto mt-20">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground text-center mb-8">Compare plans</h2>
            <div className="glass-card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-muted-foreground font-semibold">Feature</th>
                    {TIERS.map((t) => (
                      <th key={t.key} className="p-4 text-center font-semibold" style={{ color: t.color }}>
                        {t.emoji} {t.name.replace("RankCore ", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([label, ...cells]) => (
                    <tr key={label} className="border-b border-border/50 last:border-0">
                      <td className="p-4 text-muted-foreground">{label}</td>
                      {cells.map((c, i) => (
                        <td key={i} className="p-4 text-center">{renderCell(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimatedSection>

          {/* How to get it */}
          <AnimatedSection className="max-w-5xl mx-auto mt-20">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground text-center mb-3">How to get Premium</h2>
            <p className="text-center text-muted-foreground mb-8">Online checkout is coming soon. Until then, premium is given as codes through our support server.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((s, i) => (
                <div key={s.title} className="glass-card p-6">
                  <div className="w-10 h-10 rounded-xl bg-noxx-red/15 flex items-center justify-center mb-3">
                    <s.icon className="w-5 h-5 text-noxx-red" />
                  </div>
                  <h3 className="font-display font-bold text-foreground mb-1">{i + 1}. {s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-noxx-red text-white font-semibold text-sm hover:bg-noxx-red/90 transition-colors"
              >
                Join Support Server
              </a>
              <a
                href={`${DASHBOARD_URL}/premium`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
              >
                My Premium Status
              </a>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </Layout>
  );
};

export default Premium;
