import { motion } from "framer-motion";
import { ExternalLink, Star } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";

const Partners = () => {
  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4">
              Sponsors & Partners
            </h1>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-16">
              A proud showcase of the amazing bots and services that support and collaborate with our projects.
            </p>
          </AnimatedSection>

          <h2 className="text-2xl font-display font-bold text-center text-noxx-red mb-8">Featured Partners</h2>

          <AnimatedSection direction="left">
            <div className="max-w-3xl mx-auto mb-16">
              <div className="glass-card p-8 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-noxx-red/20 text-noxx-red font-semibold">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                </div>
                <h3 className="font-display font-bold text-foreground text-2xl mb-3">Five-Host Cyber Security</h3>
                <p className="text-muted-foreground mb-4">
                  Experience superior hosting solutions. We offer top-tier equipment for outstanding performance in game hosting, VPS, and web hosting services, ensuring minimal latency and flexible pricing plans.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {["Hosting", "Premium", "VPS", "Games"].map((tag) => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full bg-muted border border-border/50 text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <a href="https://five-host.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2 rounded-lg bg-muted border border-border text-sm text-foreground font-medium hover:bg-muted/80 transition-colors">
                    <ExternalLink className="w-4 h-4" /> Website
                  </a>
                  <a href="https://discord.com/invite/fR6hCYjFpX" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[hsl(235,86%,65%)]/20 border border-[hsl(235,86%,65%)]/30 text-sm text-[hsl(235,86%,65%)] font-medium hover:bg-[hsl(235,86%,65%)]/30 transition-colors">
                    Discord
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <h2 className="text-xl font-display font-semibold text-center text-muted-foreground mb-8">More Partners</h2>
          </AnimatedSection>

          <AnimatedSection direction="right" delay={0.15}>
            <div className="max-w-3xl mx-auto mb-16">
              <div className="glass-card p-8">
                <div className="flex items-center gap-4 mb-4">
                  <img src="https://i.ibb.co/qMP6B9Qc/eef0b18c703b4e9bcf4ba5abdae4c4b2.webp" alt="NoxxBot" className="w-12 h-12 rounded-full" />
                  <h3 className="font-display font-bold text-foreground text-xl">NoxxBot</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Noxx 🛡️ | Where commands meet creativity. Your all-in-one Discord guardian: advanced antinuke protection, robust security, moderation tools, and more. Designed to keep your server safe, active, and stress-free 24/7.
                </p>
                <p className="text-sm text-muted-foreground mb-4">Dashboard: https://dashboard.noxxbot.com/<br />© Xyron Development, 2026. All rights reserved.</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {["Discord", "Multifunctional", "Dashboard", "RankCore brother"].map((tag) => (
                    <span key={tag} className="text-xs px-3 py-1 rounded-full bg-muted border border-border/50 text-muted-foreground">{tag}</span>
                  ))}
                </div>
                <div className="flex gap-3">
                  <a href="https://noxxbot.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2 rounded-lg bg-muted border border-border text-sm text-foreground font-medium hover:bg-muted/80 transition-colors">
                    <ExternalLink className="w-4 h-4" /> Website
                  </a>
                  <a href="https://discord.gg/4Jp78WQw5j" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[hsl(235,86%,65%)]/20 border border-[hsl(235,86%,65%)]/30 text-sm text-[hsl(235,86%,65%)] font-medium hover:bg-[hsl(235,86%,65%)]/30 transition-colors">
                    Discord
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>

          <p className="text-center text-muted-foreground italic mb-8">Supporting the community, one partnership at a time.</p>
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Partners;
