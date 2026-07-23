import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shuffle, Play, Star, Calendar } from "lucide-react";
import { backdrop, mediaTypeOf, titleOf, yearOf, type TmdbItem } from "@/lib/tmdb-utils";

/**
 * "Tonight's Pick" spotlight card — a large editorial hero picked from
 * a curated pool. Shuffles to a new pick on click.
 */
export function TonightsPick({ pool }: { pool: TmdbItem[] }) {
  const filtered = useMemo(
    () => pool.filter((p) => p.backdrop_path && p.overview),
    [pool],
  );
  const [idx, setIdx] = useState(0);

  if (!filtered.length) return null;
  const item = filtered[idx % filtered.length];
  const type = mediaTypeOf(item);
  const bg = backdrop(item.backdrop_path, "w1280");

  const shuffle = () => {
    if (filtered.length < 2) return;
    let n = idx;
    while (n === idx) n = Math.floor(Math.random() * filtered.length);
    setIdx(n);
  };

  return (
    <section className="px-4 sm:px-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight sm:text-2xl">
          <span
            className="mr-2 inline-block h-4 w-1 translate-y-0.5 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          Tonight&apos;s Pick
        </h2>
        <button
          onClick={shuffle}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium hover:border-white/25"
        >
          <Shuffle className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
          Shuffle
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.article
          key={`${item.id}-${idx}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950"
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
            {bg && (
              <img
                src={bg}
                alt={titleOf(item)}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/10" />
            <div
              className="pointer-events-none absolute -inset-16 opacity-40 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle at 20% 80%, var(--accent) 0%, transparent 60%)",
              }}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-5 sm:gap-4 sm:p-8 md:p-10">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-300 sm:text-xs">
              <span
                className="rounded-full border px-2.5 py-0.5 font-semibold uppercase tracking-widest"
                style={{
                  borderColor: "color-mix(in oklab, var(--accent) 60%, transparent)",
                  color: "var(--accent)",
                  background: "color-mix(in oklab, var(--accent) 12%, transparent)",
                }}
              >
                Tonight
              </span>
              <span className="rounded-full border border-white/15 px-2.5 py-0.5 uppercase tracking-widest">
                {type === "movie" ? "Movie" : "Series"}
              </span>
              {yearOf(item) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5">
                  <Calendar className="h-3 w-3" />
                  {yearOf(item)}
                </span>
              )}
              {item.vote_average ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5">
                  <Star className="h-3 w-3 fill-current" style={{ color: "var(--accent)" }} />
                  {item.vote_average.toFixed(1)}
                </span>
              ) : null}
            </div>
            <h3 className="font-display max-w-3xl text-2xl font-bold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
              {titleOf(item)}
            </h3>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-300/90 line-clamp-2 sm:line-clamp-3 sm:text-base">
              {item.overview}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <Link
                to="/watch/$type/$id"
                params={{ type, id: String(item.id) }}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow-lg transition hover:brightness-110 sm:px-6 sm:py-3"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 10px 30px -8px color-mix(in oklab, var(--accent) 55%, transparent)",
                }}
              >
                <Play className="h-4 w-4 fill-current" /> Play now
              </Link>
              <button
                onClick={shuffle}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-neutral-100 backdrop-blur transition hover:border-white/40 hover:bg-white/10 sm:px-6 sm:py-3"
              >
                <Shuffle className="h-4 w-4" /> Not tonight
              </button>
            </div>
          </div>
        </motion.article>
      </AnimatePresence>
    </section>
  );
}
