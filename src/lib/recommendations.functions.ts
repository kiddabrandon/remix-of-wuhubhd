import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TMDB = "https://api.themoviedb.org/3";

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY missing");
  const url = new URL(TMDB + path);
  const bearer = key.split(".").length === 3 && key.length > 40;
  if (!bearer) url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: bearer
      ? { Authorization: `Bearer ${key}`, accept: "application/json" }
      : { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

export const becauseYouWatched = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [prog, wl] = await Promise.all([
      context.supabase
        .from("user_progress")
        .select("tmdb_id, media_type, fully_watched")
        .order("updated_at", { ascending: false })
        .limit(20),
      context.supabase
        .from("user_watchlists")
        .select("tmdb_id, media_type")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const seeds: { id: number; type: "movie" | "tv" }[] = [];
    const seenIds = new Set<string>();
    for (const r of ([...(prog.data ?? []), ...(wl.data ?? [])] as any[])) {
      const k = `${r.media_type}-${r.tmdb_id}`;
      if (seenIds.has(k)) continue;
      seenIds.add(k);
      seeds.push({ id: r.tmdb_id, type: r.media_type });
      if (seeds.length >= 6) break;
    }
    if (seeds.length === 0)
      return { results: [], seed: null as string | null, genres: [] as number[] };

    // Fetch genres for seeds
    const genreCount = new Map<number, number>();
    const seedTitles: string[] = [];
    await Promise.all(
      seeds.map(async (s) => {
        try {
          const d = await tmdb<any>(`/${s.type}/${s.id}`, { language: "en-US" });
          seedTitles.push(d.title || d.name);
          for (const g of d.genres ?? []) genreCount.set(g.id, (genreCount.get(g.id) ?? 0) + 1);
        } catch {}
      }),
    );

    const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
    if (topGenres.length === 0) return { results: [], seed: null, genres: [] };

    const watchedIds = new Set(seeds.map((s) => `${s.type}-${s.id}`));
    const [m, t] = await Promise.all([
      tmdb<any>("/discover/movie", {
        language: "en-US",
        with_genres: topGenres.join(","),
        sort_by: "popularity.desc",
        page: 1,
      }),
      tmdb<any>("/discover/tv", {
        language: "en-US",
        with_genres: topGenres.join(","),
        sort_by: "popularity.desc",
        page: 1,
      }),
    ]);

    const merged = [
      ...m.results.map((r: any) => ({ ...r, media_type: "movie" })),
      ...t.results.map((r: any) => ({ ...r, media_type: "tv" })),
    ]
      .filter((r: any) => !watchedIds.has(`${r.media_type}-${r.id}`))
      .sort((a: any, b: any) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .slice(0, 20);

    return { results: merged, seed: seedTitles[0] ?? null, genres: topGenres };
  });
