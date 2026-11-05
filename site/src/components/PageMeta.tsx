import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const routeTitles: Record<string, string> = {
  "/": "RankCore | Home",
  "/commands": "RankCore | Commands",
  "/features": "RankCore | Features",
  "/partners": "RankCore | Partners",
  "/news": "RankCore | News",
  "/devs": "RankCore | Devs",
  "/status": "RankCore | Status",
  "/stats": "RankCore | Stats",
  "/uptime": "RankCore | Uptime",
  "/premium": "RankCore | Premium",
  "/faq": "RankCore | FAQ",
  "/docs": "RankCore | Docs",
  "/privacy": "RankCore | Privacy",
  "/terms": "RankCore | Terms",
};

const SITE_DESC = "RankCore — an all-in-one Discord bot: moderation, automod, tickets, music, leveling and a full web dashboard.";

const getSiteUrl = (pathname: string) => `${window.location.origin}${pathname}`;

const getOgImageUrl = () => `${window.location.origin}/og-image.png`;

const updateMeta = (property: string, content: string) => {
  const selectors = [
    `meta[property="${property}"]`,
    `meta[name="${property}"]`,
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      el.setAttribute("content", content);
      return;
    }
  }
  // Create if missing
  const meta = document.createElement("meta");
  if (property.startsWith("og:")) {
    meta.setAttribute("property", property);
  } else {
    meta.setAttribute("name", property);
  }
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
};

const updateCanonical = (href: string) => {
  let link = document.querySelector('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
};

const PageMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const title = routeTitles[pathname] || "RankCore Bot";
    const pageUrl = getSiteUrl(pathname);
    const ogImageUrl = getOgImageUrl();

    document.title = title;

    updateMeta("og:title", title);
    updateMeta("twitter:title", title);
    updateMeta("og:description", SITE_DESC);
    updateMeta("twitter:description", SITE_DESC);
    updateMeta("og:image", ogImageUrl);
    updateMeta("twitter:image", ogImageUrl);
    updateMeta("og:url", pageUrl);
    updateCanonical(pageUrl);
  }, [pathname]);

  return null;
};

export default PageMeta;
