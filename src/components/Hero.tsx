import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Play, Plus, Check, Star, Info } from "lucide-react";
import { backdrop, titleOf, yearOf, mediaTypeOf, type TmdbItem } from "@/lib/tmdb-utils";
import { useApp } from "@/lib/app-store";
import { Button } from "@/components/ui/button";

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
    <section className="relative h-[70svh] min-h-[500px] max-h-[760px] w-full overflow-hidden md:h-[72vh]">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {bg && <img src={bg} alt="" className="h-full w-full object-cover object-center" />}
        </motion.div>
      </AnimatePresence>

      <div className="hero-scrim absolute inset-0" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1600px] items-end px-4 pb-16 sm:px-8 md:items-center md:px-12 md:pb-4 lg:px-16">
        <motion.div
          key={item.id + "-content"}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-xl pt-20 md:max-w-2xl"
        >
          <div className="mb-4 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span className="rounded border border-border bg-background/40 px-2.5 py-1 uppercase tracking-widest backdrop-blur-md">
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
          <h1 className="font-display text-4xl leading-[1.02] font-bold tracking-normal sm:text-6xl md:text-7xl">
            {titleOf(item)}
          </h1>
          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base">{item.overview}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11 bg-accent px-6 font-bold text-accent-foreground hover:bg-accent/90">
              <Link to="/watch/$type/$id" params={{ type, id: String(item.id) }}>
                <Play className="fill-current" /> Watch now
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                toggleWatch({
                  id: item.id,
                  type,
                  title: titleOf(item),
                  poster: item.poster_path ?? null,
                  year: yearOf(item),
                })
              }
              className="h-11 border border-border bg-secondary/75 px-6 font-semibold backdrop-blur-md hover:bg-secondary"
            >
              {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saved ? "In Watchlist" : "Add to Watchlist"}
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-11 w-11 border border-border bg-background/35 backdrop-blur-md hover:bg-secondary" aria-label="View title details">
              <Link to="/watch/$type/$id" params={{ type, id: String(item.id) }}>
                <Info />
              </Link>
            </Button>
          </div>

          {featured.length > 1 && (
            <div className="mt-10 flex gap-2">
              {featured.map((_, i) => (
                <Button
                  variant="ghost"
                  size="icon"
                  key={i}
                  onClick={() => setIdx(i)}
                  className="h-7 w-8 rounded-none p-0"
                  aria-label={`Go to slide ${i + 1}`}
                >
                  <div
                    className="h-0.5 w-full bg-border transition-colors"
                    style={{
                      background: i === idx ? "var(--accent)" : undefined,
                    }}
                  />
                </Button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
