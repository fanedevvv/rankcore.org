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

  // ─── Nav items — 5 main buttons ───────────────────────────────────────────
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
      id: "tools",
      name: "Tools",
      path: "/hub/tools",
      color: "#38bdf8",
      bg: "rgba(56,189,248,0.12)",
      icon: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
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
    "/advanced-automod": "moderation", "/antiscam": "moderation",
    // community hub
    "/welcome": "community", "/goodbye": "community", "/booster": "community",
    "/leveling": "community", "/reactionrole": "community", "/giveaway": "community",
    "/jtc": "community", "/suggestions": "community", "/counting": "community",
    "/confession": "community", "/invite-config": "community",
    "/uwulock": "community", "/catlock": "community", "/guessthenumber": "community", "/qotd": "community",
    "/music": "community",
    // tools hub
    "/ticket": "tools", "/modmail": "tools", "/autoresponder": "tools",
    "/staffapps": "tools", "/embed": "tools", "/sticky": "tools",
    "/uptime": "tools", "/youtube": "tools", "/twitch": "tools", "/ai": "tools",
    // settings hub
    "/prefix": "settings", "/commands": "settings", "/dashboard-roles": "settings",
    "/global-perm": "settings", "/customcommands": "settings",
    "/custombranding": "settings", "/christmas": "settings", "/halloween": "settings",
    "/errors": "settings", "/autorole": "settings",
  };

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
        z-index: 40;
        transform: translateX(-100%);
        transition: transform 0.26s cubic-bezier(0.4,0,0.2,1);
        will-change: transform;
        padding-left: env(safe-area-inset-left, 0);
      }
      @media (min-width: 1024px) {
        #razor-sidebar { position: sticky; transform: translateX(0) !important; flex-shrink: 0; height: 100vh; height: 100dvh; }
        #razor-mobile-btn { display: none !important; }
        #razor-overlay    { display: none !important; }
      }
      #razor-sidebar.is-open { transform: translateX(0); }

      #razor-sidebar .rzr-header {
        padding: max(20px, env(safe-area-inset-top, 20px)) 16px 14px 18px;
        flex-shrink: 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      #razor-sidebar .rzr-nav {
        flex: 1; display: flex; flex-direction: column;
        padding: 16px 12px; gap: 6px;
        overflow: hidden; /* no scroll needed — 5 items always fit */
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
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        z-index: 39; opacity: 0; pointer-events: none;
        transition: opacity 0.26s ease;
      }
      #razor-overlay.is-open { opacity: 1; pointer-events: auto; }

      /* Mobile btn */
      #razor-mobile-btn {
        position: fixed;
        top: max(16px, env(safe-area-inset-top, 16px));
        left: max(16px, env(safe-area-inset-left, 16px));
        z-index: 50; padding: 10px; border-radius: 12px;
        background: rgba(9,9,11,0.88); backdrop-filter: blur(12px);
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

      body.razor-sidebar-open { overflow: hidden; position: fixed; width: 100%; }
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
  const navigateTo = async (href, pushState = true) => {
    const contentEl = document.querySelector("#razor-content");
    if (!contentEl) { location.href = href; return; }

    sessionStorage.setItem("razor-scroll:" + location.pathname, window.scrollY);

    try {
      const res = await fetch(href, { headers: { "X-Razor-SPA": "1" } });
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();
      const doc  = new DOMParser().parseFromString(html, "text/html");
      const newContent = doc.querySelector("#razor-content");
      if (!newContent) { location.href = href; return; }

      // Preserve the sidebar element — only swap non-sidebar children
      const incoming = Array.from(newContent.childNodes).filter(
        n => !(n.nodeType === 1 && n.id === "razor-sidebar")
      );
      Array.from(contentEl.childNodes).forEach(n => {
        if (!(n.nodeType === 1 && n.id === "razor-sidebar")) n.remove();
      });
      incoming.forEach(n => contentEl.appendChild(doc.adoptNode(n)));
      if (pushState) history.pushState({ href }, "", href);

      const t = doc.querySelector("title");
      if (t) document.title = t.textContent;

      const s = sessionStorage.getItem("razor-scroll:" + href);
      window.scrollTo(0, s ? parseInt(s, 10) : 0);

      updateActiveLinks();

      newContent.querySelectorAll("script").forEach(old => {
        const n = document.createElement("script");
        [...old.attributes].forEach(a => n.setAttribute(a.name, a.value));
        n.textContent = old.textContent;
        document.body.appendChild(n).remove();
      });

      closeSidebar();
    } catch (err) {
      console.warn("[razor-sidebar] SPA nav failed:", err);
      location.href = href;
    }
  };
  window.addEventListener("popstate", () => navigateTo(location.pathname, false));

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

        <a href="https://top.gg/bot/960624234688811188" target="_blank" rel="noopener"
          style="display:flex;align-items:center;justify-content:space-between;padding:11px 12px;margin-top:8px;border-radius:11px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);text-decoration:none;transition:border-color 0.2s;"
          class="group hover:border-razor/20">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;color:#8B5CF6;flex-shrink:0;">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <div>
              <div style="font-size:12px;font-weight:700;color:white;">Vote on Top.gg</div>
              <div style="font-size:10px;color:rgba(107,114,128,1);">Support RankCore</div>
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

  // ─── Init ─────────────────────────────────────────────────────────────────
  buildSidebar();

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