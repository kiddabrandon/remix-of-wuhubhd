import { useQuery } from "@tanstack/react-query";
import { tmdbGenres } from "@/lib/tmdb.functions";

const YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() - i));
const SORTS = [
  { v: "popularity.desc", l: "Popular" },
  { v: "vote_average.desc", l: "Top Rated" },
  { v: "primary_release_date.desc", l: "Newest" },
  { v: "revenue.desc", l: "Blockbusters" },
];

export function FilterBar({
  type,
  genre,
  year,
  sort,
  onChange,
}: {
  type: "movie" | "tv";
  genre: string;
  year: string;
  sort: string;
  onChange: (u: { genre?: string; year?: string; sort?: string }) => void;
}) {
  const { data } = useQuery({
    queryKey: ["genres", type],
    queryFn: () => tmdbGenres({ data: { type } }),
    staleTime: 60 * 60_000,
  });
  const genres = data?.genres ?? [];

  return (
    <div className="space-y-4 px-4 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={year}
          onChange={(e) => onChange({ year: e.target.value })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none"
        >
          <option value="">Any year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none"
        >
          {SORTS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </select>
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => onChange({ genre: "" })}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
            !genre
              ? "border-transparent text-black"
              : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
          }`}
          style={!genre ? { background: "var(--accent)" } : undefined}
        >
          All
        </button>
        {genres.map((g) => {
          const active = String(g.id) === genre;
          return (
            <button
              key={g.id}
              onClick={() => onChange({ genre: String(g.id) })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-transparent text-black"
                  : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
              }`}
              style={active ? { background: "var(--accent)" } : undefined}
            >
              {g.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
