import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "How do I invite RankCore to my server?",
    a: "Click the 'Add to Discord' button on our homepage or use the invite link. Make sure you have 'Manage Server' permissions on the server you want to add RankCore to.",
  },
  {
    q: "Is there a support server?",
    a: "Yes! You can join our Discord support server at discord.gg/a9Kea3ymC7 where our team and community are ready to help you.",
  },
  {
    q: "Why are my slash commands not showing up?",
    a: "All of RankCore's commands are available as soon as the bot joins. If you just added RankCore, give Discord a minute and restart your Discord app. Server managers can turn individual commands off in the dashboard → Settings → Command Manager.",
  },
  {
    q: "Can I use RankCore for free?",
    a: "Yes! Almost everything in RankCore is free. Premium (Basic, Pro and Elite) adds extra protection like Anti-Nuke, AI features and higher limits — see rankcore.org/premium.",
  },
  {
    q: "How do I report a bug or request a feature?",
    a: "Use /bot report-bug or /bot suggest in Discord, or join our support server. You can also contact fane_dev directly.",
  },
  {
    q: "Does RankCore work with other bots?",
    a: "Absolutely! RankCore is designed to work alongside other bots without conflicts. Each bot operates independently.",
  },
  {
    q: "How do I configure auto-moderation?",
    a: "Use the /automod commands or the dashboard to configure auto-moderation settings including word filters, spam detection, and link filtering.",
  },
  {
    q: "Is my data safe with RankCore?",
    a: "Yes. We only store necessary data for bot functionality and never share your data with third parties. You can request data deletion at any time.",
  },
  {
    q: "What happens if RankCore goes offline?",
    a: "All settings and data are preserved and everything resumes automatically when the bot comes back online. You can check live status on the Uptime page.",
  },
  {
    q: "How do I delete my data?",
    a: "Use /privacy delete to remove your personal data, or open Privacy Controls in the dashboard. For a full server data removal, contact our support team.",
  },
  {
    q: "Can I self-host RankCore?",
    a: "No, RankCore is not available for self-hosting. This ensures consistent updates, security, and reliability for all users.",
  },
];

const FAQ = () => {
  return (
    <Layout>
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-noxx-red/30 bg-noxx-red/5 flex items-center justify-center"
          >
            <HelpCircle className="w-12 h-12 text-noxx-red" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4"
           
          >
            Frequently Asked Questions
          </motion.h1>
          <p className="text-center text-muted-foreground max-w-xl mx-auto mb-10">
            Find answers to common questions about RankCore Bot
          </p>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AnimatedSection key={i} delay={i * 0.05}>
                  <AccordionItem value={`faq-${i}`} className="glass-card border-border/30 px-6 rounded-xl">
                    <AccordionTrigger className="text-foreground hover:no-underline text-left">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                </AnimatedSection>
              ))}
            </Accordion>

            {/* Still have questions */}
            <AnimatedSection delay={0.3}>
              <div className="glass-card p-8 text-center mt-10">
                <h2 className="text-xl font-bold text-foreground mb-2">Still have questions?</h2>
                <p className="text-muted-foreground mb-6">
                  Join our support server and our team will be happy to help!
                </p>
                <div className="flex items-center justify-center gap-4">
                  <a
                    href="https://discord.gg/a9Kea3ymC7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-noxx-red text-white font-semibold text-sm hover:bg-noxx-red/90 transition-colors"
                  >
                    Get Support
                  </a>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
                  >
                    Return Home
                  </Link>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default FAQ;
