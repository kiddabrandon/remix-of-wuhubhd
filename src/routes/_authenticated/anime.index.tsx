import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search } from "lucide-react";
import { AnimeCard } from "@/components/AnimeCard";
import { AnimeRow } from "@/components/AnimeRow";
import {
  ANIME_FORMATS,
  ANIME_GENRES,
  animeDiscover,
  animePopular,
  animeSeasonal,
  animeTopRated,
  animeTrending,
  type AnimeItem,
} from "@/lib/anilist";

const schema = z.object({
  q: fallback(z.string(), "").default(""),
  genre: fallback(z.string(), "").default(""),
  year: fallback(z.string(), "").default(""),
  format: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "popularity").default("popularity"),
  page: fallback(z.number().int(), 1).default(1),
});

type Search = z.infer<typeof schema>;

const YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i));
const SORTS = [
  { v: "popularity", l: "Popular" },
  { v: "trending", l: "Trending" },
  { v: "score", l: "Top Rated" },
  { v: "newest", l: "Newest" },
];

const trendingQO = queryOptions({
  queryKey: ["anime", "trending"],
  queryFn: () => animeTrending(),
  staleTime: 10 * 60_000,
});
const popularQO = queryOptions({
  queryKey: ["anime", "popular"],
  queryFn: () => animePopular(),
  staleTime: 10 * 60_000,
});
const topQO = queryOptions({
  queryKey: ["anime", "top"],
  queryFn: () => animeTopRated(),
  staleTime: 10 * 60_000,
});
const seasonalQO = queryOptions({
  queryKey: ["anime", "seasonal"],
  queryFn: () => animeSeasonal(),
  staleTime: 10 * 60_000,
});

export const Route = createFileRoute("/_authenticated/anime/")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Anime — WuHubHD" },
      {
        name: "description",
        content: "Discover trending, popular, and top-rated anime. Filter by genre, year, and format.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <div className="text-2xl font-semibold">Couldn't load anime</div>
      <p className="mt-2 text-sm text-neutral-400">{(error as Error)?.message}</p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-full px-4 py-2 text-sm font-medium text-black"
        style={{ background: "var(--accent)" }}
      >
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-12 text-center">Not found</div>,
  component: AnimeIndex,
});

function AnimeIndex() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/anime/" });
  const filtered =
    !!search.q || !!search.genre || !!search.year || !!search.format || search.page > 1;

  const set = (u: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...u, page: u.page ?? 1 }) });

  return (
    <div>
      {!filtered && <AnimeHero />}
      <div className="px-4 pt-6 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Anime</h1>
            <p className="text-sm text-neutral-400">Powered by AniList & Consumet</p>
          </div>
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={search.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Search anime…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-neutral-500 focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <AnimeFilters search={search} onChange={set} />
      </div>

      {filtered ? (
        <AnimeGrid search={search} onPage={(p) => set({ page: p })} />
      ) : (
        <AnimeHomeRows />
      )}
    </div>
  );
}

function AnimeHero() {
  const { data: trending } = useQuery(trendingQO);
  const hero = trending?.[0];
  if (!hero) return null;
  return (
    <div className="relative overflow-hidden">
      <div className="relative h-[52vh] min-h-[360px] w-full">
        {hero.banner || hero.poster ? (
          <img
            src={hero.banner || hero.poster || ""}
            alt={hero.title}
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-10 sm:px-8">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              Trending anime
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-5xl">{hero.title}</h1>
            {hero.overview && (
              <p className="mt-3 line-clamp-3 max-w-xl text-sm text-neutral-300 sm:text-base">
                {hero.overview}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimeHomeRows() {
  const { data: trending } = useQuery(trendingQO);
  const { data: popular } = useQuery(popularQO);
  const { data: top } = useQuery(topQO);
  const { data: seasonal } = useQuery(seasonalQO);
  const rows: [string, AnimeItem[] | undefined][] = [
    ["Trending Now", trending],
    ["Airing This Season", seasonal],
    ["All-Time Top Rated", top],
    ["Most Popular", popular],
  ];
  return (
    <div className="space-y-14 py-10">
      {rows.map(([title, items]) =>
        items && items.length > 0 ? <AnimeRow key={title} title={title} items={items} /> : null,
      )}
      {!trending && !popular && !top && !seasonal && (
        <div className="py-16 text-center text-sm text-neutral-500">Loading anime…</div>
      )}
    </div>
  );
}

function AnimeFilters({ search, onChange }: { search: Search; onChange: (u: Partial<Search>) => void }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={search.year}
          onChange={(e) => onChange({ year: e.target.value })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">Any year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={search.format}
          onChange={(e) => onChange({ format: e.target.value })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">Any format</option>
          {ANIME_FORMATS.map((f) => (
            <option key={f} value={f}>{f.replace("_", " ")}</option>
          ))}
        </select>
        <select
          value={search.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>{s.l}</option>
          ))}
        </select>
        {(search.q || search.genre || search.year || search.format || search.sort !== "popularity") && (
          <button
            onClick={() =>
              onChange({ q: "", genre: "", year: "", format: "", sort: "popularity", page: 1 })
            }
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
          >
            Reset
          </button>
        )}
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => onChange({ genre: "" })}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
            !search.genre
              ? "border-transparent text-black"
              : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
          }`}
          style={!search.genre ? { background: "var(--accent)" } : undefined}
        >
          All
        </button>
        {ANIME_GENRES.map((g) => {
          const active = search.genre === g;
          return (
            <button
              key={g}
              onClick={() => onChange({ genre: g })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-transparent text-black"
                  : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
              }`}
              style={active ? { background: "var(--accent)" } : undefined}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AnimeGrid({ search, onPage }: { search: Search; onPage: (p: number) => void }) {
  const { data, isFetching } = useQuery({
    queryKey: [
      "anime",
      "discover",
      search.q,
      search.genre,
      search.year,
      search.format,
      search.sort,
      search.page,
    ],
    queryFn: () =>
      animeDiscover({
        search: search.q,
        genre: search.genre,
        year: search.year,
        format: search.format,
        sort: search.sort,
        page: search.page,
      }),
    staleTime: 60_000,
  });

  const items = data?.results ?? [];

  return (
    <div className="space-y-8 py-8">
      <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 sm:gap-6 sm:px-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((it) => (
          <div key={it.id} className="w-full">
            <AnimeCard item={it} size="lg" />
          </div>
        ))}
      </div>
      {!isFetching && items.length === 0 && (
        <div className="py-16 text-center text-sm text-neutral-500">
          No anime match those filters.
        </div>
      )}
      {isFetching && (
        <div className="py-8 text-center text-sm text-neutral-500">Loading…</div>
      )}
      {data && items.length > 0 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            disabled={search.page <= 1}
            onClick={() => onPage(Math.max(1, search.page - 1))}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-neutral-400">Page {search.page}</span>
          <button
            disabled={!data.hasNextPage}
            onClick={() => onPage(search.page + 1)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
