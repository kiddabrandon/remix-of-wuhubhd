import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Play, Plus, Check, Star } from "lucide-react";
import { backdrop, titleOf, yearOf, mediaTypeOf, type TmdbItem } from "@/lib/tmdb-utils";
import { useApp } from "@/lib/app-store";

export function Hero({ items }: { items: TmdbItem[] }) {
  const [idx, setIdx] = useState(0);
  const featured = items.slice(0, 5);
  const item = featured[idx];
  const { inWatchlist, toggleWatch } = useApp();

  useEffect(() => {
    if (featured.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % featured.length), 8000);
    return () => clearInterval(t);
  }, [featured.length]);

  if (!item) return null;
  const type = mediaTypeOf(item);
  const bg = backdrop(item.backdrop_path, "original");
  const saved = inWatchlist(item.id, type);

  return (
    <section className="relative h-[62vh] min-h-[420px] w-full overflow-hidden sm:h-[78vh] sm:min-h-[520px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {bg && <img src={bg} alt="" className="h-full w-full object-cover" />}
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />

      <div className="relative z-10 flex h-full items-end px-4 pb-8 sm:items-center sm:px-12 sm:pb-0">
        <motion.div
          key={item.id + "-content"}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl"
        >
          <div className="mb-3 flex items-center gap-3 text-xs text-neutral-400">
            <span className="rounded-full border border-white/15 px-2.5 py-0.5 uppercase tracking-widest">
              {type === "movie" ? "Movie" : "Series"}
            </span>
            <span>{yearOf(item)}</span>
            {item.vote_average ? (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-current" style={{ color: "var(--accent)" }} />
                {item.vote_average.toFixed(1)}
              </span>
            ) : null}
          </div>
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl md:text-7xl">
            {titleOf(item)}
          </h1>
          <p className="mt-4 line-clamp-3 max-w-xl text-sm text-neutral-300 sm:text-base">{item.overview}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/watch/$type/$id"
              params={{ type, id: String(item.id) }}
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-black transition"
              style={{ background: "var(--accent)" }}
            >
              <Play className="h-4 w-4 fill-current" />
              Watch Now
            </Link>
            <button
              onClick={() =>
                toggleWatch({
                  id: item.id,
                  type,
                  title: titleOf(item),
                  poster: item.poster_path ?? null,
                  year: yearOf(item),
                })
              }
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium backdrop-blur transition hover:bg-white/10"
            >
              {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saved ? "In Watchlist" : "Add to Watchlist"}
            </button>
          </div>

          {featured.length > 1 && (
            <div className="mt-10 flex gap-2">
              {featured.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className="h-0.5 w-8 overflow-hidden rounded-full bg-white/20"
                  aria-label={`Go to slide ${i + 1}`}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      background: i === idx ? "var(--accent)" : "transparent",
                      width: i === idx ? "100%" : "0%",
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
