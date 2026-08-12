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

export type ProviderCheck = {
  id: string;
  name: string;
  ok: boolean;
  error: string | null;
};

export type PackVerification = {
  packId: string;
  packName: string;
  manifest: string;
  manifestOk: boolean;
  declared: number;
  loaded: number;
  failed: number;
  durationMs: number;
  error: string | null;
  providers: ProviderCheck[];
};

/**
 * End-to-end check of a Nuvio pack: manifest fetch, then every declared
 * provider script is downloaded and evaluated, reporting per-provider errors.
 */
export async function verifyNuvioPack(
  packId: string,
  packName: string,
  manifestUrl: string,
): Promise<PackVerification> {
  const started = Date.now();
  const base: PackVerification = {
    packId,
    packName,
    manifest: manifestUrl,
    manifestOk: false,
    declared: 0,
    loaded: 0,
    failed: 0,
    durationMs: 0,
    error: null,
    providers: [],
  };

  let pack: NuvioPack;
  try {
    pack = await fetchNuvioPack(manifestUrl);
  } catch (e) {
    return {
      ...base,
      durationMs: Date.now() - started,
      error: e instanceof Error ? e.message : "Manifest could not be read.",
    };
  }

  const scrapers = pack.scrapers.filter((s) => s.enabled !== false);
  const checks = await Promise.all(
    scrapers.map(async (s): Promise<ProviderCheck> => {
      try {
        const mod = await loadScraper(scriptUrlFor(manifestUrl, s.filename));
        if (typeof mod.getStreams !== "function") {
          return { id: s.id, name: s.name, ok: false, error: "Script loaded but exports no getStreams()." };
        }
        return { id: s.id, name: s.name, ok: true, error: null };
      } catch (e) {
        return {
          id: s.id,
          name: s.name,
          ok: false,
          error: e instanceof Error ? e.message : "Provider script failed to load.",
        };
      }
    }),
  );

  const loaded = checks.filter((c) => c.ok).length;
  return {
    packId,
    packName,
    manifest: manifestUrl,
    manifestOk: true,
    declared: pack.scrapers.length,
    loaded,
    failed: checks.length - loaded,
    durationMs: Date.now() - started,
    error: null,
    providers: checks,
  };
}
