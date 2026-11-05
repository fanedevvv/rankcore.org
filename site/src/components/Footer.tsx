import { Link } from "react-router-dom";
import RankCoreLogo from "@/assets/rankcore-logo.png";
import { DASHBOARD_URL, SUPPORT_URL, TOPGG_URL } from "@/config/site";

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-white/[0.055] bg-[#050507]/80 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="icon-tile w-10 h-10 overflow-hidden bg-noxx-red/10 border-noxx-red/25">
                <img src={RankCoreLogo} alt="RankCore" className="w-9 h-9 object-contain" />
              </span>
              <span className="leading-none">
                <span className="block font-display font-extrabold text-lg text-foreground">RANKCORE</span>
                <span className="block font-mono text-[9px] font-bold tracking-[0.2em] text-muted-foreground mt-1">DISCORD BOT</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              A powerful Discord bot that brings advanced features and seamless automation to your server.
            </p>
            <div className="flex items-center gap-2">
              <a href="https://easy-code.ro/discord" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a href="https://Instagram.com/_stefandrei_" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="mono-label mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">• Dashboard</a></li>
              <li><Link to="/docs" className="hover:text-foreground transition-colors">• Documentation</Link></li>
              <li><Link to="/uptime" className="hover:text-foreground transition-colors">• Status</Link></li>
              <li><a href={TOPGG_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">• Vote on Top.gg</a></li>
              <li><a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">• Support</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mono-label mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-foreground transition-colors">• Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-foreground transition-colors">• Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mono-label mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">• Support Server</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.055] flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 RankCore Development. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
