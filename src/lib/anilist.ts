// Client-side AniList access.
// AniList blocks datacenter IPs (Cloudflare Workers, serverless, etc.) with 403.
// Running these queries in the browser bypasses the ban entirely. Responses are
// cached in memory for this tab only; nothing app-specific is persisted locally.

const ANILIST = "https://graphql.anilist.co";
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes
const memoryCache = new Map<string, { t: number; v: unknown }>();

export type AnimeItem = {
  id: number;
  title: string;
  poster: string | null;
  banner: string | null;
  score: number | null;
  year: number | null;
  episodes: number | null;
  format: string | null;
  genres: string[];
  overview: string | null;
};

type AniListMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { large: string | null; extraLarge: string | null; color: string | null };
  bannerImage: string | null;
  averageScore: number | null;
  episodes: number | null;
  seasonYear: number | null;
  format: string | null;
  genres: string[];
  status: string | null;
  studios?: { nodes: { name: string }[] };
  trailer?: { id: string | null; site: string | null } | null;
};

function mapMedia(m: AniListMedia): AnimeItem {
  return {
    id: m.id,
    title: m.title.english || m.title.romaji || m.title.native || "Untitled",
    poster: m.coverImage.extraLarge || m.coverImage.large,
    banner: m.bannerImage,
    score: m.averageScore != null ? m.averageScore / 10 : null,
    year: m.seasonYear,
    episodes: m.episodes,
    format: m.format,
    genres: m.genres ?? [],
    overview: m.description ? m.description.replace(/<[^>]+>/g, "") : null,
  };
}

function cacheGet<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (!cached || Date.now() - cached.t > CACHE_TTL_MS) return null;
  return cached.v as T;
}

function cacheSet<T>(key: string, value: T) {
  memoryCache.set(key, { t: Date.now(), v: value });
}

async function anilist<T>(
  cacheKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const cached = cacheGet<T>(cacheKey);
  if (cached) return cached;

  const res = await fetch(ANILIST, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`AniList ${res.status}`);
  }
  const json = (await res.json()) as { data: T; errors?: unknown };
  if (!json.data) throw new Error("AniList: empty response");
  cacheSet(cacheKey, json.data);
  return json.data;
}

const PAGE_FIELDS = `
  id idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { large extraLarge color }
  bannerImage
  averageScore episodes seasonYear format genres status
`;

export async function animePopular(): Promise<AnimeItem[]> {
  const data = await anilist<{ Page: { media: AniListMedia[] } }>(
    "popular",
    `query { Page(perPage: 24) { media(type: ANIME, sort: POPULARITY_DESC) { ${PAGE_FIELDS} } } }`,
    {},
  );
  return data.Page.media.map(mapMedia);
}

export async function animeTrending(): Promise<AnimeItem[]> {
  const data = await anilist<{ Page: { media: AniListMedia[] } }>(
    "trending",
    `query { Page(perPage: 24) { media(type: ANIME, sort: TRENDING_DESC) { ${PAGE_FIELDS} } } }`,
    {},
  );
  return data.Page.media.map(mapMedia);
}

export async function animeTopRated(): Promise<AnimeItem[]> {
  const data = await anilist<{ Page: { media: AniListMedia[] } }>(
    "top",
    `query { Page(perPage: 24) { media(type: ANIME, sort: SCORE_DESC) { ${PAGE_FIELDS} } } }`,
    {},
  );
  return data.Page.media.map(mapMedia);
}

export async function animeSeasonal(): Promise<AnimeItem[]> {
  const data = await anilist<{ Page: { media: AniListMedia[] } }>(
    "seasonal",
    `query { Page(perPage: 24) { media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) { ${PAGE_FIELDS} } } }`,
    {},
  );
  return data.Page.media.map(mapMedia);
}

export const ANIME_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo",
  "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life",
  "Sports", "Supernatural", "Thriller",
] as const;

export const ANIME_FORMATS = ["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"] as const;

const SORT_MAP: Record<string, string> = {
  popularity: "POPULARITY_DESC",
  trending: "TRENDING_DESC",
  score: "SCORE_DESC",
  newest: "START_DATE_DESC",
};

export type DiscoverInput = {
  genre?: string;
  year?: string;
  format?: string;
  sort?: string;
  search?: string;
  page?: number;
};

export async function animeDiscover(input: DiscoverInput) {
  const sort = SORT_MAP[input.sort ?? "popularity"] ?? "POPULARITY_DESC";
  const variables: Record<string, unknown> = {
    page: input.page ?? 1,
    perPage: 24,
    sort: [sort],
  };
  const conds: string[] = ["type: ANIME", "sort: $sort"];
  let paramDefs = "$page: Int, $perPage: Int, $sort: [MediaSort]";
  if (input.search && input.search.trim()) {
    variables.search = input.search.trim();
    paramDefs += ", $search: String";
    conds.push("search: $search");
  }
  if (input.genre) {
    variables.genre = input.genre;
    paramDefs += ", $genre: String";
    conds.push("genre: $genre");
  }
  if (input.year) {
    const y = Number(input.year);
    if (!Number.isNaN(y)) {
      variables.year = y;
      paramDefs += ", $year: Int";
      conds.push("seasonYear: $year");
    }
  }
  if (input.format) {
    variables.format = input.format;
    paramDefs += ", $format: MediaFormat";
    conds.push("format: $format");
  }
  const query = `query (${paramDefs}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage currentPage }
      media(${conds.join(", ")}) { ${PAGE_FIELDS} }
    }
  }`;
  const key = `discover:${JSON.stringify(variables)}`;
  const res = await anilist<{
    Page: {
      pageInfo: { hasNextPage: boolean; currentPage: number };
      media: AniListMedia[];
    };
  }>(key, query, variables);
  return {
    results: res.Page.media.map(mapMedia),
    hasNextPage: res.Page.pageInfo.hasNextPage,
    page: res.Page.pageInfo.currentPage,
  };
}

export type AnimeDetail = AnimeItem & {
  idMal: number | null;
  studios: string[];
  trailer: { youtubeKey: string } | null;
};

export async function animeById(id: number): Promise<AnimeDetail> {
  const res = await anilist<{ Media: AniListMedia }>(
    `by:${id}`,
    `query ($id: Int) { Media(id: $id, type: ANIME) {
      ${PAGE_FIELDS}
      studios(isMain: true) { nodes { name } }
      trailer { id site }
    } }`,
    { id },
  );
  const m = res.Media;
  return {
    ...mapMedia(m),
    idMal: m.idMal,
    studios: m.studios?.nodes.map((n) => n.name) ?? [],
    trailer:
      m.trailer && m.trailer.id && m.trailer.site === "youtube"
        ? { youtubeKey: m.trailer.id }
        : null,
  };
}

export async function animeSearch(q: string): Promise<AnimeItem[]> {
  if (!q.trim()) return [];
  const res = await anilist<{ Page: { media: AniListMedia[] } }>(
    `search:${q.toLowerCase()}`,
    `query ($q: String) { Page(perPage: 20) { media(type: ANIME, search: $q, sort: SEARCH_MATCH) { ${PAGE_FIELDS} } } }`,
    { q },
  );
  return res.Page.media.map(mapMedia);
}
