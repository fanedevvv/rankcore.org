import { useEffect, useState } from "react";
import { API_BASE } from "@/config/site";
import { news as fallbackNews, type NewsItem } from "@/data/news";

interface ApiChangelog {
  id: string;
  title: string | null;
  date: string | null;
  type: string | null;
  description: string;
}

// Changelog types used by the owner panel → label + color
export const NEWS_TAGS: Record<string, { label: string; color: string }> = {
  new:      { label: "New",      color: "#22c55e" },
  improved: { label: "Improved", color: "#3b82f6" },
  fixed:    { label: "Fixed",    color: "#14b8a6" },
  removed:  { label: "Removed",  color: "#94a3b8" },
  update:   { label: "Update",   color: "#ef4444" },
  security: { label: "Security", color: "#f59e0b" },
  premium:  { label: "Premium",  color: "#c084fc" },
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

/** Changelogs published from the owner panel; falls back to the static list if the bot is unreachable. */
export function useNews(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>(fallbackNews);

  useEffect(() => {
    fetch(`${API_BASE}/changelogs`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const list: NewsItem[] = (data?.changelogs ?? []).map((c: ApiChangelog) => ({
          id: c.id,
          title: c.title || "RankCore Update",
          date: formatDate(c.date),
          tag: c.type ?? undefined,
          description: c.description,
        }));
        if (list.length) setItems(list);
      })
      .catch(() => {});
  }, []);

  return items;
}
