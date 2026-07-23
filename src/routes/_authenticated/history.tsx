import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Clock } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { poster } from "@/lib/tmdb-utils";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Continue Watching — CinehubHD" },
      { name: "description", content: "Pick up where you left off." },
    ],
  }),
  component: History,
});

function History() {
  const { progress } = useApp();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Continue Watching</h1>
      <p className="mt-1 text-sm text-neutral-400">Synced to your account.</p>

      {progress.length === 0 && (
        <div className="mt-16 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <Clock className="mx-auto h-6 w-6 text-neutral-500" />
          <p className="mt-3 text-neutral-400">Nothing here yet. Play something to see it here.</p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black"
            style={{ background: "var(--accent)" }}
          >
            Explore Discover
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {progress.map((p) => {
          const src = poster(p.poster_path, "w342");
          const sub =
            p.media_type === "tv" && p.season && p.episode ? `S${p.season} · E${p.episode}` : "Movie";
          const params =
            p.media_type === "tv" && p.season && p.episode
              ? { s: p.season, e: p.episode }
              : undefined;
          return (
            <Link
              key={`${p.media_type}-${p.tmdb_id}`}
              to="/watch/$type/$id"
              params={{ type: p.media_type, id: String(p.tmdb_id) }}
              search={params as any}
              className="group flex gap-4 rounded-2xl border border-white/5 bg-neutral-950 p-3 transition hover:border-white/15"
            >
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <Play className="h-5 w-5 fill-current" style={{ color: "var(--accent)" }} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs tracking-widest text-neutral-500 uppercase">{sub}</div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold">{p.title}</div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full"
                    style={{ width: `${Math.max(3, Math.min(100, p.progress_pct))}%`, background: "var(--accent)" }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  Last watched {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
