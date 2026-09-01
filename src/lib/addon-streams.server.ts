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
  return fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: {
      accept: "application/json,*/*",
      // Some add-on hosts sit behind bot protection that rejects blank agents.
      "user-agent": "WuHubHD/1.0 (+addon-client)",
    },
  });
}

/** Parses JSON defensively so bot-protection HTML yields a readable error. */
async function readJson<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (/^\s*</.test(text)) {
      throw new Error(`${label} returned a web page instead of data — endpoint is blocked or offline.`);
    }
    throw new Error(`${label} returned an unreadable response (${text.slice(0, 60).trim()}).`);
  }
}

async function loadManifest(addon: Addon): Promise<ManifestInfo> {
  const res = await timedFetch(addon.manifest);
  if (!res.ok) throw new Error(`Manifest returned HTTP ${res.status}`);
  const json = await readJson<{
    resources?: (string | { name: string })[];
    types?: string[];
    id?: string;
    name?: string;
  }>(res, "Manifest");
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
  if (!res.ok) throw new Error(`Stream endpoint returned HTTP ${res.status}`);
  const json = await readJson<{
    streams?: {
      name?: string;
      title?: string;
      description?: string;
      url?: string;
      infoHash?: string;
    }[];
  }>(res, "Stream endpoint");

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

/* ------------------------------------------------------------------ */
/* Playback-readiness verification                                      */
/* ------------------------------------------------------------------ */

export type StreamProbe = {
  addonId: string;
  addonName: string;
  quality: string;
  kind: StreamKindTag;
  kindLabel: string;
  url: string;
  /** true when the URL responded with playable media bytes. */
  playable: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: string | null;
  latencyMs: number;
  /** SPlayer deep link handed to the device for this source. */
  splayerUrl: string;
  splayerOk: boolean;
  error: string | null;
};

export type PlaybackCheck = {
  label: string;
  type: "movie" | "series";
  resolved: number;
  tried: number;
  resolveErrors: { addonId: string; addonName: string; message: string }[];
  probes: StreamProbe[];
  playableCount: number;
};

function splayerDeepLink(url: string, title: string) {
  return `splayer://play?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
}

/** Range-requests the first bytes of a resolved URL to prove it actually plays. */
async function probeStream(stream: AddonStream, title: string): Promise<StreamProbe> {
  const base = {
    addonId: stream.addonId,
    addonName: stream.addonName,
    quality: stream.quality,
    kind: stream.kind,
    kindLabel: stream.kindLabel,
    url: stream.url,
    splayerUrl: splayerDeepLink(stream.url, title),
  };

  if (stream.kind === "magnet") {
    // Magnets can't be range-probed; they are valid when the URI carries a hash.
    const ok = /^magnet:\?.*xt=urn:btih:[a-z0-9]{32,40}/i.test(stream.url);
    return {
      ...base,
      playable: false,
      status: null,
      contentType: null,
      contentLength: null,
      latencyMs: 0,
      splayerOk: ok,
      error: ok ? "Magnet — playback requires SPlayer or a debrid account." : "Malformed magnet URI (no info hash).",
    };
  }

  const started = Date.now();
  try {
    const res = await fetch(stream.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(ADDON_TIMEOUT_MS),
      headers: { range: "bytes=0-1023", "user-agent": "WuHubHD/1.0 (+playback-check)" },
    });
    const contentType = res.headers.get("content-type");
    const contentLength = res.headers.get("content-length");
    const okStatus = res.status === 200 || res.status === 206;
    const mediaish =
      !!contentType &&
      /(video|audio|octet-stream|mpegurl|matroska|mp4|dash\+xml)/i.test(contentType);
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    const playable = okStatus && mediaish;
    return {
      ...base,
      playable,
      status: res.status,
      contentType,
      contentLength,
      latencyMs: Date.now() - started,
      splayerOk: playable,
      error: playable
        ? null
        : !okStatus
          ? `Source answered HTTP ${res.status} — link is dead or expired.`
          : `Source returned "${contentType ?? "unknown"}" instead of media — likely an error page or a login wall.`,
    };
  } catch (e) {
    return {
      ...base,
      playable: false,
      status: null,
      contentType: null,
      contentLength: null,
      latencyMs: Date.now() - started,
      splayerOk: false,
      error:
        e instanceof Error && /timeout|abort/i.test(e.message)
          ? `No response within ${ADDON_TIMEOUT_MS / 1000}s — host unreachable or throttling.`
          : e instanceof Error
            ? e.message
            : "Unknown network failure.",
    };
  }
}

/** Resolves a reference title and playback-checks every URL that comes back. */
export async function verifyPlayback(input: {
  label: string;
  type: "movie" | "series";
  imdbId: string;
  tmdbId?: number;
  season?: number;
  episode?: number;
  limit?: number;
}): Promise<PlaybackCheck> {
  const resolved = await resolveAll({
    type: input.type,
    imdbId: input.imdbId,
    ...(input.tmdbId ? { tmdbId: input.tmdbId } : {}),
    ...(input.season != null ? { season: input.season } : {}),
    ...(input.episode != null ? { episode: input.episode } : {}),
  });

  const shortlist = resolved.streams.slice(0, input.limit ?? 10);
  const probes = await Promise.all(shortlist.map((s) => probeStream(s, input.label)));

  return {
    label: input.label,
    type: input.type,
    resolved: resolved.streams.length,
    tried: resolved.tried,
    resolveErrors: resolved.errors,
    probes,
    playableCount: probes.filter((p) => p.playable).length,
  };
}
