import { Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";
import DiscordText from "@/components/DiscordText";
import { useNews, NEWS_TAGS } from "@/hooks/useNews";

const News = () => {
  const items = useNews();

  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-4">
              Latest News
            </h1>
            <p className="text-center text-muted-foreground max-w-xl mx-auto mb-16">
              Stay updated with the latest announcements and updates from RankCore
            </p>
          </AnimatedSection>

          <div className="max-w-3xl mx-auto space-y-4">
            {items.map((item, i) => {
              const tag = item.tag ? NEWS_TAGS[item.tag] : undefined;
              return (
                <AnimatedSection key={item.id} delay={Math.min(i, 5) * 0.1} direction={i % 2 === 0 ? "left" : "right"}>
                  <div className="glass-card p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="font-display font-bold text-foreground text-xl">
                        <DiscordText text={item.title} />
                      </h2>
                      {tag && (
                        <span
                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                          style={{ color: tag.color, borderColor: `${tag.color}55`, background: `${tag.color}14` }}
                        >
                          {tag.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Calendar className="w-4 h-4" />
                      {item.date}
                    </div>
                    <p className="text-muted-foreground whitespace-pre-line">
                      <DiscordText text={item.description} />
                    </p>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default News;
