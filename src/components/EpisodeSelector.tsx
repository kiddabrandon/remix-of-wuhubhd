import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Play, Search } from "lucide-react";
import { tmdbSeason } from "@/lib/tmdb.functions";
import { poster } from "@/lib/tmdb-utils";
import { useApp } from "@/lib/app-store";

export function EpisodeSelector({
  tvId,
  seasons,
  season,
  episode,
  onChange,
}: {
  tvId: number;
  seasons: { season_number: number; name: string; episode_count: number }[];
  season: number;
  episode: number;
  onChange: (s: number, e: number) => void;
}) {
  const { progressFor } = useApp();
  const prog = progressFor(tvId, "tv");
  const positions = prog?.episode_positions ?? {};
  const [q, setQ] = useState("");

  const realSeasons = seasons.filter((s) => s.season_number > 0);

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ["season", tvId, season],
    queryFn: () => tmdbSeason({ data: { id: tvId, season } }),
    staleTime: 5 * 60_000,
  });

  const episodes = (seasonData?.episodes ?? []) as any[];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return episodes;
    return episodes.filter(
      (ep) =>
        String(ep.episode_number) === needle ||
        (ep.name ?? "").toLowerCase().includes(needle),
    );
  }, [episodes, q]);

  /** An episode only counts as watched once it actually has saved playback. */
  const stateFor = (n: number): "unwatched" | "started" | "watched" => {
    const entry = positions[`s${season}e${n}`];
    if (!entry || !entry.p || entry.p < 30) return "unwatched";
    if (entry.d > 0 && entry.p / entry.d >= 0.9) return "watched";
    return "started";
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0b0b0c]">
      <div className="grid gap-2 border-b border-white/5 p-3 sm:grid-cols-2">
        {/* Season dropdown — scales to shows with 20+ seasons/arcs. */}
        <select
          value={season}
          onChange={(e) => onChange(Number(e.target.value), 1)}
          className="w-full min-w-0 rounded-lg border border-white/10 bg-black px-2.5 py-2 text-xs text-neutral-100 outline-none focus:border-white/25"
        >
          {realSeasons.map((s) => (
            <option key={s.season_number} value={s.season_number}>
              {s.name || `Season ${s.season_number}`} ({s.episode_count})
            </option>
          ))}
        </select>

        <label className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to episode or title"
            className="w-full min-w-0 bg-transparent text-xs outline-none placeholder:text-neutral-600"
          />
        </label>
      </div>


      <div className="scrollbar-none flex-1 overflow-y-auto p-2">
        {isLoading && <div className="p-4 text-sm text-neutral-500">Loading episodes...</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">No episodes match “{q}”.</div>
        )}
        {filtered.map((ep) => {
          const active = ep.episode_number === episode;
          const state = stateFor(ep.episode_number);
          const still = poster(ep.still_path, "w185");
          return (
            <button
              key={ep.id}
              onClick={() => onChange(season, ep.episode_number)}
              className={`group flex w-full items-start gap-3 rounded-xl p-2 text-left transition ${
                active ? "bg-accent-soft ring-1 ring-[var(--accent)]" : "hover:bg-white/5"
              }`}
            >
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                {still ? (
                  <img src={still} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-neutral-500">Ep {ep.episode_number}</div>
                )}
                {active && (
                  <div className="absolute inset-0 grid place-items-center bg-black/60">
                    <Play className="h-5 w-5 fill-current" style={{ color: "var(--accent)" }} />
                  </div>
                )}
                {state === "started" && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            ((positions[`s${season}e${ep.episode_number}`]?.p ?? 0) /
                              Math.max(1, positions[`s${season}e${ep.episode_number}`]?.d ?? 1)) * 100,
                          ),
                        )}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-neutral-500">E{ep.episode_number}</span>
                  {state === "watched" && <Check className="h-3 w-3 text-emerald-400" />}
                </div>
                <div className="line-clamp-1 text-sm font-medium">{ep.name}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{ep.overview}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
