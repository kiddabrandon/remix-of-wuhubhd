import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Hero } from "@/components/Hero";
import { Carousel } from "@/components/Carousel";
import { TonightsPick } from "@/components/TonightsPick";
import { Top10Row } from "@/components/Top10Row";
import { poster } from "@/lib/tmdb-utils";
import { useApp } from "@/lib/app-store";
import { useSiteConfig } from "@/lib/site-config";
import { DEFAULT_HOME_SECTIONS } from "@/lib/site-config";
import { becauseYouWatched } from "@/lib/recommendations.functions";
import {
  tmdbCollection,
  tmdbPopularMovies,
  tmdbPopularTv,
  tmdbTopRatedMovies,
  tmdbTopRatedTv,
  tmdbTrending,
} from "@/lib/tmdb.functions";

const trendingQO = queryOptions({
  queryKey: ["trending"],
  queryFn: () => tmdbTrending(),
  staleTime: 5 * 60_000,
});
const popMoviesQO = queryOptions({
  queryKey: ["popular", "movie"],
  queryFn: () => tmdbPopularMovies(),
  staleTime: 5 * 60_000,
});
const topTvQO = queryOptions({
  queryKey: ["top", "tv"],
  queryFn: () => tmdbTopRatedTv(),
  staleTime: 5 * 60_000,
});
const topMoviesQO = queryOptions({
  queryKey: ["top", "movie"],
  queryFn: () => tmdbTopRatedMovies(),
  staleTime: 5 * 60_000,
});
const popTvQO = queryOptions({
  queryKey: ["popular", "tv"],
  queryFn: () => tmdbPopularTv(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(trendingQO),
      context.queryClient.ensureQueryData(popMoviesQO),
      context.queryClient.ensureQueryData(topTvQO),
      context.queryClient.ensureQueryData(topMoviesQO),
      context.queryClient.ensureQueryData(popTvQO),
    ]);
  },
  component: Discover,
});

function Discover() {
  const { data: trending } = useSuspenseQuery(trendingQO);
  const { data: popMovies } = useSuspenseQuery(popMoviesQO);
  const { data: topTv } = useSuspenseQuery(topTvQO);
  const { data: topMovies } = useSuspenseQuery(topMoviesQO);
  const { data: popTv } = useSuspenseQuery(popTvQO);
  const { progress } = useApp();
  const site = useSiteConfig();

  const trendingItems = trending.results;
  const top10Items = trendingItems
    .slice()
    .sort((a: any, b: any) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, 10);

  // Featured collection override for hero (admin-configured).
  const collectionId = site.featuredCollection?.trim()
    ? Number(site.featuredCollection.trim())
    : null;
  const { data: collection } = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => tmdbCollection({ data: { id: collectionId! } }),
    enabled: !!collectionId && Number.isFinite(collectionId),
    staleTime: 30 * 60_000,
  });
  const heroItems = collection?.parts?.length
    ? collection.parts.map((p: any) => ({ ...p, media_type: p.media_type ?? "movie" }))
    : trendingItems;

  const configuredSections = site.homeSections?.length ? site.homeSections : DEFAULT_HOME_SECTIONS;
  const sectionById: Record<string, React.ReactNode> = {
    continue: progress.length > 0 ? <ContinueWatching /> : null,
    tonight: <TonightsPick pool={trendingItems} />,
    because: progress.length > 0 ? <BecauseYouWatched /> : null,
    top10: <Top10Row items={top10Items} />,
    trending: <Carousel title="Trending Now" items={trendingItems} viewAllHref="/movies" />,
    popularMovies: <Carousel title="Popular Movies" items={popMovies.results.map((r: any) => ({ ...r, media_type: "movie" }))} viewAllHref="/movies" />,
    topTv: <Carousel title="Top Rated TV" items={topTv.results.map((r: any) => ({ ...r, media_type: "tv" }))} viewAllHref="/tv" />,
    topMovies: <Carousel title="Top Rated Movies" items={topMovies.results.map((r: any) => ({ ...r, media_type: "movie" }))} viewAllHref="/movies" />,
    popularTv: <Carousel title="Popular TV Shows" items={popTv.results.map((r: any) => ({ ...r, media_type: "tv" }))} viewAllHref="/tv" />,
  };

  return (
    <div>
      <Hero items={heroItems} />
      <div className="space-y-8 pt-2 pb-4 sm:space-y-10 sm:pt-4">
        {configuredSections.map((s) => s.enabled ? <div key={s.id}>{sectionById[s.id]}</div> : null)}
      </div>
    </div>
  );
}

function ContinueWatching() {
  const { progress, removeProgress } = useApp();
  return (
    <section className="px-4 sm:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
          <span
            className="mr-2 inline-block h-4 w-1 translate-y-0.5 rounded-full align-middle"
            style={{ background: "var(--accent)" }}
          />
          Continue Watching
        </h2>
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
          View all
        </Link>
      </div>
      <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
        {progress.slice(0, 12).map((p) => {
          const src = poster(p.poster_path, "w342");
          const params =
            p.media_type === "tv" && p.season && p.episode
              ? { s: p.season, e: p.episode }
              : undefined;
          return (
            <div
              key={`${p.media_type}-${p.tmdb_id}`}
              className="group relative w-56 shrink-0 snap-start sm:w-60"
            >
              <Link
                to="/watch/$type/$id"
                params={{ type: p.media_type, id: String(p.tmdb_id) }}
                search={params as any}
                className="block"
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5">
                  {src && (
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full scale-110 object-cover transition group-hover:scale-115"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="line-clamp-1 text-sm font-semibold">{p.title}</div>
                    {p.media_type === "tv" && p.season && p.episode && (
                      <div className="text-[11px] text-neutral-400">
                        S{p.season} · E{p.episode}
                      </div>
                    )}
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(5, p.progress_pct)}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void removeProgress({ tmdb_id: p.tmdb_id, media_type: p.media_type });
                }}
                aria-label={`Remove ${p.title} from Continue Watching`}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/70 text-white/90 opacity-0 backdrop-blur transition hover:bg-red-500/80 hover:text-white focus:opacity-100 group-hover:opacity-100 md:h-8 md:w-8 [@media(hover:none)]:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BecauseYouWatched() {
  const { data } = useQuery({
    queryKey: ["recs", "byw"],
    queryFn: () => becauseYouWatched(),
    staleTime: 5 * 60_000,
  });
  if (!data?.results?.length) return null;
  const title = data.seed ? `Because you watched ${data.seed}` : "Recommended for you";
  return <Carousel title={title} items={data.results as any} />;
}
