import { useQuery } from "@tanstack/react-query";
import { Check, Play } from "lucide-react";
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
  const watched = new Set(progressFor(tvId, "tv")?.watched_episodes ?? []);

  const { data: seasonData, isLoading } = useQuery({
    queryKey: ["season", tvId, season],
    queryFn: () => tmdbSeason({ data: { id: tvId, season } }),
    staleTime: 5 * 60_000,
  });

  const episodes = seasonData?.episodes ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0b0b0c]">
      <div className="border-b border-white/5 p-4">
        <label className="mb-1.5 block text-[11px] tracking-widest text-neutral-500 uppercase">Season</label>
        <select
          value={season}
          onChange={(e) => onChange(Number(e.target.value), 1)}
          className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        >
          {seasons
            .filter((s) => s.season_number > 0)
            .map((s) => (
              <option key={s.season_number} value={s.season_number}>
                {s.name} ({s.episode_count} eps)
              </option>
            ))}
        </select>
      </div>
      <div className="scrollbar-none flex-1 overflow-y-auto p-2">
        {isLoading && <div className="p-4 text-sm text-neutral-500">Loading episodes...</div>}
        {episodes.map((ep: any) => {
          const active = ep.episode_number === episode;
          const isWatched = watched.has(`s${season}e${ep.episode_number}`);
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
                  <img src={still} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-neutral-500">Ep {ep.episode_number}</div>
                )}
                {active && (
                  <div className="absolute inset-0 grid place-items-center bg-black/60">
                    <Play className="h-5 w-5 fill-current" style={{ color: "var(--accent)" }} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-neutral-500">E{ep.episode_number}</span>
                  {isWatched && <Check className="h-3 w-3 text-neutral-500" />}
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
