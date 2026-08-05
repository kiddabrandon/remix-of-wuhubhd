import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Play, Clock } from "lucide-react";
import { useApp, type ProgressItem } from "@/lib/app-store";
import { poster } from "@/lib/tmdb-utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Continue Watching — WuHubHD" },
      { name: "description", content: "Pick up where you left off on WuHubHD." },
      { property: "og:title", content: "Continue Watching — WuHubHD" },
      { property: "og:description", content: "Resume every movie and episode exactly where you stopped." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

/** Minimum seconds of playback before something counts as actually watched. */
const MIN_PLAYED = 30;

type Row = {
  item: ProgressItem;
  season: number | null;
  episode: number | null;
  position: number;
  duration: number;
  pct: number;
};

/**
 * Resolves the exact episode a title should resume at, using only per-episode
 * positions that have real playback. Titles with no real playback are dropped.
 */
function resolve(item: ProgressItem): Row | null {
  const positions = item.episode_positions ?? {};

  if (item.media_type === "movie") {
    const position = item.position_seconds ?? 0;
    const duration = item.duration_seconds ?? 0;
    if (position < MIN_PLAYED) return null;
    return {
      item,
      season: null,
      episode: null,
      position,
      duration,
      pct: duration > 0 ? Math.round((position / duration) * 100) : item.progress_pct,
    };
  }

  // Prefer the last-played episode; fall back to any episode with playback.
  const keyOf = (s: number, e: number) => `s${s}e${e}`;
  const candidates: { s: number; e: number; p: number; d: number }[] = [];
  for (const [key, value] of Object.entries(positions)) {
    const m = /^s(\d+)e(\d+)$/.exec(key);
    if (!m || !value || (value.p ?? 0) < MIN_PLAYED) continue;
    candidates.push({ s: Number(m[1]), e: Number(m[2]), p: value.p, d: value.d ?? 0 });
  }
  if (candidates.length === 0) return null;

  const lastKey = item.season != null && item.episode != null ? keyOf(item.season, item.episode) : null;
  const preferred =
    (lastKey ? candidates.find((c) => keyOf(c.s, c.e) === lastKey) : undefined) ??
    // otherwise the furthest-along episode
    candidates.sort((a, b) => a.s - b.s || a.e - b.e).at(-1)!;


  return {
    item,
    season: preferred.s,
    episode: preferred.e,
    position: preferred.p,
    duration: preferred.d,
    pct: preferred.d > 0 ? Math.round((preferred.p / preferred.d) * 100) : 0,
  };
}

function History() {
  const { progress } = useApp();

  const rows = useMemo(
    () =>
      progress
        .map(resolve)
        .filter((r): r is Row => r !== null)
        .sort((a, b) => +new Date(b.item.updated_at) - +new Date(a.item.updated_at)),
    [progress],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Continue Watching</h1>
      <p className="mt-1 text-sm text-neutral-400">Synced to your account, per episode.</p>

      {rows.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-white/10 p-8 text-center sm:mt-16 sm:p-12">
          <Clock className="mx-auto h-6 w-6 text-neutral-500" />
          <p className="mt-3 text-sm text-neutral-400">
            Nothing here yet. Play something for at least 30 seconds and it shows up here.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black"
            style={{ background: "var(--accent)" }}
          >
            Explore Discover
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {rows.map((r) => {
          const p = r.item;
          const src = poster(p.poster_path, "w342");
          const sub = r.season != null ? `S${r.season} · E${r.episode}` : "Movie";
          const left = r.duration > 0 ? Math.max(0, Math.round((r.duration - r.position) / 60)) : null;
          const pct = Math.max(3, Math.min(100, r.pct));
          return (
            <Link
              key={`${p.media_type}-${p.tmdb_id}`}
              to="/watch/$type/$id"
              params={{ type: p.media_type, id: String(p.tmdb_id) }}
              search={(r.season != null ? { s: r.season, e: r.episode } : undefined) as never}
              className="group flex gap-3 rounded-2xl border border-white/5 bg-neutral-950 p-3 transition hover:border-white/15 sm:gap-4"
            >
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                {src && <img src={src} alt={p.title} loading="lazy" className="h-full w-full object-cover" />}
                <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <Play className="h-5 w-5 fill-current" style={{ color: "var(--accent)" }} />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="text-xs tracking-widest text-neutral-500 uppercase">{sub}</div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold">{p.title}</div>
                <div className="mt-auto pt-3">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                  </div>
                  <div className="mt-1 text-[11px] text-neutral-500">
                    {left != null && left > 0 ? `${left} min left · ` : ""}
                    {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
