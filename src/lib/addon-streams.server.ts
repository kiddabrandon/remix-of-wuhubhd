// Server-side add-on resolution: Stremio stream endpoints + Nuvio provider packs.

import { ALL_ADDONS, STREMIO_ADDONS, NUVIO_PLUGINS, type Addon } from "@/lib/addons";
import {
  ADDON_TIMEOUT_MS,
  type AddonStatus,
  type AddonStatusReport,
  type AddonStream,
  type ResolveAllResult,
  type StreamKindTag,
} from "@/lib/addon-types";
import { resolveNuvioPackStreams } from "@/lib/nuvio.server";

type ManifestInfo = {
  isStremioManifest: boolean;
  resources: string[];
  types: string[];
  name?: string;
};

const manifestCache = new Map<string, Promise<ManifestInfo>>();

function timedFetch(url: string, ms = ADDON_TIMEOUT_MS) {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}

async function loadManifest(addon: Addon): Promise<ManifestInfo> {
  const res = await timedFetch(addon.manifest);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    resources?: (string | { name: string })[];
    types?: string[];
    id?: string;
    name?: string;
  };
  const isStremioManifest =
    Array.isArray(json.resources) && Array.isArray(json.types) && typeof json.id === "string";
  return {
    isStremioManifest,
    resources: (json.resources ?? []).map((r) => (typeof r === "string" ? r : r.name)),
    types: json.types ?? [],
    name: json.name,
  };
}

function cachedManifest(addon: Addon): Promise<ManifestInfo> {
  const cached = manifestCache.get(addon.id);
  if (cached) return cached;
  const promise = loadManifest(addon);
  manifestCache.set(addon.id, promise);
  promise.catch(() => manifestCache.delete(addon.id));
  return promise;
}

async function canResolveStreams(addon: Addon): Promise<boolean> {
  if (addon.platform !== "stremio") return false;
  try {
    const info = await cachedManifest(addon);
    if (info.isStremioManifest) return info.resources.includes("stream");
  } catch {
    /* fall through to the static hint */
  }
  return addon.streamKind === "http";
}

const DEBRID_HOSTS =
  /(real-debrid|rdeb|alldebrid|premiumize|debrid-link|debridlink|torbox|offcloud|put\.io|easydebrid)/i;

export function classifyStream(url: string): { kind: StreamKindTag; kindLabel: string } {
  if (/^magnet:/i.test(url)) return { kind: "magnet", kindLabel: "Magnet / torrent" };
  if (DEBRID_HOSTS.test(url)) {
    const host = url.match(DEBRID_HOSTS)?.[1] ?? "debrid";
    return { kind: "debrid", kindLabel: `Debrid (${host})` };
  }
  if (/\.m3u8(\?|$)/i.test(url)) return { kind: "direct", kindLabel: "Direct HLS" };
  return { kind: "direct", kindLabel: "Direct stream" };
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

function magnetFromInfoHash(infoHash: string, name: string) {
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`;
}

export async function fetchStremioStreams(
  addon: Addon,
  id: string,
  type: "movie" | "series",
): Promise<AddonStream[]> {
  const base = addon.manifest.replace(/\/manifest\.json$/, "");
  const res = await timedFetch(`${base}/stream/${type}/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    streams?: {
      name?: string;
      title?: string;
      description?: string;
      url?: string;
      infoHash?: string;
    }[];
  };

  return (json.streams ?? [])
    .map((s) => {
      const text = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
      const name = s.name?.trim() || addon.name;
      const url =
        s.url && /^https?:\/\//i.test(s.url)
          ? s.url
          : s.infoHash
            ? magnetFromInfoHash(s.infoHash, name)
            : null;
      if (!url) return null;
      const { kind, kindLabel } = classifyStream(url);
      return {
        name,
        description: (s.title || s.description || "").trim().slice(0, 140),
        url,
        addonId: addon.id,
        addonName: addon.name,
        quality: inferQuality(text).label,
        size: inferSize(text),
        kind,
        kindLabel,
      } satisfies AddonStream;
    })
    .filter((s): s is AddonStream => s !== null);
}

async function fetchNuvioStreams(
  addon: Addon,
  tmdbId: string | number,
  type: "movie" | "tv",
  season?: number,
  episode?: number,
): Promise<AddonStream[]> {
  const packs = await resolveNuvioPackStreams(addon.manifest, tmdbId, type, season, episode);
  return packs.flatMap((p) =>
    p.streams
      .filter((s) => typeof s.url === "string" && s.url.length > 0)
      .map((s) => {
        const url = s.url as string;
        const text = `${s.name ?? ""} ${s.title ?? ""} ${s.quality ?? ""}`;
        const { kind, kindLabel } = classifyStream(url);
        return {
          name: s.name?.trim() || p.scraperName,
          description: (s.title ?? "").toString().trim().slice(0, 140),
          url,
          addonId: addon.id,
          addonName: `${addon.name} · ${p.scraperName}`,
          quality: s.quality || inferQuality(text).label,
          size: typeof s.size === "string" ? s.size : inferSize(text),
          kind,
          kindLabel,
        } satisfies AddonStream;
      }),
  );
}

export async function resolveAll(input: {
  type: "movie" | "series";
  imdbId: string;
  tmdbId?: number;
  season?: number;
  episode?: number;
}): Promise<ResolveAllResult> {
  const stremioId =
    input.type === "series" && input.season != null && input.episode != null
      ? `${input.imdbId}:${input.season}:${input.episode}`
      : input.imdbId;

  const candidates = STREMIO_ADDONS;
  const capabilities = await Promise.all(candidates.map((a) => canResolveStreams(a)));
  const tryable = candidates.filter((_, i) => capabilities[i]);

  const nuvioTargets = input.tmdbId ? NUVIO_PLUGINS : [];
  const errors: ResolveAllResult["errors"] = [];

  const [stremioSettled, nuvioSettled] = await Promise.all([
    Promise.allSettled(tryable.map((a) => fetchStremioStreams(a, stremioId, input.type))),
    Promise.allSettled(
      nuvioTargets.map((a) =>
        fetchNuvioStreams(
          a,
          input.tmdbId as number,
          input.type === "series" ? "tv" : "movie",
          input.season,
          input.episode,
        ),
      ),
    ),
  ]);

  const all: AddonStream[] = [];
  const collect = (settled: PromiseSettledResult<AddonStream[]>[], addons: Addon[]) =>
    settled.forEach((result, i) => {
      const addon = addons[i];
      if (result.status === "fulfilled") all.push(...result.value);
      else
        errors.push({
          addonId: addon.id,
          addonName: addon.name,
          message: result.reason instanceof Error ? result.reason.message : "Failed to resolve",
        });
    });

  collect(stremioSettled, tryable);
  collect(nuvioSettled, nuvioTargets);

  const seen = new Set<string>();
  const deduped = all.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));

  const kindRank: Record<StreamKindTag, number> = { direct: 2, debrid: 1, magnet: 0 };
  deduped.sort((a, b) => {
    const k = kindRank[b.kind] - kindRank[a.kind];
    if (k !== 0) return k;
    return inferQuality(`${b.quality} ${b.name}`).rank - inferQuality(`${a.quality} ${a.name}`).rank;
  });

  return { streams: deduped.slice(0, 60), tried: tryable.length + nuvioTargets.length, errors };
}

/** Health-checks every bundled add-on/pack so the UI can show a status panel. */
export async function checkAllAddons(): Promise<AddonStatusReport> {
  const statuses = await Promise.all(
    ALL_ADDONS.map(async (addon): Promise<AddonStatus> => {
      const started = Date.now();
      try {
        if (addon.platform === "nuvio") {
          const { fetchNuvioPack } = await import("@/lib/nuvio.server");
          const pack = await fetchNuvioPack(addon.manifest);
          const enabled = pack.scrapers.filter((s) => s.enabled !== false).length;
          if (enabled === 0) throw new Error("Pack has no enabled providers");
          return {
            id: addon.id,
            name: addon.name,
            platform: addon.platform,
            ok: true,
            latencyMs: Date.now() - started,
            canStream: true,
            providers: enabled,
            error: null,
          };
        }
        const info = await cachedManifest(addon);
        return {
          id: addon.id,
          name: info.name || addon.name,
          platform: addon.platform,
          ok: true,
          latencyMs: Date.now() - started,
          canStream: info.isStremioManifest
            ? info.resources.includes("stream")
            : addon.streamKind === "http",
          error: null,
        };
      } catch (e) {
        const raw = e instanceof Error ? e.message : "Unknown error";
        const message = /timeout|aborted|timed out/i.test(raw)
          ? `Timed out after ${ADDON_TIMEOUT_MS / 1000}s — endpoint is slow or offline.`
          : raw;
        return {
          id: addon.id,
          name: addon.name,
          platform: addon.platform,
          ok: false,
          latencyMs: Date.now() - started,
          canStream: false,
          error: message,
        };
      }
    }),
  );

  return {
    checkedAt: new Date().toISOString(),
    total: statuses.length,
    okCount: statuses.filter((s) => s.ok).length,
    failed: statuses.filter((s) => !s.ok),
    statuses,
  };
}
