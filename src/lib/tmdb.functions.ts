import { createServerFn } from "@tanstack/react-start";

const BASE = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  // Prefer v4 read-access token (JWT) when provided; fall back to the v3 API key.
  const bearer = process.env.TMDB_READ_ACCESS_TOKEN;
  const legacyKey = process.env.TMDB_API_KEY;
  const bearerLike = bearer && bearer.split(".").length === 3 && bearer.length > 40;
  const legacyIsBearer = !bearerLike && legacyKey && legacyKey.split(".").length === 3 && legacyKey.length > 40;
  const authBearer = bearerLike ? bearer : legacyIsBearer ? legacyKey : null;
  const apiKey = authBearer ? null : legacyKey;
  if (!authBearer && !apiKey) throw new Error("TMDB credentials are not configured");

  const url = new URL(BASE + path);
  if (apiKey) url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: authBearer
      ? { Authorization: `Bearer ${authBearer}`, accept: "application/json" }
      : { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

function emptyResults<T extends { results: any[] }>(extra: Partial<T> = {}): T {
  return { results: [], ...extra } as unknown as T;
}

async function safeTmdb<T extends { results: any[] }>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  fallback: Partial<T> = {},
): Promise<T> {
  try {
    return await tmdb<T>(path, params);
  } catch (error) {
    console.error(error);
    return emptyResults<T>(fallback);
  }
}

export const tmdbTrending = createServerFn({ method: "GET" }).handler(async () => {
  return safeTmdb<{ results: any[] }>("/trending/all/day", { language: "en-US" });
});

export const tmdbPopularMovies = createServerFn({ method: "GET" }).handler(async () => {
  return safeTmdb<{ results: any[] }>("/movie/popular", { language: "en-US", page: 1 });
});

export const tmdbTopRatedTv = createServerFn({ method: "GET" }).handler(async () => {
  return safeTmdb<{ results: any[] }>("/tv/top_rated", { language: "en-US", page: 1 });
});

export const tmdbTopRatedMovies = createServerFn({ method: "GET" }).handler(async () => {
  return safeTmdb<{ results: any[] }>("/movie/top_rated", { language: "en-US", page: 1 });
});

export const tmdbPopularTv = createServerFn({ method: "GET" }).handler(async () => {
  return safeTmdb<{ results: any[] }>("/tv/popular", { language: "en-US", page: 1 });
});

export const tmdbDiscover = createServerFn({ method: "GET" })
  .inputValidator((d: { type: "movie" | "tv"; genre?: string; year?: string; sort?: string; page?: number; provider?: string }) => d)
  .handler(async ({ data }) => {
    const params: Record<string, any> = {
      language: "en-US",
      sort_by: data.sort || "popularity.desc",
      page: data.page ?? 1,
      include_adult: "false",
    };
    if (data.genre) params.with_genres = data.genre;
    if (data.provider) {
      params.with_watch_providers = data.provider;
      params.watch_region = "US";
    }
    if (data.year) {
      if (data.type === "movie") params.primary_release_year = data.year;
      else params.first_air_date_year = data.year;
    }
    return safeTmdb<{ results: any[]; total_pages: number }>(`/discover/${data.type}`, params, { total_pages: 0 });
  });

export const tmdbSearchMulti = createServerFn({ method: "GET" })
  .inputValidator((d: { query: string }) => d)
  .handler(async ({ data }) => {
    if (!data.query.trim()) return { results: [] };
    return safeTmdb<{ results: any[] }>("/search/multi", { query: data.query, language: "en-US", include_adult: "false" });
  });

export const tmdbMovie = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    return tmdb<any>(`/movie/${data.id}`, {
      language: "en-US",
      append_to_response: "external_ids,credits,recommendations,videos,images",
    });
  });

export const tmdbTv = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    return tmdb<any>(`/tv/${data.id}`, {
      language: "en-US",
      append_to_response: "external_ids,credits,recommendations,videos,images",
    });
  });

export const tmdbSeason = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; season: number }) => d)
  .handler(async ({ data }) => {
    return tmdb<any>(`/tv/${data.id}/season/${data.season}`, { language: "en-US" });
  });

export const tmdbGenres = createServerFn({ method: "GET" })
  .inputValidator((d: { type: "movie" | "tv" }) => d)
  .handler(async ({ data }) => {
    return tmdb<{ genres: { id: number; name: string }[] }>(`/genre/${data.type}/list`, { language: "en-US" });
  });

export const tmdbCollection = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    return tmdb<any>(`/collection/${data.id}`, { language: "en-US" });
  });

export const tmdbTrailerKey = createServerFn({ method: "GET" })
  .inputValidator((d: { type: "movie" | "tv"; id: number }) => d)
  .handler(async ({ data }) => {
    try {
      const r = await tmdb<{ results: any[] }>(`/${data.type}/${data.id}/videos`, { language: "en-US" });
      const yt = r.results.find(
        (v: any) => v.site === "YouTube" && v.type === "Trailer" && v.official,
      ) || r.results.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || r.results.find((v: any) => v.site === "YouTube");
      return { key: yt?.key ?? null };
    } catch {
      return { key: null };
    }
  });
