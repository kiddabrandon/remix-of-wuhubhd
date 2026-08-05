// Multi-server streaming registry for WuHubHD.
// Each server exposes URL builders for movies and TV episodes.
// Users can reorder the priority list from Settings.

export type ServerKind = "general" | "anime";

export type StreamServer = {
  id: string;
  name: string;
  kind: ServerKind;
  color?: string;
  movie: (id: number | string) => string;
  tv: (id: number | string, season: number, episode: number) => string;
};

export const ANIME_API_PROVIDERS = [
  { id: "videasy", name: "Videasy anime", description: "AniList-keyed embed with sub/dub. Most reliable." },
  { id: "vidsrccc", name: "Vidsrc anime", description: "AniList-keyed embed fallback with sub/dub." },
  { id: "animepahe", name: "AnimePahe mirror", description: "Sub-focused fallback." },
] as const;

/** Providers that only need the AniList id + episode number (no scraping). */
export const ANIME_EMBED_PROVIDERS = ["videasy", "vidsrccc"] as string[];

/** Anime playback order: embeds first (they always resolve), scrapers after. */
export const DEFAULT_ANIME_PROVIDERS = ["videasy", "vidsrccc", "animepahe"] as string[];





// URL builder helpers. Not every provider exposes a documented embed schema;
// we use the most common `/embed/{type}/{id}` pattern as a reasonable default.
const embed = (base: string) => ({
  movie: (id: number | string) => `${base.replace(/\/$/, "")}/embed/movie/${id}`,
  tv: (id: number | string, s: number, e: number) =>
    `${base.replace(/\/$/, "")}/embed/tv/${id}/${s}/${e}`,
});

const flat = (base: string) => ({
  movie: (id: number | string) => `${base.replace(/\/$/, "")}/movie/${id}`,
  tv: (id: number | string, s: number, e: number) =>
    `${base.replace(/\/$/, "")}/tv/${id}/${s}/${e}`,
});

/** Only hosts verified reachable are listed — dead mirrors were removed. */
export const SERVERS: StreamServer[] = [
  { id: "videasy", name: "Videasy", kind: "general", color: "#00E5FF", ...flat("https://player.videasy.net") },
  { id: "vidlink", name: "VidLink", kind: "general", color: "#A855F7", ...flat("https://vidlink.pro") },
  { id: "vidsrc", name: "Vidsrc", kind: "general", color: "#22C55E", ...embed("https://vidsrc.to") },
  { id: "vidsrccc", name: "Vidsrc CC", kind: "general", color: "#16A34A", ...embed("https://vidsrc.cc/v2") },
  { id: "vixsrc", name: "VixSrc", kind: "general", color: "#FF3B57", ...flat("https://vixsrc.to") },
  { id: "cineby", name: "Cineby", kind: "general", color: "#F59E0B", ...embed("https://cineby.at") },
  { id: "webstreamr", name: "WebStreamr", kind: "general", color: "#38BDF8", ...embed("https://webstreamr.com") },
  {
    id: "2embed",
    name: "2Embed",
    kind: "general",
    color: "#EC4899",
    movie: (id) => `https://www.2embed.cc/embed/${id}`,
    tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id: "multiembed",
    name: "MultiEmbed",
    kind: "general",
    color: "#8B5CF6",
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  // Anime-focused hosts (verified reachable)
  { id: "anikototv", name: "AnikotoTV", kind: "anime", color: "#F472B6", ...embed("https://anikototv.to") },
  { id: "animepahe", name: "AnimePahe", kind: "anime", color: "#FBBF24", ...embed("https://animepahe.ru") },
  { id: "animesalt", name: "AnimeSalt", kind: "anime", color: "#34D399", ...embed("https://animesalt.to") },
];

export const DEFAULT_SERVER_ORDER: string[] = [
  ...SERVERS.filter((s) => s.kind === "general").map((s) => s.id),
  ...SERVERS.filter((s) => s.kind === "anime").map((s) => s.id),
];


export function getServer(id: string): StreamServer | undefined {
  return SERVERS.find((s) => s.id === id);
}

export function orderedServers(order: string[]): StreamServer[] {
  const seen = new Set<string>();
  const out: StreamServer[] = [];
  for (const id of order) {
    const s = getServer(id);
    if (s && !seen.has(id)) {
      out.push(s);
      seen.add(id);
    }
  }
  // Append any unknown/newly-added servers that aren't in the saved order yet.
  for (const s of SERVERS) {
    if (!seen.has(s.id)) out.push(s);
  }
  return out;
}
