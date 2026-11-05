import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";

const Devs = () => {
  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4">
              Meet The Architects
            </h1>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-16">
              The brilliant minds powering innovation at RankCore Development.
            </p>
          </AnimatedSection>

          <div className="flex justify-center mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-8 text-center max-w-xs"
            >
              <div className="w-24 h-24 mx-auto rounded-full border-2 border-noxx-pink/50 overflow-hidden mb-4 shadow-lg shadow-noxx-pink/20">
                <img
                  src="https://images-ext-1.discordapp.net/external/8MmXv3-D9mAyQkTiQvOZeip2RVv3rYVIwRPmMyXA3qE/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1443369756462944330/a_cf2b646b85b3e6fc50a9713d98ced037.gif?width=275&height=275"
                  alt="FanE"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-display font-bold text-foreground text-lg">FanE</h3>
              <p className="text-sm text-noxx-red mb-4">MasterMind & Head Developer</p>
              <div className="flex justify-center">
                <a href="#" className="w-8 h-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <Globe className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>

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

export default Devs;
