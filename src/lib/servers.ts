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
  { id: "hianime", name: "HiAnime direct", description: "Direct scraper with sub/dub server discovery." },
  { id: "megaplay", name: "Megaplay embed", description: "HiAnime episode ids played through Megaplay." },
  { id: "gogoanime", name: "Gogoanime mirror", description: "Consumet-compatible fallback." },
  { id: "zoro", name: "Zoro / HiAnime mirror", description: "Consumet-compatible fallback." },
  { id: "animepahe", name: "AnimePahe mirror", description: "Sub-focused fallback." },
] as const;

/** Providers that only need the AniList id + episode number (no scraping). */
export const ANIME_EMBED_PROVIDERS = ["videasy", "vidsrccc"] as string[];

/** Anime playback order: embeds first (they always resolve), scrapers after. */
export const DEFAULT_ANIME_PROVIDERS = ["videasy", "vidsrccc", "hianime", "megaplay"] as string[];




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

export const SERVERS: StreamServer[] = [
  { id: "videasy", name: "Videasy", kind: "general", color: "#00E5FF", ...flat("https://player.videasy.net") },
  { id: "vidlink", name: "VidLink", kind: "general", color: "#A855F7", ...flat("https://vidlink.pro") },
  { id: "vidsrc", name: "Vidsrc", kind: "general", color: "#22C55E", ...embed("https://vidsrc.to") },
  { id: "vixsrc", name: "VixSrc", kind: "general", color: "#FF3B57", ...flat("https://vixsrc.to") },
  { id: "vidnest", name: "VidNest", kind: "general", ...embed("https://vidnest.xyz") },
  { id: "111477", name: "111477", kind: "general", ...embed("https://111477.xyz") },
  { id: "webstreamr", name: "WebStreamr", kind: "general", ...embed("https://webstreamr.com") },
  { id: "4khdhub", name: "4KHDHub", kind: "general", ...embed("https://4khdhub.to") },
  { id: "allmovieland", name: "AllMovieLand", kind: "general", ...embed("https://allmovieland.co") },
  { id: "castle", name: "Castle", kind: "general", ...embed("https://castle.xyz") },
  { id: "cineby", name: "Cineby", kind: "general", ...embed("https://cineby.at") },
  { id: "cinefreak", name: "CineFreak", kind: "general", ...embed("https://cinefreak.to") },
  { id: "cinemm", name: "CineMM", kind: "general", ...embed("https://cinemm.to") },
  { id: "cinemacity", name: "CinemaCity", kind: "general", ...embed("https://cinemacity.to") },
  { id: "ctgmovies", name: "CTGMovies", kind: "general", ...embed("https://ctgmovies.to") },
  { id: "dahmermovies", name: "DahmerMovies", kind: "general", ...embed("https://dahmermovies.to") },
  { id: "dooflix", name: "DooFlix", kind: "general", ...embed("https://dooflix.to") },
  { id: "einthusan", name: "Einthusan", kind: "general", ...embed("https://einthusan.tv") },
  { id: "fibwatch", name: "FibWatch", kind: "general", ...embed("https://fibwatch.to") },
  { id: "goatapi", name: "GoatAPI", kind: "general", ...embed("https://goatapi.to") },
  { id: "gramcinema", name: "GramCinema", kind: "general", ...embed("https://gramcinema.to") },
  { id: "hdhub4u", name: "HDHub4u", kind: "general", ...embed("https://hdhub4u.to") },
  { id: "hindmoviez", name: "HindMoviez", kind: "general", ...embed("https://hindmoviez.to") },
  { id: "lordflix", name: "Lordflix", kind: "general", ...embed("https://lordflix.to") },
  { id: "moviebox", name: "MovieBox", kind: "general", ...embed("https://moviebox.to") },
  // Anime / specialty
  { id: "allanime", name: "AllAnime", kind: "anime", ...embed("https://allanime.to") },
  { id: "allwish", name: "All-Wish", kind: "anime", ...embed("https://allwish.to") },
  { id: "animekai", name: "Animekai", kind: "anime", ...embed("https://animekai.to") },
  { id: "anikototv", name: "AnikotoTV", kind: "anime", ...embed("https://anikototv.to") },
  { id: "anidb", name: "AniDB", kind: "anime", ...embed("https://anidb.net") },
  { id: "animepahe", name: "AnimePahe", kind: "anime", ...embed("https://animepahe.ru") },
  { id: "animesalt", name: "AnimeSalt", kind: "anime", ...embed("https://animesalt.to") },
  { id: "animetsu", name: "Animetsu", kind: "anime", ...embed("https://animetsu.to") },
  { id: "animeworld", name: "AnimeWorld", kind: "anime", ...embed("https://animeworld.to") },
  { id: "anime-sama", name: "Anime-Sama", kind: "anime", ...embed("https://anime-sama.fr") },
  { id: "hianime", name: "HiAnime", kind: "anime", ...embed("https://hianime.to") },
  { id: "kurage", name: "Kurage", kind: "anime", ...embed("https://kurage.to") },
];

export const DEFAULT_SERVER_ORDER: string[] = [
  "videasy",
  "vidlink",
  "vidsrc",
  "vixsrc",
  "vidnest",
  "webstreamr",
  "cineby",
  "111477",
  "4khdhub",
  "allmovieland",
  ...SERVERS.filter(
    (s) =>
      s.kind === "general" &&
      ![
        "videasy",
        "vidlink",
        "vidsrc",
        "vixsrc",
        "vidnest",
        "webstreamr",
        "cineby",
        "111477",
        "4khdhub",
        "allmovieland",
      ].includes(s.id),
  ).map((s) => s.id),
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
