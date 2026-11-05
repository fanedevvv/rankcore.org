import { Ghost, ArrowLeft, Home, Sparkles, Terminal } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <AnimatedSection>
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-noxx-red/10 border border-noxx-red/30 flex items-center justify-center mb-6">
                <Ghost className="w-10 h-10 text-noxx-red" />
              </div>
            </div>

            <h1 className="text-8xl md:text-9xl font-display font-extrabold text-noxx-red mb-2">
              404
            </h1>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">Page Not Found</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Oops! It seems like you've ventured into uncharted territory. The page you're looking for doesn't exist or has been moved.
            </p>
          </AnimatedSection>

          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-muted border border-border text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
            <Link to="/" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-noxx-red text-foreground font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-noxx-red/20">
              <Home className="w-4 h-4" /> Return Home
            </Link>
          </div>

          <div className="max-w-2xl mx-auto">
            <h3 className="font-display font-semibold text-foreground mb-4">You might want to check out:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link to="/commands" className="glass-card-hover p-5 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Terminal className="w-5 h-5 text-noxx-red" />
                  <h4 className="font-display font-semibold text-foreground">Commands</h4>
                </div>
                <p className="text-sm text-muted-foreground">Browse our comprehensive list of bot commands</p>
              </Link>
              <Link to="/features" className="glass-card-hover p-5 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-5 h-5 text-noxx-red" />
                  <h4 className="font-display font-semibold text-foreground">Features</h4>
                </div>
                <p className="text-sm text-muted-foreground">Discover all the powerful features RankCore offers</p>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default NotFound;
