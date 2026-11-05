import { Link, useLocation } from "react-router-dom"; 
import {
  Menu, X, ChevronDown, Shield, LayoutGrid, Settings, Hash,
  Diamond, Activity, Monitor, Users, Sparkles,
  MessageCircle, FileText, HelpCircle, Check, Bot, ExternalLink, Star,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RankCoreLogo from "@/assets/rankcore-logo.png";
import { DASHBOARD_URL, INVITE_URL, SUPPORT_URL, TOPGG_URL } from "@/config/site";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  external?: boolean;
};

type NavCategory = {
  label: string;
  items: NavItem[];
};

const navMenus: NavCategory[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", path: DASHBOARD_URL, icon: LayoutGrid, external: true },
      { label: "Features", path: "/features", icon: Settings },
      { label: "Commands", path: "/commands", icon: Hash },
      { label: "Premium", path: "/premium", icon: Diamond },
    ],
  },
  {
    label: "Info & Status",
    items: [
      { label: "Status", path: "/status", icon: Activity },
      { label: "Statistics", path: "/stats", icon: Monitor },
      { label: "Uptime", path: "/uptime", icon: Activity },
    ],
  },
  {
    label: "Community",
    items: [
      { label: "Partners", path: "/partners", icon: Users },
      { label: "Meet the Staff", path: "/devs", icon: Users },
      { label: "News", path: "/news", icon: Sparkles },
    ],
  },
  {
    label: "Support & Docs",
    items: [
      { label: "Support Server", path: SUPPORT_URL, icon: MessageCircle, external: true },
      { label: "Vote on Top.gg", path: TOPGG_URL, icon: Star, external: true },
      { label: "Documentation", path: "/docs", icon: FileText },
      { label: "FAQ", path: "/faq", icon: HelpCircle },
    ],
  },
];

/* ── Desktop dropdown ── */
const DropdownMenu = ({ menu, isOpen, onToggle, onClose, currentPath }: {
  menu: NavCategory;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  currentPath: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const hasActive = menu.items.some((i) => !i.external && currentPath === i.path);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 px-3.5 py-2 rounded-[10px] border text-sm font-medium transition-colors ${
          hasActive
            ? "border-noxx-red/30 text-noxx-red bg-noxx-red/[0.08]"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
        }`}
      >
        {menu.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" as const }}
            className="absolute top-full mt-2 left-0 min-w-[230px] rounded-2xl border border-white/[0.06] bg-[#0b0b0f]/95 backdrop-blur-xl shadow-2xl shadow-black/60 p-1.5 z-50"
          >
            {menu.items.map((item) => {
              const Icon = item.icon;
              const active = !item.external && currentPath === item.path;
              const cls = active
                ? "flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-semibold text-foreground bg-noxx-red/[0.08] border border-noxx-red/30 transition-colors"
                : "flex items-center gap-3 px-2 py-1.5 rounded-xl text-sm font-medium text-muted-foreground border border-transparent hover:text-foreground hover:bg-white/[0.04] transition-colors";

              const content = (
                <>
                  <span className={`icon-tile w-8 h-8 ${active ? "text-noxx-red" : ""}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {active ? <Check className="w-4 h-4 text-noxx-red" /> : item.external && <ExternalLink className="w-3.5 h-3.5 opacity-50" />}
                </>
              );

              return item.external ? (
                <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" onClick={onClose} className={cls}>
                  {content}
                </a>
              ) : (
                <Link key={item.path} to={item.path} onClick={onClose} className={cls}>
                  {content}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Mobile flat menu item ── */
const MobileMenuItem = ({ item, onClose, isActive }: { item: NavItem; onClose: () => void; isActive: boolean }) => {
  const Icon = item.icon;
  const base = "flex items-center gap-3 mx-2 px-2 py-2 rounded-xl text-sm border transition-colors";
  const activeClass = isActive
    ? `${base} font-semibold text-foreground bg-noxx-red/[0.08] border-noxx-red/30`
    : `${base} font-medium text-muted-foreground border-transparent hover:text-foreground hover:bg-white/[0.04]`;

  const content = (
    <>
      <span className={`icon-tile w-9 h-9 ${isActive ? "text-noxx-red" : ""}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="flex-1">{item.label}</span>
      {isActive ? <Check className="w-4 h-4 text-noxx-red" /> : item.external && <ExternalLink className="w-3.5 h-3.5 opacity-50" />}
    </>
  );

  return item.external ? (
    <a href={item.path} target="_blank" rel="noopener noreferrer" onClick={onClose} className={activeClass}>
      {content}
    </a>
  ) : (
    <Link to={item.path} onClick={onClose} className={activeClass}>
      {content}
    </Link>
  );
};

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#07070a]/80 border-b border-white/[0.055]">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <span className="icon-tile w-10 h-10 overflow-hidden bg-noxx-red/10 border-noxx-red/25">
            <img src={RankCoreLogo} alt="RankCore" className="w-9 h-9 object-contain" />
          </span>
          <span className="leading-none">
            <span className="block font-display font-extrabold text-lg tracking-tight text-foreground">RANKCORE</span>
            <span className="block font-mono text-[9px] font-bold tracking-[0.2em] text-muted-foreground mt-1">DISCORD BOT</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          {navMenus.map((menu) => (
            <DropdownMenu
              key={menu.label}
              menu={menu}
              isOpen={openMenu === menu.label}
              onToggle={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
              onClose={() => setOpenMenu(null)}
              currentPath={location.pathname}
            />
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a
            href={INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-noxx-red text-white text-sm font-semibold hover:brightness-110 transition shadow-lg shadow-noxx-red/20"
          >
            <Bot className="w-4 h-4" />
            Add to Discord
          </a>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-white/[0.03] text-foreground border border-white/10 text-sm font-medium hover:bg-white/[0.06] transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            Dashboard
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu — flat list with category headers + icons */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" as const }}
            className="md:hidden overflow-hidden border-t border-white/[0.055] bg-[#07070a]/95 backdrop-blur-xl"
          >
            <div className="flex flex-col max-h-[calc(100vh-4rem)]">
              {/* Scrollable menu items */}
              <div className="flex-1 overflow-y-auto py-2">
                <div className="pb-2">
                  {navMenus.map((category) => (
                    <div key={category.label} className="mb-2">
                      <p className="mono-label px-5 pt-3 pb-1.5">{category.label}</p>
                      {category.items.map((item) => (
                        <MobileMenuItem key={item.path} item={item} onClose={closeMobile} isActive={!item.external && location.pathname === item.path} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sticky action buttons at bottom */}
              <div className="flex gap-2 p-3 border-t border-white/[0.055]">
                <a
                  href={INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobile}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-noxx-red text-white text-sm font-semibold"
                >
                  <Bot className="w-4 h-4" />
                  Add to Discord
                </a>
                <a
                  href={DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-foreground text-sm font-semibold"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Dashboard
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
