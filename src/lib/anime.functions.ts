// Anime streaming backend.
//
// The old HiAnime scraper (hianime.to) and every public Consumet mirror are
// dead/unreachable from the runtime, so episodes and direct streams now come
// from the Miruro API (https://api.hiyori.tv), which is keyed by AniList id and
// returns full sub+dub episode lists and playable HLS streams. AniList-keyed
// embed providers (Videasy, Megaplay, Vidplay, Vidsrc) stay unchanged — they
// need no episode discovery.
import { createServerFn } from "@tanstack/react-start";

export type { AnimeItem } from "@/lib/anilist";

const MIRURO_BASE = "https://api.hiyori.tv";

export type AnimeEpisode = {
  id: string;
  number: number;
  title: string | null;
  image: string | null;
};

export type AnimeStreamSource = {
  url: string;
  quality: string;
  isM3U8: boolean;
};

/** Providers resolved through the Miruro API (HiAnime-compatible catalogue). */
const MIRURO_PROVIDERS = ["hianime", "miruro", "animepahe"] as string[];

function isMiruroProvider(provider: string) {
  return MIRURO_PROVIDERS.includes(provider);
}

async function miruroFetch<T>(path: string, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MIRURO_BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Miruro ${path}: HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type MiruroEpisode = {
  id: string; // e.g. "watch/bee/21/sub/anikoto-1" — usable directly on /watch
  number: number;
  title: string | null;
  image: string | null;
};

type MiruroEpisodesResponse = {
  providers: Record<string, { episodes: Record<string, MiruroEpisode[]> }>;
};

/** Episode ids stay parseable so watch can fall back to another provider. */
function miruroEpisodeId(prov: string, anilistId: number, ep: MiruroEpisode) {
  return `miruro|${prov}|${anilistId}|${ep.number}|${ep.id}`;
}

function parseMiruroEpisodeId(episodeId: string) {
  if (!episodeId.startsWith("miruro|")) return null;
  const parts = episodeId.split("|");
  if (parts.length !== 5) return null;
  return {
    prov: parts[1],
    anilistId: Number(parts[2]),
    number: Number(parts[3]),
    apiId: parts[4],
  };
}

type MiruroPick = { episodes: AnimeEpisode[]; chosen: string; counts: Record<string, number> };

/** Picks the Miruro source provider with the most episodes for the wanted audio. */
function pickMiruroEpisodes(data: MiruroEpisodesResponse, audio: "sub" | "dub"): MiruroPick {
  const counts: Record<string, number> = {};
  const ranked: { prov: string; episodes: MiruroEpisode[] }[] = [];
  for (const [prov, info] of Object.entries(data.providers ?? {})) {
    const list = info?.episodes?.[audio] ?? info?.episodes?.sub ?? [];
    counts[prov] = list.length;
    if (list.length) ranked.push({ prov, episodes: list });
  }
  ranked.sort((a, b) => b.episodes.length - a.episodes.length);
  const best = ranked[0];
  return {
    episodes: (best?.episodes ?? []).map((ep) => ({
      id: miruroEpisodeId(best.prov, 0, ep),
      number: Number(ep.number) || 0,
      title: ep.title ?? null,
      image: ep.image ?? null,
    })),
    chosen: best?.prov ?? "",
    counts,
  };
}

async function miruroEpisodes(
  anilistId: number,
  audio: "sub" | "dub",
  title?: string,
): Promise<MiruroPick> {
  const data = await miruroFetch<MiruroEpisodesResponse>(`/episodes/${anilistId}`);
  const pick = pickMiruroEpisodes(data, audio);
  // Re-embed the real AniList id into each id (pick helper used a placeholder).
  pick.episodes = pick.episodes.map((ep) => ({
    ...ep,
    id: ep.id.replace(/^miruro\|[^|]+\|0\|/, `miruro|${pick.chosen}|${anilistId}|`),
  }));
  if (!pick.episodes.length) {
    throw new Error(
      `No ${audio === "dub" ? "dubbed" : ""} episodes found${title ? ` for ${title}` : ""}`,
    );
  }
  return pick;
}

export type WatchResult = {
  sources: AnimeStreamSource[];
  subtitles: { url: string; lang: string }[];
  headers: Record<string, string>;
  embed: string | null;
  error: string | null;
};

type MiruroWatch = {
  streams: {
    url: string;
    type: string; // "hls" | "embed" | ...
    quality?: string;
    server?: string;
    referer?: string;
    isActive?: boolean;
  }[];
  subtitles?: { url?: string; lang?: string; label?: string }[];
};

function mapMiruroWatch(res: MiruroWatch): Omit<WatchResult, "error"> {
  const streams = res.streams ?? [];
  // Prefer direct HLS/MP4 over the provider's embed page — the embed iframe is
  // often referrer-gated, while the HLS URL plays in the built-in player.
  const embed = streams.find((s) => s.type === "embed" && s.url)?.url ?? null;
  const sources: AnimeStreamSource[] = streams
    .filter((s) => s.type !== "embed" && !!s.url)
    .map((s) => ({
      url: s.url,
      quality: s.quality || s.server || "auto",
      isM3U8: s.type === "hls" || s.url.includes(".m3u8"),
    }));
  const subtitles = (res.subtitles ?? [])
    .filter((t) => !!t.url)
    .map((t) => ({ url: t.url as string, lang: t.lang || t.label || "Subtitle" }));
  return { sources, subtitles, headers: {}, embed };
}

/**
 * Resolves a playable stream for a Miruro episode. Tries the recorded source
 * provider first; on failure re-fetches the episode list and races the other
 * providers for the same episode number.
 */
async function miruroWatch(episodeId: string, audio: "sub" | "dub"): Promise<WatchResult> {
  const parsed = parseMiruroEpisodeId(episodeId);
  if (!parsed) throw new Error("Invalid episode reference");
  const attempts: string[] = [];
  const tryWatch = async (apiId: string): Promise<WatchResult> => {
    attempts.push(apiId);
    // Episode ids arrive as "watch/<provider>/<id>/<audio>/<server>" — the
    // leading segment already names the endpoint, so don't prefix it again.
    const path = apiId.startsWith("watch/") ? `/${apiId}` : `/watch/${apiId}`;
    const res = await miruroFetch<MiruroWatch>(path, 20_000);
    const mapped = mapMiruroWatch(res);
    if (!mapped.sources.length && !mapped.embed) throw new Error("No playable stream returned");
    return { ...mapped, error: null };
  };

  try {
    return await tryWatch(parsed.apiId);
  } catch {
    // Fall through to the other Miruro providers for the same episode.
  }
  try {
    const data = await miruroFetch<MiruroEpisodesResponse>(`/episodes/${parsed.anilistId}`);
    const ranked: { prov: string; episodes: MiruroEpisode[] }[] = [];
    for (const [prov, info] of Object.entries(data.providers ?? {})) {
      const list = info?.episodes?.[audio] ?? info?.episodes?.sub ?? [];
      if (list.length) ranked.push({ prov, episodes: list });
    }
    ranked.sort((a, b) => b.episodes.length - a.episodes.length);
    for (const cand of ranked) {
      const match = cand.episodes.find((e) => Number(e.number) === parsed.number);
      if (!match) continue;
      try {
        return await tryWatch(match.id);
      } catch {
        // next provider
      }
    }
  } catch {
    // list unavailable — report the original failure below
  }
  return {
    sources: [],
    subtitles: [],
    headers: {},
    embed: null,
    error: `No stream could be resolved from any source (tried ${attempts.length})`,
  };
}

/** Encodes the AniList id + episode number so embed providers can rebuild the player. */
function embedEpisodeId(anilistId: number, n: number) {
  return `embed:${anilistId}:${n}`;
}

function parseEmbedEpisodeId(episodeId: string) {
  const m = /^embed:(\d+):(\d+)$/.exec(episodeId);
  if (!m) return null;
  return { anilistId: Number(m[1]), number: Number(m[2]) };
}

/** Embed providers keyed purely by AniList id + episode number (no scraping). */
const EMBED_BUILDERS: Record<string, (anilistId: number, ep: number, dub: boolean) => string> = {
  videasy: (id, ep, dub) => `https://player.videasy.net/anime/${id}/${ep}${dub ? "?dub=true" : ""}`,
  megaplay: (id, ep, dub) => `https://megaplay.buzz/stream/ani/${id}/${ep}/${dub ? "dub" : "sub"}`,
  vidplay: (id, ep, dub) => `https://vidplay.to/embed/anime/${id}/${ep}/${dub ? "dub" : "sub"}`,
  vidsrccc: (id, ep, dub) => `https://vidsrc.cc/v2/embed/anime/ani${id}/${ep}/${dub ? "dub" : "sub"}`,
};

/**
 * Embed providers generate episode slots from the AniList count only, so they
 * ship no titles or thumbnails. Best-effort enrichment from the Miruro catalogue.
 */
async function miruroEpisodeMeta(anilistId: number): Promise<Map<number, { title: string; image: string | null }>> {
  const meta = new Map<number, { title: string; image: string | null }>();
  try {
    const data = await miruroFetch<MiruroEpisodesResponse>(`/episodes/${anilistId}`, 9_000);
    for (const info of Object.values(data.providers ?? {})) {
      const list = info?.episodes?.sub ?? info?.episodes?.dub ?? [];
      for (const ep of list) {
        const n = Number(ep.number) || 0;
        if (n && !meta.has(n)) meta.set(n, { title: ep.title ?? "", image: ep.image ?? null });
      }
    }
  } catch {
    // Enrichment is optional — empty map keeps generated slots usable.
  }
  return meta;
}

export const animeEpisodes = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      id: number;
      malId?: number | null;
      title?: string;
      provider?: string;
      dub?: boolean;
      episodeCount?: number | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const provider = data.provider || "videasy";
    const audio: "sub" | "dub" = data.dub ? "dub" : "sub";
    try {
      // Embed providers need no episode discovery — AniList's count is enough.
      if (EMBED_BUILDERS[provider]) {
        const count = Math.max(1, Number(data.episodeCount) || 12);
        const meta = await miruroEpisodeMeta(data.id);
        const episodes: AnimeEpisode[] = Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const m = meta.get(n);
          return {
            id: embedEpisodeId(data.id, n),
            number: n,
            title: m?.title || null,
            image: m?.image ?? null,
          };
        });
        return { episodes, provider, dub: !!data.dub, error: null as string | null };
      }
      if (isMiruroProvider(provider)) {
        const pick = await miruroEpisodes(data.id, audio, data.title);
        return { episodes: pick.episodes, provider, dub: !!data.dub, error: null as string | null };
      }
      // Unknown provider — fall back to the Miruro-backed HiAnime catalogue.
      const pick = await miruroEpisodes(data.id, audio, data.title);
      return { episodes: pick.episodes, provider, dub: !!data.dub, error: null as string | null };
    } catch (e) {
      return {
        episodes: [] as AnimeEpisode[],
        provider,
        dub: !!data.dub,
        error: e instanceof Error ? e.message : "Providers unreachable",
      };
    }
  });

export const animeWatch = createServerFn({ method: "GET" })
  .inputValidator((d: { episodeId: string; provider?: string; dub?: boolean }) => d)
  .handler(async ({ data }): Promise<WatchResult> => {
    const provider = data.provider || "videasy";
    try {
      const builder = EMBED_BUILDERS[provider];
      if (builder) {
        const parsed = parseEmbedEpisodeId(data.episodeId);
        if (!parsed) throw new Error("Invalid episode reference for this provider");
        return {
          sources: [],
          subtitles: [],
          headers: {},
          embed: builder(parsed.anilistId, parsed.number, !!data.dub),
          error: null,
        };
      }
      if (isMiruroProvider(provider)) {
        return await miruroWatch(data.episodeId, data.dub ? "dub" : "sub");
      }
      // Unknown provider — resolve through the Miruro-backed catalogue.
      return await miruroWatch(data.episodeId, data.dub ? "dub" : "sub");
    } catch (e) {
      return {
        sources: [],
        subtitles: [],
        headers: {},
        embed: null,
        error: e instanceof Error ? e.message : "Providers unreachable",
      };
    }
  });

// ============ Detail extras (characters, related anime, recommendations) ============

export type AnimeCharacter = { name: string; role: string; image: string | null; voiceActor: string | null };
export type AnimeRelated = { id: number; title: string; poster: string | null; relation: string };
export type AnimeRecommendation = { id: number; title: string; poster: string | null };

type MiruroInfo = {
  characters?: { edges?: { role?: string; node?: { name?: { full?: string }; image?: { large?: string } }; voiceActors?: { name?: { full?: string } }[] }[] };
  relations?: { edges?: { relationType?: string; node?: { id?: number; title?: { english?: string | null; romaji?: string | null }; coverImage?: { large?: string | null } } }[] };
  recommendations?: { nodes?: { mediaRecommendation?: { id?: number; title?: { english?: string | null; romaji?: string | null }; coverImage?: { large?: string | null } } }[] };
};

export const animeExtras = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    try {
      const info = await miruroFetch<MiruroInfo>(`/info/${data.id}`);
      const characters: AnimeCharacter[] = (info.characters?.edges ?? []).slice(0, 14).map((e) => ({
        name: e.node?.name?.full ?? "Unknown",
        role: e.role === "MAIN" ? "Main" : "Supporting",
        image: e.node?.image?.large ?? null,
        voiceActor: e.voiceActors?.[0]?.name?.full ?? null,
      }));
      const relations: AnimeRelated[] = (info.relations?.edges ?? [])
        .filter((e) => e.node?.id && (e.node.coverImage?.large || e.node.title))
        .map((e) => ({
          id: e.node!.id!,
          title: e.node!.title?.english || e.node!.title?.romaji || "Untitled",
          poster: e.node!.coverImage?.large ?? null,
          relation: (e.relationType ?? "Related")
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        }));
      const recommendations: AnimeRecommendation[] = (info.recommendations?.nodes ?? [])
        .filter((n) => n.mediaRecommendation?.id)
        .slice(0, 10)
        .map((n) => ({
          id: n.mediaRecommendation!.id!,
          title: n.mediaRecommendation!.title?.english || n.mediaRecommendation!.title?.romaji || "Untitled",
          poster: n.mediaRecommendation!.coverImage?.large ?? null,
        }));
      return { characters, relations, recommendations, error: null as string | null };
    } catch (e) {
      return {
        characters: [] as AnimeCharacter[],
        relations: [] as AnimeRelated[],
        recommendations: [] as AnimeRecommendation[],
        error: e instanceof Error ? e.message : "Extras unavailable",
      };
    }
  });
