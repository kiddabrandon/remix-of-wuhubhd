import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ALL_ADDONS, type Addon } from "@/lib/addons";

const ResolveOneSchema = z.object({
  addonId: z.string().min(1).max(60),
  type: z.enum(["movie", "series"]),
  imdbId: z.string().regex(/^tt\d+$/),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(0).max(2000).optional(),
});

const ResolveAllSchema = z.object({
  type: z.enum(["movie", "series"]),
  imdbId: z.string().regex(/^tt\d+$/),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(0).max(2000).optional(),
});

export type AddonStream = {
  name: string;
  description: string;
  url: string;
  addonId: string;
  addonName: string;
  quality: string;
  size: string | null;
};

export type AddonResolveResult = {
  streams: AddonStream[];
  /** Set when nothing playable could be resolved — shown as troubleshooting text. */
  error: string | null;
};

export type ResolveAllResult = {
  streams: AddonStream[];
  tried: number;
  errors: { addonId: string; addonName: string; message: string }[];
};

type ManifestInfo = {
  isStremioManifest: boolean;
  resources: string[];
  types: string[];
};

// Cached for the lifetime of the server process — manifests rarely change.
const manifestCache = new Map<string, Promise<ManifestInfo>>();

function fetchManifest(addon: Addon): Promise<ManifestInfo> {
  const cached = manifestCache.get(addon.id);
  if (cached) return cached;

  const promise = (async (): Promise<ManifestInfo> => {
    try {
      const res = await fetch(addon.manifest, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as {
        resources?: (string | { name: string })[];
        types?: string[];
        id?: string;
      };
      // Nuvio raw-GitHub provider packs ship a custom JSON shape, not a real
      // Stremio manifest — they have no `resources`/`types`/`id` triplet.
      const isStremioManifest =
        Array.isArray(json.resources) && Array.isArray(json.types) && typeof json.id === "string";
      const resources = (json.resources ?? []).map((r) => (typeof r === "string" ? r : r.name));
      return { isStremioManifest, resources, types: json.types ?? [] };
    } catch {
      return { isStremioManifest: false, resources: [], types: [] };
    }
  })();

  manifestCache.set(addon.id, promise);
  return promise;
}

async function canResolveStreams(addon: Addon): Promise<boolean> {
  if (addon.platform !== "stremio") {
    // Nuvio provider packs aren't Stremio manifests — skip resolution, but
    // they still surface in the list for the "Advanced" section.
    return false;
  }
  const info = await fetchManifest(addon);
  if (info.isStremioManifest) return info.resources.includes("stream");
  // Manifest fetch failed or wasn't recognisable — fall back to the static hint.
  return addon.streamKind === "http";
}

function looksPlayable(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  return /\.(m3u8|mp4|mkv)(\?|$)/i.test(url) || /^https?:\/\//i.test(url);
}

function inferQuality(text: string): { rank: number; label: string } {
  const t = text.toLowerCase();
  if (/\b(4k|2160p)\b/.test(t)) return { rank: 4, label: "4K" };
  if (/\b1080p?\b/.test(t)) return { rank: 3, label: "1080p" };
  if (/\b720p?\b/.test(t)) return { rank: 2, label: "720p" };
  if (/\b480p?\b/.test(t)) return { rank: 1, label: "480p" };
  return { rank: 0, label: "SD" };
}

function inferSize(text: string): string | null {
  const m = text.match(/([\d.]+\s?(?:GB|MB))/i);
  return m ? m[1].toUpperCase() : null;
}

async function fetchAddonStreams(addon: Addon, id: string, type: "movie" | "series"): Promise<AddonStream[]> {
  const base = addon.manifest.replace(/\/manifest\.json$/, "");
  const res = await fetch(`${base}/stream/${type}/${encodeURIComponent(id)}.json`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const json = (await res.json()) as {
    streams?: { name?: string; title?: string; description?: string; url?: string; infoHash?: string }[];
  };
  return (json.streams ?? [])
    .filter((s) => typeof s.url === "string" && looksPlayable(s.url))
    .map((s) => {
      const text = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
      const { label } = inferQuality(text);
      return {
        name: s.name?.trim() || addon.name,
        description: (s.title || s.description || "").trim().slice(0, 140),
        url: s.url as string,
        addonId: addon.id,
        addonName: addon.name,
        quality: label,
        size: inferSize(text),
      };
    });
}

/**
 * Queries a single Stremio add-on's public stream endpoint and keeps only
 * entries with a direct HTTP/HLS url. Magnet-only results are dropped.
 */
export const resolveAddonStreams = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ResolveOneSchema.parse(d))
  .handler(async ({ data }): Promise<AddonResolveResult> => {
    const addon = ALL_ADDONS.find((a) => a.id === data.addonId);
    if (!addon) return { streams: [], error: "Unknown add-on." };

    const capable = await canResolveStreams(addon);
    if (!capable) {
      return {
        streams: [],
        error: "This add-on doesn't expose browser-playable streams for this title.",
      };
    }

    const id =
      data.type === "series" && data.season != null && data.episode != null
        ? `${data.imdbId}:${data.season}:${data.episode}`
        : data.imdbId;

    try {
      const streams = (await fetchAddonStreams(addon, id, data.type)).slice(0, 20);
      if (streams.length === 0) {
        return { streams: [], error: "No browser-playable link found for this title yet." };
      }
      return { streams, error: null };
    } catch {
      return { streams: [], error: "The add-on didn't respond in time. Try again or use another server." };
    }
  });

/**
 * Fans out across every add-on that can plausibly resolve streams for this
 * title, in parallel, and returns a de-duplicated, quality-sorted list.
 * This is the "installer" — no Stremio/Nuvio app is required.
 */
export const resolveAllAddonStreams = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ResolveAllSchema.parse(d))
  .handler(async ({ data }): Promise<ResolveAllResult> => {
    const id =
      data.type === "series" && data.season != null && data.episode != null
        ? `${data.imdbId}:${data.season}:${data.episode}`
        : data.imdbId;

    const candidates = ALL_ADDONS.filter((a) => a.platform === "stremio");
    const capabilities = await Promise.all(candidates.map((a) => canResolveStreams(a)));
    const tryable = candidates.filter((_, i) => capabilities[i]);

    const errors: { addonId: string; addonName: string; message: string }[] = [];
    const settled = await Promise.allSettled(tryable.map((a) => fetchAddonStreams(a, id, data.type)));

    const all: AddonStream[] = [];
    settled.forEach((result, i) => {
      const addon = tryable[i];
      if (result.status === "fulfilled") {
        all.push(...result.value);
      } else {
        errors.push({
          addonId: addon.id,
          addonName: addon.name,
          message: result.reason instanceof Error ? result.reason.message : "Failed to resolve",
        });
      }
    });

    const seen = new Set<string>();
    const deduped = all.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });

    deduped.sort((a, b) => inferQuality(`${a.quality} ${a.name}`).rank - inferQuality(`${b.quality} ${b.name}`).rank);
    deduped.reverse();

    return { streams: deduped.slice(0, 40), tried: tryable.length, errors };
  });
