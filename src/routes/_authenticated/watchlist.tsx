import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, Play } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { poster } from "@/lib/tmdb-utils";

export const Route = createFileRoute("/_authenticated/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Nocturne" },
      { name: "description", content: "Titles you've saved to watch later." },
    ],
  }),
  component: Watchlist,
});

function Watchlist() {
  const { watchlist, toggleWatch, hydrated } = useApp();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Watchlist</h1>
      <p className="mt-1 text-sm text-neutral-400">Saved locally on this device.</p>

      {hydrated && watchlist.length === 0 && (
        <div className="mt-16 rounded-2xl border border-dashed border-white/10 p-12 text-center">
          <p className="text-neutral-400">Your watchlist is empty.</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black"
            style={{ background: "var(--accent)" }}
          >
            Explore Discover
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {watchlist.map((w) => {
          const src = poster(w.poster, "w342");
          return (
            <div key={`${w.type}-${w.id}`} className="group relative">
              <Link
                to="/watch/$type/$id"
                params={{ type: w.type, id: String(w.id) }}
                className="block overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5"
              >
                <div className="relative aspect-[2/3]">
                  {src ? (
                    <img src={src} alt={w.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center p-2 text-xs text-neutral-500">{w.title}</div>
                  )}
                  {/* Desktop hover overlay: darken + hide title, show actions */}
                  <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:block" />
                </div>
              </Link>

              {/* Desktop: title below card, fades out on hover */}
              <div className="mt-2 hidden truncate text-sm transition-opacity duration-300 group-hover:opacity-0 md:block">
                {w.title}
              </div>
              <div className="hidden text-xs text-neutral-500 transition-opacity duration-300 group-hover:opacity-0 md:block">
                {w.year}
              </div>

              {/* Mobile/tablet: always-visible title (no hover) */}
              <div className="mt-2 truncate text-sm md:hidden">{w.title}</div>
              <div className="text-xs text-neutral-500 md:hidden">{w.year}</div>

              {/* Action overlay: appears on hover for desktop, always visible on touch */}
              <div
                className="pointer-events-none absolute inset-x-2 bottom-[3.75rem] flex gap-2 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100 md:bottom-[3.75rem] [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
              >
                <Link
                  to="/watch/$type/$id"
                  params={{ type: w.type, id: String(w.id) }}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-full py-1.5 text-xs font-semibold text-black shadow-lg"
                  style={{ background: "var(--accent)" }}
                >
                  <Play className="h-3 w-3 fill-current" /> Play
                </Link>
                <button
                  onClick={() =>
                    toggleWatch({ id: w.id, type: w.type, title: w.title, poster: w.poster, year: w.year })
                  }
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-red-500/80"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
