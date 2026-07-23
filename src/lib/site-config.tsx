import { useSyncExternalStore } from "react";
import { getSiteConfig } from "@/lib/site-config.functions";

export const DEFAULT_HOME_SECTIONS = [
  { id: "continue", label: "Continue Watching", enabled: true },
  { id: "tonight", label: "Tonight's Pick", enabled: true },
  { id: "because", label: "Because You Watched", enabled: true },
  { id: "top10", label: "Top 10", enabled: true },
  { id: "trending", label: "Trending Now", enabled: true },
  { id: "popularMovies", label: "Popular Movies", enabled: true },
  { id: "topTv", label: "Top Rated TV", enabled: true },
  { id: "topMovies", label: "Top Rated Movies", enabled: true },
  { id: "popularTv", label: "Popular TV Shows", enabled: true },
] as const;

export type HomeSectionConfig = {
  id: (typeof DEFAULT_HOME_SECTIONS)[number]["id"];
  label?: string;
  enabled: boolean;
};

export type SiteConfig = {
  serverOrder?: string[];
  animeProviders?: string[];
  homeSections?: HomeSectionConfig[];
  tmdbRegion?: string;
  featuredCollection?: string;
  [k: string]: unknown;
};

const EVENT = "cinehub:site-config-change";

// Cache the parsed object so useSyncExternalStore snapshots are referentially
// stable between renders (React would otherwise throw "getSnapshot should be
// cached").
let cached: SiteConfig = {};

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  return () => {
    window.removeEventListener(EVENT, handler);
  };
}

const serverSnapshot: SiteConfig = {};

export function useSiteConfig(): SiteConfig {
  return useSyncExternalStore(subscribe, () => cached, () => serverSnapshot);
}

function writeCache(cfg: SiteConfig) {
  if (typeof window === "undefined") return;
  cached = cfg;
  window.dispatchEvent(new Event(EVENT));
}

/** Update local cache immediately (used by admin panel after saving). */
export function saveSiteConfigLocal(cfg: SiteConfig) {
  writeCache(cfg);
}

export function loadSiteConfigLocal(): SiteConfig {
  return cached;
}

/**
 * Fetches shared config from the database and writes it into the local cache
 * so admin-set changes propagate to every account. Runs once per session.
 */
export async function hydrateSiteConfigFromServer() {
  if (typeof window === "undefined") return;
  try {
    const r = await getSiteConfig();
    const remote = (typeof (r as { json?: unknown }).json === "string"
      ? JSON.parse((r as { json: string }).json)
      : r) as SiteConfig;
    writeCache(remote && Object.keys(remote).length > 0 ? remote : {});
  } catch {
    /* ignore network errors — in-memory defaults remain authoritative */
  }
}
