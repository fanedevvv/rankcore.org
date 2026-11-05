import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";

const Privacy = () => {
  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-noxx-red/30 bg-noxx-red/5 flex items-center justify-center"
          >
            <Shield className="w-10 h-10 text-noxx-red" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-2"
           
          >
            Privacy Policy
          </motion.h1>
          <p className="text-center text-sm text-muted-foreground mb-12">Last updated: March 2026</p>

          <AnimatedSection className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Introduction</h2>
              <p>
                RankCore Bot ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Discord bot and related services.
              </p>
              <p className="mt-2">
                By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Information We Collect</h2>
              <p className="mb-2">We collect information that you provide directly to us and information that is automatically collected when you use our services:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Discord User ID:</strong> Your unique Discord identifier</li>
                <li><strong className="text-foreground">Server ID:</strong> The unique identifier of servers where the bot is used</li>
                <li><strong className="text-foreground">Command Usage:</strong> Information about which commands you use</li>
                <li><strong className="text-foreground">Server Configuration:</strong> Settings you configure for the bot</li>
                <li><strong className="text-foreground">Message Content:</strong> Only when required for specific features you enable</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">How We Use Your Information</h2>
              <p className="mb-2">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and respond to your commands</li>
                <li>Store your preferences and settings</li>
                <li>Monitor and analyze usage patterns</li>
                <li>Detect, prevent, and address technical issues</li>
                <li>Communicate with you about updates and changes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Data Storage & Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Your data is stored on secure servers and we regularly review our security practices.
              </p>
              <p className="mt-2">
                We retain your data only for as long as necessary to provide our services and fulfill the purposes described in this policy. You may request deletion of your data at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Third-Party Disclosure</h2>
              <p className="mb-2">We do not sell, trade, or otherwise transfer your personal information to third parties. We may share information only in the following circumstances:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and safety</li>
                <li>With service providers who assist in our operations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Children's Privacy</h2>
              <p>
                Our services are not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If we discover that we have collected personal information from a child under 13, we will take steps to delete that information promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Your Rights</h2>
              <p className="mb-2">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request data portability</li>
              </ul>
              <p className="mt-2">To exercise these rights, please contact us through our Discord support server.</p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy or our data practices, please contact us through our Discord support server or via the contact information provided on our website.
              </p>
            </section>
          </AnimatedSection>

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

export default Privacy;
