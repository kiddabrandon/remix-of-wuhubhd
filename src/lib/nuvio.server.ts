// Server-side loader/runner for Nuvio provider packs.
//
// A Nuvio pack manifest lists `scrapers`, each pointing at a CommonJS provider
// script that exports `getStreams(tmdbId, type, season, episode)`. We fetch and
// evaluate those scripts here so users never have to install the Nuvio app.

import * as cheerio from "cheerio";
import { ADDON_TIMEOUT_MS } from "@/lib/addon-types";

export type NuvioScraper = {
  id: string;
  name: string;
  filename: string;
  enabled?: boolean;
  supportedTypes?: string[];
};

export type NuvioPack = {
  name: string;
  scrapers: NuvioScraper[];
};

export type NuvioStream = {
  name?: string;
  title?: string;
  url?: string;
  quality?: string;
  size?: string | number;
};

type ScraperModule = {
  getStreams?: (
    tmdbId: string | number,
    type: string,
    season?: number,
    episode?: number,
  ) => Promise<NuvioStream[]>;
};

const packCache = new Map<string, Promise<NuvioPack>>();
const moduleCache = new Map<string, Promise<ScraperModule>>();

function timedFetch(url: string, ms = ADDON_TIMEOUT_MS) {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

export function fetchNuvioPack(manifestUrl: string): Promise<NuvioPack> {
  const cached = packCache.get(manifestUrl);
  if (cached) return cached;

  const promise = (async (): Promise<NuvioPack> => {
    const res = await timedFetch(manifestUrl);
    if (!res.ok) throw new Error(`Manifest returned HTTP ${res.status}`);
    const json = (await res.json()) as Partial<NuvioPack>;
    if (!Array.isArray(json.scrapers)) throw new Error("Manifest has no `scrapers` list");
    return { name: json.name ?? "Nuvio pack", scrapers: json.scrapers };
  })();

  packCache.set(manifestUrl, promise);
  promise.catch(() => packCache.delete(manifestUrl));
  return promise;
}

function requireShim(name: string): unknown {
  if (name.includes("cheerio")) return cheerio;
  if (name === "crypto" || name === "node:crypto") return globalThis.crypto;
  throw new Error(`Provider requires unsupported module "${name}"`);
}

function loadScraper(scriptUrl: string): Promise<ScraperModule> {
  const cached = moduleCache.get(scriptUrl);
  if (cached) return cached;

  const promise = (async (): Promise<ScraperModule> => {
    const res = await timedFetch(scriptUrl, 8_000);
    if (!res.ok) throw new Error(`Provider script returned HTTP ${res.status}`);
    const code = await res.text();
    const module_ = { exports: {} as ScraperModule };
    let factory: (...args: unknown[]) => unknown;
    try {
      // eslint-disable-next-line no-new-func
      factory = new Function("require", "module", "exports", "console", code) as never;
    } catch {
      throw new Error(
        "This runtime blocks dynamic provider scripts, so Nuvio packs can't run here.",
      );
    }
    factory(requireShim, module_, module_.exports, console);
    return module_.exports;
  })();

  moduleCache.set(scriptUrl, promise);
  promise.catch(() => moduleCache.delete(scriptUrl));
  return promise;
}

function scriptUrlFor(manifestUrl: string, filename: string) {
  return manifestUrl.replace(/\/manifest\.json$/, "") + "/" + filename.replace(/^\.?\//, "");
}

/** Runs every enabled scraper in a pack and returns whatever links resolve. */
export async function resolveNuvioPackStreams(
  manifestUrl: string,
  tmdbId: string | number,
  type: "movie" | "tv",
  season?: number,
  episode?: number,
): Promise<{ scraperName: string; streams: NuvioStream[] }[]> {
  const pack = await fetchNuvioPack(manifestUrl);
  const scrapers = pack.scrapers
    .filter((s) => s.enabled !== false)
    .filter((s) => !s.supportedTypes || s.supportedTypes.includes(type))
    .slice(0, 12);

  const results = await Promise.allSettled(
    scrapers.map(async (s) => {
      const mod = await loadScraper(scriptUrlFor(manifestUrl, s.filename));
      if (typeof mod.getStreams !== "function") throw new Error("no getStreams export");
      const streams = await Promise.race([
        mod.getStreams(tmdbId, type, season, episode),
        new Promise<NuvioStream[]>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ADDON_TIMEOUT_MS),
        ),
      ]);
      return { scraperName: s.name, streams: Array.isArray(streams) ? streams : [] };
    }),
  );

  return results.flatMap((r) => (r.status === "fulfilled" && r.value.streams.length ? [r.value] : []));
}
