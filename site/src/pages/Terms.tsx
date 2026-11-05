import { motion } from "framer-motion";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import AnimatedSection from "@/components/AnimatedSection";

const Terms = () => {
  return (
    <Layout>
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-noxx-red/30 bg-noxx-red/5 flex items-center justify-center"
          >
            <FileText className="w-10 h-10 text-noxx-red" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-extrabold text-center text-foreground mb-2"
           
          >
            Terms of Service
          </motion.h1>
          <p className="text-center text-sm text-muted-foreground mb-12">Last updated: March 2026</p>

          <AnimatedSection className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Acknowledgment</h2>
              <p>
                These are the Terms and Conditions governing the use of RankCore Bot and the agreement that operates between you and us. These Terms set out the rights and obligations of all users regarding the use of our services.
              </p>
              <p className="mt-2">
                By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access or use our services.
              </p>
              <p className="mt-2">
                You represent that you are over the age of 13. We do not permit those under 13 to use our services in accordance with Discord's Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Use of Service</h2>
              <p className="mb-2">By using RankCore Bot, you agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Use the bot only for lawful purposes</li>
                <li>Not attempt to exploit, hack, or disrupt the service</li>
                <li>Not use the bot to harass, abuse, or harm others</li>
                <li>Comply with Discord's Terms of Service and Community Guidelines</li>
                <li>Not use automated methods to interact with the bot beyond normal usage</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">User Accounts</h2>
              <p>
                When you use our services, you are responsible for maintaining the security of your Discord account and for any activities that occur under your account. You agree not to share your account credentials and to notify us immediately of any unauthorized use.
              </p>
              <p className="mt-2">
                We reserve the right to terminate or suspend your access to our services at any time, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Content Restrictions</h2>
              <p className="mb-2">You may not use our services to transmit content that is:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Unlawful or promotes unlawful activity</li>
                <li>Defamatory, discriminatory, or mean-spirited</li>
                <li>Spam or unauthorized advertising</li>
                <li>Containing malware, viruses, or harmful code</li>
                <li>Infringing on intellectual property rights</li>
                <li>Impersonating any person or entity</li>
                <li>Violating the privacy of others</li>
                <li>False, misleading, or deceptive</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Intellectual Property</h2>
              <p>
                The service and its original content, features, and functionality are and will remain the exclusive property of RankCore Bot and its licensors. The service is protected by copyright, trademark, and other laws.
              </p>
              <p className="mt-2">
                You may not copy, modify, distribute, sell, or lease any part of our services without explicit written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, RankCore Bot and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
              </p>
              <p className="mt-2">
                Our total liability shall not exceed the amount you paid us, if any, in the past twelve months for the services giving rise to the claim.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Disclaimer</h2>
              <p>
                The service is provided on an "AS IS" and "AS AVAILABLE" basis. We disclaim all warranties, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
              </p>
              <p className="mt-2">
                We do not warrant that the service will be uninterrupted, secure, or error-free, or that defects will be corrected.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Termination</h2>
              <p>
                We may terminate or suspend your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms.
              </p>
              <p className="mt-2">
                Upon termination, your right to use the service will cease immediately. All provisions of the Terms which by their nature should survive termination shall survive.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Changes to These Terms</h2>
              <p>
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will make reasonable efforts to provide notice prior to any new terms taking effect.
              </p>
              <p className="mt-2">
                By continuing to access or use our service after those revisions become effective, you agree to be bound by the revised terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-display font-bold text-foreground mb-3">Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us through our Discord support server or via the contact information provided on our website.
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

export default Terms;
