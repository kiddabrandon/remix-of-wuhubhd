import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { FilterBar } from "@/components/FilterBar";
import { PosterCard } from "@/components/PosterCard";
import { tmdbDiscover } from "@/lib/tmdb.functions";

const schema = z.object({
  genre: fallback(z.string(), "").default(""),
  year: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "popularity.desc").default("popularity.desc"),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/movies")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Movies — Nocturne" },
      { name: "description", content: "Browse thousands of movies. Filter by genre, year, and popularity." },
    ],
  }),
  component: Movies,
});

function Movies() {
  const { genre, year, sort, page } = Route.useSearch();
  const navigate = useNavigate({ from: "/movies" });

  const { data, isFetching } = useQuery({
    queryKey: ["discover", "movie", genre, year, sort, page],
    queryFn: () => tmdbDiscover({ data: { type: "movie", genre, year, sort, page } }),
    staleTime: 60_000,
  });

  const items = (data?.results ?? []).map((r: any) => ({ ...r, media_type: "movie" }));

  return (
    <div className="space-y-8 py-8">
      <div className="px-4 sm:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">Movies</h1>
        <p className="mt-1 text-sm text-neutral-400">Explore the catalog.</p>
      </div>
      <FilterBar
        type="movie"
        genre={genre}
        year={year}
        sort={sort}
        onChange={(u) => navigate({ search: (prev: z.infer<typeof schema>) => ({ ...prev, ...u, page: 1 }) })}
      />
      <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 sm:gap-6 sm:px-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((it: any) => (
          <div key={it.id} className="w-full">
            <PosterCard item={it} />
          </div>
        ))}
      </div>
      {isFetching && <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>}
      {data && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => navigate({ search: (prev: z.infer<typeof schema>) => ({ ...prev, page: Math.max(1, prev.page - 1) }) })}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-neutral-400">Page {page}</span>
          <button
            onClick={() => navigate({ search: (prev: z.infer<typeof schema>) => ({ ...prev, page: prev.page + 1 }) })}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
