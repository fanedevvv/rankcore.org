// ─── Global CSRF fetch patch ───────────────────────────────────────────────
(function patchFetchWithCsrf() {
  const getMeta = () =>
    document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init = {}) {
    const method = (init.method || "GET").toUpperCase();
    const url = typeof input === "string" ? input : (input?.url ?? "");
    const isSameOrigin = !url.startsWith("http") || url.startsWith(window.location.origin);
    if (["POST","PUT","PATCH","DELETE"].includes(method) && isSameOrigin) {
      const alreadyHasCsrf = Object.keys(init.headers || {}).some(k => k.toLowerCase() === "x-csrf-token");
      init.headers = Object.assign({}, init.headers);
      if (!alreadyHasCsrf) init.headers["X-CSRF-Token"] = getMeta();
    }
    return _fetch(input, init);
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  const sidebarContainer = document.getElementById("razor-sidebar");
  if (!sidebarContainer) return;

  const guildId = location.pathname.split("/")[2];
  if (!guildId || !/^\d{17,20}$/.test(guildId)) return;

  // ─── Nav items — 9 main buttons ───────────────────────────────────────────
  const NAV = [
    {
      id: "overview",
      name: "Overview",
      path: "",
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
    },
    {
      id: "moderation",
      name: "Moderation",
      path: "/hub/moderation",
      color: "#f87171",
      bg: "rgba(248,113,113,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
    },
    {
      id: "community",
      name: "Community",
      path: "/hub/community",
      color: "#34d399",
      bg: "rgba(52,211,153,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    },
    {
      id: "staff",
      name: "Staff",
      path: "/hub/staff",
      color: "#818cf8",
      bg: "rgba(129,140,248,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    },
    {
      id: "tools",
      name: "Tools",
      path: "/hub/tools",
      color: "#38bdf8",
      bg: "rgba(56,189,248,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
    },
    {
      id: "notifications",
      name: "Notifications",
      path: "/hub/notifications",
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    },
    {
      id: "fun",
      name: "Fun & Games",
      path: "/hub/fun",
      color: "#f472b6",
      bg: "rgba(244,114,182,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    },
    {
      id: "settings",
      name: "Settings",
      path: "/hub/settings",
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    },
    {
      id: "premium",
      name: "Premium",
      path: null,         // top-level link, not guild-scoped
      href: "/subscriptions",
      color: "#c084fc",
      bg: "rgba(192,132,252,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
    },
  ];

  // Which hub path does the current URL belong to?
  const SECTION_MAP = {
    // moderation hub
    "/automod": "moderation", "/logs": "moderation", "/ghostping": "moderation",
    "/verify": "moderation", "/antinuke": "moderation", "/massjoin": "moderation",
    "/advanced-automod": "moderation", "/antiscam": "moderation", "/ipverify": "moderation",
    // community hub
    "/leveling": "community", "/reactionrole": "community",
    "/suggestions": "community", "/confession": "community", "/invite-config": "community",
    "/qotd": "community", "/jtc": "community", "/music": "community", "/staff-list": "community",
    // staff hub
    "/inbuilt-commands": "staff", "/staff-recovery": "staff", "/staffapps": "staff",
    "/staff-rating": "staff", "/dashboard-roles": "staff", "/connection-roles": "staff",
    // tools hub
    "/ticket": "tools", "/autoresponder": "tools", "/embed": "tools",
    "/templates": "tools", "/sticky": "tools", "/uptime": "tools",
    "/social": "tools", "/ai": "tools", "/modmail": "tools", "/polls": "tools",
    // notifications hub
    "/welcome": "notifications", "/goodbye": "notifications", "/booster": "notifications",
    // fun & games hub
    "/giveaway": "fun", "/counting": "fun", "/guessthenumber": "fun",
    "/uwulock": "fun", "/catlock": "fun", "/christmas": "fun", "/halloween": "fun",
    "/afk": "fun", "/reputation": "fun",
    // settings hub
    "/commands": "settings", "/global-perm": "settings",
    "/customcommands": "settings", "/custombranding": "settings",
    "/errors": "settings", "/autorole": "settings",
  };

  // ─── Global search index — every feature across all hubs ───────────────────
  const GLOBAL_SEARCH_INDEX = [
    { label: "Auto Moderation",      path: "/automod",            hub: "moderation",    keywords: "auto moderation filter bad words links spam" },
    { label: "Advanced Automod",     path: "/advanced-automod",   hub: "moderation",    keywords: "advanced automod ai spam caps emoji flood mentions" },
    { label: "Anti-Scam",            path: "/antiscam",           hub: "moderation",    keywords: "anti scam phishing links scam messages delete" },
    { label: "Audit Logs",           path: "/logs",               hub: "moderation",    keywords: "audit logs track bans kicks edits deletes events" },
    { label: "Ghost Ping Detection", path: "/ghostping",          hub: "moderation",    keywords: "ghost ping detection deleted ping accountability" },
    { label: "Verification",         path: "/verify",             hub: "moderation",    keywords: "verification captcha button gate new members" },
    { label: "IP Verification",      path: "/ipverify",           hub: "moderation",    keywords: "ip verification vpn proxy tor alt detection link" },
    { label: "AntiNuke",             path: "/antinuke",           hub: "moderation",    keywords: "antinuke anti nuke prevent mass ban channel delete" },
    { label: "Mass Join Protection", path: "/massjoin",           hub: "moderation",    keywords: "mass join protection raid lock accounts" },
    { label: "Leveling System",      path: "/leveling",           hub: "community",     keywords: "leveling xp ranks leaderboard level up announcements" },
    { label: "Reaction Roles",       path: "/reactionrole",       hub: "community",     keywords: "reaction roles self assign roles reacting message" },
    { label: "Suggestions",          path: "/suggestions",        hub: "community",     keywords: "suggestions suggestion board voting up down" },
    { label: "Confessions",          path: "/confession",         hub: "community",     keywords: "confessions anonymous confession moderation controls" },
    { label: "Invite Tracking",      path: "/invite-config",      hub: "community",     keywords: "invite tracking invite links members" },
    { label: "Question of the Day",  path: "/qotd",               hub: "community",     keywords: "question of the day daily discussion role pings" },
    { label: "Join To Create",       path: "/jtc",                hub: "community",     keywords: "join to create temporary voice channels dynamic" },
    { label: "Music Control",        path: "/music",              hub: "community",     keywords: "music play youtube voice channels" },
    { label: "Staff List",           path: "/staff-list",         hub: "community",     keywords: "staff list auto post embed rank tiers" },
    { label: "Staff Applications",   path: "/staffapps",          hub: "staff",         keywords: "staff applications multi panel dm questions" },
    { label: "Staff Commands",       path: "/inbuilt-commands",   hub: "staff",         keywords: "staff commands promote infract warning suspension removal" },
    { label: "Staff Recovery Keys",  path: "/staff-recovery",     hub: "staff",         keywords: "staff recovery keys restore access lockout one-time" },
    { label: "Staff Rating",         path: "/staff-rating",       hub: "staff",         keywords: "staff rating rate performance stars reviews" },
    { label: "Dashboard Roles",      path: "/dashboard-roles",    hub: "staff",         keywords: "dashboard roles staff access control dashboard" },
    { label: "Connection Roles",     path: "/connection-roles",   hub: "staff",         keywords: "connection roles link social accounts discord" },
    { label: "Ticket System",        path: "/ticket",             hub: "tools",         keywords: "ticket system support tickets transcripts panels routing" },
    { label: "Modmail",              path: "/modmail",            hub: "tools",         keywords: "modmail mod mail direct message staff" },
    { label: "Live Embed Creator",   path: "/embed",              hub: "tools",         keywords: "embed creator create post rich embeds" },
    { label: "Message Templates",    path: "/templates",          hub: "tools",         keywords: "message templates save reusable messages buttons components" },
    { label: "Autoresponder",        path: "/autoresponder",      hub: "tools",         keywords: "autoresponder auto reply keywords trigger words" },
    { label: "Sticky Messages",      path: "/sticky",             hub: "tools",         keywords: "sticky messages pin message bottom channel" },
    { label: "Uptime Monitor",       path: "/uptime",             hub: "tools",         keywords: "uptime monitor websites alerts down" },
    { label: "Social Notifications", path: "/social",             hub: "tools",         keywords: "social notifications youtube twitch alerts" },
    { label: "AI Chatbot",           path: "/ai",                 hub: "tools",         keywords: "ai chatbot chat assistant trained server" },
    { label: "Polls",                path: "/polls",              hub: "tools",         keywords: "polls voting survey" },
    { label: "Welcome System",       path: "/welcome",            hub: "notifications", keywords: "welcome system greet new members custom messages embeds" },
    { label: "Goodbye System",       path: "/goodbye",            hub: "notifications", keywords: "goodbye system farewell messages leave server" },
    { label: "Booster Rewards",      path: "/booster",            hub: "notifications", keywords: "booster rewards thank members boost server message" },
    { label: "Giveaways",            path: "/giveaway",           hub: "fun",           keywords: "giveaways timed winner selection" },
    { label: "Counting",             path: "/counting",           hub: "fun",           keywords: "counting channel game count together" },
    { label: "Guess The Number",     path: "/guessthenumber",     hub: "fun",           keywords: "guess the number number guessing game" },
    { label: "UwU Lock",             path: "/uwulock",            hub: "fun",           keywords: "uwu lock force type uwu speak punishment" },
    { label: "Cat Lock",             path: "/catlock",            hub: "fun",           keywords: "cat lock force cat speak channel punishment" },
    { label: "Christmas Mode",       path: "/christmas",          hub: "fun",           keywords: "christmas mode seasonal holiday decorations" },
    { label: "Halloween Mode",       path: "/halloween",          hub: "fun",           keywords: "halloween mode seasonal spooky" },
    { label: "AFK",                  path: "/afk",                hub: "fun",           keywords: "afk away from keyboard auto status" },
    { label: "Reputation",           path: "/reputation",         hub: "fun",           keywords: "reputation rep points kudos" },
    { label: "Command Manager",      path: "/commands",           hub: "settings",      keywords: "command manager enable disable bot commands" },
    { label: "Global Permissions",   path: "/global-perm",        hub: "settings",      keywords: "global permissions permission overrides command role" },
    { label: "Auto Role",            path: "/autorole",           hub: "settings",      keywords: "auto role automatically assign roles joins" },
    { label: "Custom Commands",      path: "/customcommands",     hub: "settings",      keywords: "custom commands build own commands responses logic" },
    { label: "Custom Branding",      path: "/custombranding",     hub: "settings",      keywords: "custom branding replace noxx branded bot" },
    { label: "Error Log",            path: "/errors",             hub: "settings",      keywords: "error log bot errors warnings diagnostics" },
  ];

  const getActiveSection = () => {
    const pathname = location.pathname;
    const suffix   = pathname.replace(`/guild/${guildId}`, "");
    // Direct hub page match
    for (const item of NAV) {
      const fullLink = `/guild/${guildId}${item.path}`;
      if (pathname === fullLink || (item.id === "overview" &&
          (pathname === `/guild/${guildId}` || pathname === `/guild/${guildId}/`))) {
        return item.id;
      }
    }
    // Feature page inside a hub
    return SECTION_MAP[suffix] ?? null;
  };

  // ─── Inject styles ────────────────────────────────────────────────────────
  if (!document.getElementById("razor-sidebar-styles")) {
    const s = document.createElement("style");
    s.id = "razor-sidebar-styles";
    s.textContent = `
      #razor-sidebar {
        position: fixed; top: 0; left: 0;
        width: 220px;
        background: #09090b;
        border-right: 1px solid rgba(255,255,255,0.06);
        display: flex; flex-direction: column;
        height: 100%; height: 100dvh;
        font-family: sans-serif;
        z-index: 100;
        transform: translateX(-100%) translateZ(0);
        transition: transform 0.26s cubic-bezier(0.4,0,0.2,1);
        padding-left: env(safe-area-inset-left, 0);
      }
      @media (min-width: 1024px) {
        #razor-sidebar { position: sticky; transform: translateX(0) translateZ(0) !important; flex-shrink: 0; height: 100vh; height: 100dvh; }
        #razor-mobile-btn { display: none !important; }
        #razor-overlay    { display: none !important; }
      }
      #razor-sidebar.is-open { transform: translateX(0) translateZ(0); }

      #razor-sidebar .rzr-header {
        padding: max(20px, env(safe-area-inset-top, 20px)) 16px 14px 18px;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      #razor-sidebar .rzr-nav {
        flex: 1; display: flex; flex-direction: column;
        padding: 16px 12px; gap: 6px;
        overflow-y: auto;
      }

      /* Big nav button */
      .rzr-nav-btn {
        display: flex; align-items: center; gap: 13px;
        padding: 13px 14px; border-radius: 12px;
        text-decoration: none; font-size: 14px; font-weight: 600;
        color: rgba(156,163,175,1);
        background: transparent;
        border: 1px solid transparent;
        transition: all 0.15s;
        position: relative; overflow: hidden;
        -webkit-tap-highlight-color: transparent;
      }
      .rzr-nav-btn:hover {
        color: rgba(229,231,235,1);
        background: rgba(255,255,255,0.04);
        border-color: rgba(255,255,255,0.06);
      }
      .rzr-nav-btn.active {
        color: white;
        background: var(--rzr-btn-bg, rgba(139,92,246,0.1));
        border-color: var(--rzr-btn-color, rgba(139,92,246,0.25));
      }
      .rzr-nav-btn .rzr-btn-icon {
        width: 36px; height: 36px; border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,0.05);
        color: rgba(107,114,128,1);
        flex-shrink: 0;
        transition: all 0.15s;
      }
      .rzr-nav-btn:hover .rzr-btn-icon { background: rgba(255,255,255,0.08); color: rgba(209,213,219,1); }
      .rzr-nav-btn.active .rzr-btn-icon {
        background: var(--rzr-btn-bg, rgba(139,92,246,0.15));
        color: var(--rzr-btn-color, #8B5CF6);
      }
      .rzr-nav-btn .rzr-btn-arrow {
        margin-left: auto; flex-shrink: 0;
        color: rgba(75,85,99,1);
        transition: color 0.15s, transform 0.15s;
        opacity: 0;
      }
      .rzr-nav-btn:hover .rzr-btn-arrow { opacity: 1; color: rgba(107,114,128,1); transform: translateX(2px); }
      .rzr-nav-btn.active .rzr-btn-arrow { opacity: 1; color: var(--rzr-btn-color, #8B5CF6); }

      /* Active glow strip on left edge */
      .rzr-nav-btn.active::before {
        content: '';
        position: absolute; left: 0; top: 20%; bottom: 20%;
        width: 3px; border-radius: 0 3px 3px 0;
        background: var(--rzr-btn-color, #8B5CF6);
        box-shadow: 0 0 8px var(--rzr-btn-color, #8B5CF6);
      }

      #razor-sidebar .rzr-footer {
        padding: 12px;
        padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
        border-top: 1px solid rgba(255,255,255,0.05);
        flex-shrink: 0;
      }

      /* Legal links row */
      .rzr-legal {
        display: flex; align-items: center; justify-content: center;
        gap: 4px; padding: 8px 4px 0;
      }
      .rzr-legal-link {
        display: flex; align-items: center; gap: 4px;
        font-size: 10px; font-weight: 600; color: rgba(75,85,99,1);
        text-decoration: none; padding: 4px 8px; border-radius: 6px;
        border: 1px solid transparent;
        transition: all 0.15s; white-space: nowrap;
        font-family: inherit; cursor: pointer; background: none;
      }
      .rzr-legal-link:hover {
        color: rgba(148,163,184,1);
        background: rgba(255,255,255,0.04);
        border-color: rgba(255,255,255,0.07);
      }
      .rzr-legal-dot {
        width: 3px; height: 3px; border-radius: 50%;
        background: rgba(55,65,81,1); flex-shrink: 0;
      }

      /* Overlay */
      #razor-overlay {
        position: fixed; top: 0; left: 220px; right: 0; bottom: 0;
        background: rgba(0,0,0,0.65);
        z-index: 99; opacity: 0; pointer-events: none;
        transition: opacity 0.26s ease;
        -webkit-tap-highlight-color: transparent;
      }
      #razor-overlay.is-open { opacity: 1; pointer-events: auto; touch-action: none; }

      /* Mobile btn */
      #razor-mobile-btn {
        position: fixed;
        top: max(16px, env(safe-area-inset-top, 16px));
        left: max(16px, env(safe-area-inset-left, 16px));
        z-index: 50; padding: 10px; border-radius: 12px;
        background: rgba(9,9,11,0.93);
        border: 1px solid rgba(255,255,255,0.1); color: white; cursor: pointer;
        min-width: 44px; min-height: 44px;
        display: flex; align-items: center; justify-content: center;
        -webkit-tap-highlight-color: transparent; transition: background 0.15s;
      }
      #razor-mobile-btn:hover { background: rgba(20,20,24,0.95); }

      #close-sidebar-btn {
        min-width: 36px; min-height: 36px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 8px; color: rgba(156,163,175,1);
        background: transparent; border: none; cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }
      #close-sidebar-btn:hover { color: white; background: rgba(255,255,255,0.06); }

      body.razor-sidebar-open { overflow: hidden; position: fixed; inset: 0; }

      /* ── Global sidebar search ──────────────────────────────────────────── */
      #rzr-search { padding: 0 12px 8px; flex-shrink: 0; position: relative; }
      #rzr-search-wrap {
        display: flex; align-items: center; gap: 8px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px; padding: 0 10px; transition: border-color .15s, box-shadow .15s;
      }
      #rzr-search-wrap:focus-within {
        border-color: rgba(139,92,246,.3);
        box-shadow: 0 0 0 2px rgba(139,92,246,.08);
      }
      #rzr-search-wrap svg { flex-shrink: 0; color: rgba(107,114,128,1); }
      #rzr-search-input {
        flex: 1; background: none; border: none; outline: none;
        color: rgba(229,231,235,1); font-size: 12px; font-family: inherit;
        padding: 9px 0; min-width: 0;
      }
      #rzr-search-input::placeholder { color: rgba(107,114,128,1); }
      #rzr-search-results {
        position: absolute; top: calc(100% - 4px); left: 12px; right: 12px;
        background: #13131a; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; max-height: 320px; overflow-y: auto;
        display: none; z-index: 110;
        box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      }
      #rzr-search-results.is-open { display: block; }
      #rzr-search-results::-webkit-scrollbar { width: 3px; }
      #rzr-search-results::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      .rzr-sr {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; cursor: pointer; transition: background .1s;
        text-decoration: none; color: rgba(156,163,175,1);
      }
      .rzr-sr:hover { background: rgba(255,255,255,0.04); color: rgba(229,231,235,1); }
      .rzr-sr:not(:last-child)::after {
        content: ''; position: absolute; bottom: 0; left: 12px; right: 12px;
        height: 1px; background: rgba(255,255,255,0.05);
      }
      .rzr-sr-label { flex: 1; font-size: 12px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .rzr-sr-hub {
        font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
        padding: 2px 7px; border-radius: 4px; flex-shrink: 0;
      }
      .rzr-sr-empty { padding: 16px 12px; text-align: center; font-size: 11px; color: rgba(107,114,128,1); }
      #rzr-search-clear {
        background: none; border: none; color: rgba(107,114,128,1);
        cursor: pointer; padding: 4px; border-radius: 4px; display: none;
      }
      #rzr-search-clear.is-visible { display: block; }
      #rzr-search-clear:hover { color: rgba(229,231,235,1); }
    `;
    document.head.appendChild(s);
  }

  // ─── Mobile toggle ────────────────────────────────────────────────────────
  let isOpen = false, savedScrollY = 0;
  const overlay = document.createElement("div");
  overlay.id = "razor-overlay";
  document.body.appendChild(overlay);

  const openSidebar = () => {
    if (isOpen) return;
    isOpen = true; savedScrollY = window.scrollY;
    sidebarContainer.classList.add("is-open");
    overlay.classList.add("is-open");
    document.body.classList.add("razor-sidebar-open");
    document.body.style.top = `-${savedScrollY}px`;
  };
  const closeSidebar = () => {
    if (!isOpen) return;
    isOpen = false;
    sidebarContainer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    document.body.classList.remove("razor-sidebar-open");
    document.body.style.top = "";
    window.scrollTo({ top: savedScrollY, behavior: "instant" });
  };
  overlay.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && isOpen) closeSidebar(); });

  // ─── SPA Navigation ───────────────────────────────────────────────────────
  let _navLocked = false;

  // Progress bar — uses NxBar from loading.js if available, else standalone
  const _navBar = (() => {
    let el = null, w = 0, timer = null;
    const getEl = () => {
      if (!el) {
        el = document.getElementById('nx-progress');
        if (!el) {
          el = document.createElement('div');
          el.id = 'nx-progress';
          el.style.cssText = 'position:fixed;top:0;left:0;height:2px;background:linear-gradient(90deg,#38D4FF,#8B5CF6,#E05CFF);box-shadow:0 0 10px rgba(139,92,246,.7);z-index:99998;width:0%;opacity:0;pointer-events:none;';
          document.body.appendChild(el);
        }
      }
      return el;
    };
    return {
      start() {
        const b = getEl(); w = 10;
        b.style.transition = 'width .25s ease, opacity .1s ease';
        b.style.opacity = '1'; b.style.width = w + '%';
        clearInterval(timer);
        timer = setInterval(() => {
          if (w < 82) { w += Math.random() * 8; b.style.width = Math.min(w, 82) + '%'; }
        }, 300);
      },
      done() {
        const b = getEl(); clearInterval(timer);
        b.style.transition = 'width .15s ease, opacity .5s ease .15s';
        b.style.width = '100%';
        setTimeout(() => { b.style.opacity = '0'; setTimeout(() => { b.style.width = '0%'; b.style.transition = ''; w = 0; }, 500); }, 150);
      },
    };
  })();

  // Transparent click-blocker so rapid clicks during fetch do nothing
  const _navBlocker = (() => {
    let el = null;
    return {
      show() {
        if (!el) { el = document.createElement('div'); el.style.cssText = 'position:fixed;inset:0;z-index:9990;cursor:wait;'; }
        document.body.appendChild(el);
      },
      hide() { if (el && el.parentNode) el.parentNode.removeChild(el); },
    };
  })();

  const navigateTo = async (href, pushState = true) => {
    if (_navLocked) return;          // ignore clicks while a nav is in flight
    _navLocked = true;

    const contentEl = document.querySelector("#razor-content");
    if (!contentEl) { _navLocked = false; location.href = href; return; }

    sessionStorage.setItem("razor-scroll:" + location.pathname, window.scrollY);

    // Show progress + block further clicks immediately
    _navBar.start();
    _navBlocker.show();

    // Mark clicked link as active right away and dim content to signal loading
    sidebarContainer.querySelectorAll("a[data-spa-link]").forEach(link => {
      link.classList.toggle("active", link.getAttribute("href") === href);
    });
    Array.from(contentEl.children).forEach(child => {
      if (child.id !== "razor-sidebar") {
        child.style.transition = "opacity 0.15s ease";
        child.style.opacity = "0.35";
        child.style.pointerEvents = "none";
      }
    });

    try {
      const res = await fetch(href, { headers: { "X-Razor-SPA": "1" } });
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, "text/html");
      const newContent = doc.querySelector("#razor-content");
      if (!newContent) throw new Error("no #razor-content");

      // Swap content — preserve sidebar
      const incoming = Array.from(newContent.childNodes).filter(
        n => !(n.nodeType === 1 && n.id === "razor-sidebar")
      );
      Array.from(contentEl.childNodes).forEach(n => {
        if (!(n.nodeType === 1 && n.id === "razor-sidebar")) n.remove();
      });

      // Adopt nodes, start invisible so we can fade them in
      const adopted = incoming.map(n => {
        const node = doc.adoptNode(n);
        if (node.nodeType === 1) { node.style.opacity = "0"; node.style.transition = "opacity 0.2s ease"; }
        return node;
      });
      adopted.forEach(n => contentEl.appendChild(n));

      if (pushState) history.pushState({ href }, "", href);
      const t = doc.querySelector("title");
      if (t) document.title = t.textContent;

      const s = sessionStorage.getItem("razor-scroll:" + href);
      window.scrollTo(0, s ? parseInt(s, 10) : 0);

      updateActiveLinks();

      // Execute incoming scripts
      newContent.querySelectorAll("script").forEach(old => {
        const n = document.createElement("script");
        [...old.attributes].forEach(a => n.setAttribute(a.name, a.value));
        n.textContent = old.textContent;
        document.body.appendChild(n).remove();
      });

      // Fade new content in on next frame
      requestAnimationFrame(() => {
        adopted.forEach(n => { if (n.nodeType === 1) n.style.opacity = "1"; });
      });

      closeSidebar();
      _navBar.done();
    } catch (err) {
      console.warn("[razor-sidebar] SPA nav failed:", err);
      _navBar.done();
      _navBlocker.hide();
      _navLocked = false;
      location.href = href;
      return;
    }

    _navBlocker.hide();
    setTimeout(() => { _navLocked = false; }, 80);  // tiny cooldown against double-fires
  };
  window.addEventListener("popstate", () => navigateTo(location.pathname, false));

  // Expose for hub bottom-tab navigation
  window.__razorNavigate = navigateTo;

  // ─── Build sidebar ────────────────────────────────────────────────────────
  const ARROW_SVG = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

  const buildSidebar = () => {
    const active = getActiveSection();

    const navHtml = NAV.map(item => {
      // Items with a top-level href bypass guild-scoped path
      const href     = item.href ? item.href : `/guild/${guildId}${item.path}`;
      const isTL     = !!item.href; // top-level (no guild prefix)
      const isActive = item.id === active ||
        (isTL && location.pathname.startsWith(item.href));
      const linkAttrs = isTL ? `href="${href}"` : `href="${href}" data-spa-link data-id="${item.id}"`;
      return `<a ${linkAttrs} class="rzr-nav-btn${isActive ? " active" : ""}"
          data-id="${item.id}"
          style="--rzr-btn-color:${item.color};--rzr-btn-bg:${item.bg};">
          <div class="rzr-btn-icon">${item.icon}</div>
          <span style="flex:1;">${item.name}</span>
          <span class="rzr-btn-arrow">${ARROW_SVG}</span>
        </a>`;
    }).join("");

    sidebarContainer.innerHTML = `
      <div class="rzr-header">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <a href="/servers" style="display:flex;align-items:center;gap:11px;" class="group">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1a1a2e,#000);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;color:rgba(156,163,175,1);flex-shrink:0;transition:all 0.2s;">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <div>
              <div style="font-weight:900;font-size:17px;color:white;letter-spacing:-0.02em;line-height:1.1;">RANKCORE</div>
              <div style="font-size:9px;color:rgba(107,114,128,1);font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">Dashboard</div>
            </div>
          </a>
          <button id="close-sidebar-btn" class="lg:hidden" aria-label="Close menu">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <div id="rzr-search">
        <div id="rzr-search-wrap">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input id="rzr-search-input" type="text" placeholder="Search features..." autocomplete="off" spellcheck="false">
          <button id="rzr-search-clear" aria-label="Clear">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div id="rzr-search-results"></div>
      </div>

      <nav class="rzr-nav">${navHtml}</nav>

      <div class="rzr-footer">
        <div id="rzr-premium-badge" style="margin-bottom:8px;"></div>
        <div id="rzr-owner-link" style="margin-bottom:8px;"></div>
        <a href="https://discord.gg/a9Kea3ymC7" target="_blank" rel="noopener"
          style="display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-radius:11px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);text-decoration:none;transition:border-color 0.2s;"
          class="group hover:border-razor/20">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;color:#8B5CF6;flex-shrink:0;">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;color:white;">Support</div>
              <div style="font-size:10px;color:rgba(107,114,128,1);">Get help</div>
            </div>
          </div>
          <svg width="13" height="13" class="text-gray-600 group-hover:text-white transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>
        </a>


        <div class="rzr-legal">
          <a href="/tos" class="rzr-legal-link" target="_blank" rel="noopener">
            <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Terms
          </a>
          <div class="rzr-legal-dot"></div>
          <a href="/privacy" class="rzr-legal-link" target="_blank" rel="noopener">
            <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Privacy
          </a>
          <div class="rzr-legal-dot"></div>
          <button class="rzr-legal-link" onclick="window.__noxxReviewConsent && window.__noxxReviewConsent()">
            <svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            Consent
          </button>
        </div>
      </div>
    `;

    document.getElementById("close-sidebar-btn")?.addEventListener("click", closeSidebar);

    sidebarContainer.querySelectorAll("a[data-spa-link]").forEach(link => {
      link.addEventListener("click", e => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigateTo(link.getAttribute("href"));
      });
    });
  };

  const updateActiveLinks = () => {
    const active = getActiveSection();
    sidebarContainer.querySelectorAll("a[data-spa-link]").forEach(link => {
      const isActive = link.dataset.id === active;
      link.className = `rzr-nav-btn${isActive ? " active" : ""}`;
    });
  };

  // ─── Mobile button ────────────────────────────────────────────────────────
  const mobileBtn = document.createElement("button");
  mobileBtn.id = "razor-mobile-btn";
  mobileBtn.setAttribute("aria-label", "Open navigation menu");
  mobileBtn.innerHTML = `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>`;
  mobileBtn.addEventListener("click", () => isOpen ? closeSidebar() : openSidebar());
  document.body.appendChild(mobileBtn);

  // ─── Swipe gestures ───────────────────────────────────────────────────────
  let tx = 0, ty = 0;
  sidebarContainer.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  sidebarContainer.addEventListener("touchend",   e => { if (e.changedTouches[0].clientX - tx < -60 && Math.abs(e.changedTouches[0].clientY - ty) < 80) closeSidebar(); }, { passive: true });
  document.addEventListener("touchstart", e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  document.addEventListener("touchend",   e => { if (!isOpen && tx < 20 && e.changedTouches[0].clientX - tx > 60 && Math.abs(e.changedTouches[0].clientY - ty) < 80) openSidebar(); }, { passive: true });

  // ─── Global search: function defs (no DOM queries) ─────────────────────────
  const HUBS = { moderation: '#f87171', community: '#34d399', staff: '#818cf8', tools: '#38bdf8', notifications: '#fbbf24', fun: '#f472b6', settings: '#a78bfa' };

  var searchInput, searchResults, searchClear;

  function runSearch() {
    var q = searchInput.value.toLowerCase().trim();
    if (!q) { searchResults.classList.remove('is-open'); searchClear.classList.remove('is-visible'); return; }
    searchClear.classList.add('is-visible');

    var matches = GLOBAL_SEARCH_INDEX.filter(function(item) {
      var haystack = (item.label + ' ' + item.keywords).toLowerCase();
      var terms = q.split(/\s+/);
      return terms.every(function(t) { return haystack.indexOf(t) !== -1; });
    });

    if (!matches.length) {
      searchResults.innerHTML = '<div class="rzr-sr-empty">No features found</div>';
      searchResults.classList.add('is-open');
      return;
    }

    searchResults.innerHTML = matches.slice(0, 10).map(function(item) {
      var href = '/guild/' + guildId + item.path;
      var color = HUBS[item.hub] || '#666';
      return '<a href="' + href + '" class="rzr-sr" data-spa-link>' +
        '<span class="rzr-sr-label">' + item.label + '</span>' +
        '<span class="rzr-sr-hub" style="background:' + color + '22;color:' + color + '">' + item.hub + '</span></a>';
    }).join('');
    searchResults.classList.add('is-open');

    searchResults.querySelectorAll('a[data-spa-link]').forEach(function(a) {
      a.addEventListener('click', function(e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        searchInput.value = '';
        searchResults.classList.remove('is-open');
        searchClear.classList.remove('is-visible');
        navigateTo(a.getAttribute('href'));
      });
    });
  }

  function initSearch() {
    searchInput = document.getElementById('rzr-search-input');
    searchResults = document.getElementById('rzr-search-results');
    searchClear = document.getElementById('rzr-search-clear');
    if (!searchInput || !searchResults || !searchClear) return;

    searchInput.addEventListener('input', runSearch);
    searchInput.addEventListener('focus', function() { if (searchInput.value.trim()) runSearch(); });
    searchClear.addEventListener('click', function() {
      searchInput.value = '';
      searchResults.classList.remove('is-open');
      searchClear.classList.remove('is-visible');
      searchInput.focus();
    });
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#rzr-search')) {
        searchResults.classList.remove('is-open');
      }
    });
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        searchResults.classList.remove('is-open');
        searchInput.blur();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        var first = searchResults.querySelector('.rzr-sr');
        if (first) first.focus();
      }
    });

    searchResults.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        var next = e.target.nextElementSibling;
        if (next && next.classList.contains('rzr-sr')) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        var prev = e.target.previousElementSibling;
        if (prev && prev.classList.contains('rzr-sr')) prev.focus();
        else searchInput.focus();
      }
      if (e.key === 'Escape') {
        searchResults.classList.remove('is-open');
        searchInput.focus();
      }
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  buildSidebar();
  initSearch();

  // Owner Panel link — only rendered for the bot owner (server enforces access too)
  (async () => {
    try {
      const res = await fetch('/api/me');
      if (!res.ok) return;
      const me = await res.json();
      if (!me?.isOwner) return;
      const el = document.getElementById('rzr-owner-link');
      if (!el) return;
      el.innerHTML = `<a href="/dev" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);text-decoration:none;transition:all 0.2s;">
        <div style="font-size:11px;font-weight:700;color:#f87171;">🛡️ Owner Panel</div>
        <div style="font-size:10px;color:rgba(100,116,139,0.8);">Open →</div>
      </a>`;
    } catch {}
  })();

  // Load premium tier badge into sidebar footer
  (async () => {
    try {
      const res  = await fetch('/api/premium/status');
      if (!res.ok) return;
      const data = await res.json();
      const u    = data?.user;
      if (!u) return;
      const el = document.getElementById('rzr-premium-badge');
      if (!el) return;

      const TIER_STYLES = {
        free:  { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.07)', color: '#64748b', label: 'Free Plan' },
        basic: { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)', color: '#60a5fa', label: '⭐ Basic' },
        pro:   { bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.3)',  color: '#c084fc', label: '💎 Pro' },
        elite: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  color: '#fbbf24', label: '👑 Elite' },
      };
      const tier  = u.tier ?? 'free';
      const style = TIER_STYLES[tier] ?? TIER_STYLES.free;
      const href  = u.isPremium ? '/premium' : '/premium';

  el.innerHTML = `<a href="${href}" style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;background:${style.bg};border:1px solid ${style.border};text-decoration:none;transition:all 0.2s;">
        <div style="font-size:11px;font-weight:700;color:${style.color};">${style.label}</div>
        <div style="font-size:10px;color:rgba(100,116,139,0.8);">${u.isPremium ? 'Manage →' : 'Upgrade →'}</div>
      </a>`;
    } catch {}
  })();
});

// ─── rzrPopulateChannels ──────────────────────────────────────────────────────
if (typeof window.rzrPopulateChannels !== 'function') {
  window.rzrPopulateChannels = function(selects, data, savedId, placeholder) {
    if (!Array.isArray(selects)) selects = [selects];
    selects = selects.map(function(s) {
      if (!s) return null;
      if (typeof s === 'string') return document.getElementById(s);
      return s;
    }).filter(Boolean);
    if (!selects.length) return;

    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    var channels, categories;
    if (Array.isArray(data)) { channels = data; categories = []; }
    else { channels = (data && data.channels) || []; categories = (data && data._categories) || []; }

    var html = (placeholder != null) ? '<option value="">' + esc(placeholder) + '</option>' : '';

    if (categories.length === 0) {
      html += channels.map(function(c) { return '<option value="' + esc(c.id) + '">#' + esc(c.name) + '</option>'; }).join('');
    } else {
      var byParent = {}, uncategorised = [];
      channels.forEach(function(ch) {
        if (ch.parentId) { if (!byParent[ch.parentId]) byParent[ch.parentId] = []; byParent[ch.parentId].push(ch); }
        else uncategorised.push(ch);
      });
      if (uncategorised.length) html += uncategorised.map(function(c) { return '<option value="' + esc(c.id) + '">#' + esc(c.name) + '</option>'; }).join('');
      categories.slice().sort(function(a,b) { return (a.rawPosition||0)-(b.rawPosition||0); }).forEach(function(cat) {
        var chs = byParent[cat.id];
        if (!chs || !chs.length) return;
        html += '<optgroup label="' + esc(cat.name.toUpperCase()) + '">';
        html += chs.map(function(c) { return '<option value="' + esc(c.id) + '">#' + esc(c.name) + '</option>'; }).join('');
        html += '</optgroup>';
      });
    }

    selects.forEach(function(sel) {
      var prev = sel.value;
      sel.innerHTML = html;
      var target = (savedId != null && savedId !== '') ? String(savedId) : prev;
      if (target) sel.value = target;
    });
  };
}