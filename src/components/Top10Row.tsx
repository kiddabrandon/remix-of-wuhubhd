import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { poster, titleOf, mediaTypeOf, type TmdbItem } from "@/lib/tmdb-utils";

/**
 * A numbered horizontal row with slow autoscroll. The huge outlined
 * numerals sit behind each poster, magazine-cover style.
 */
export function Top10Row({ items }: { items: TmdbItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = t - last;
      last = t;
      if (!paused.current && el.scrollWidth > el.clientWidth + 4) {
        const max = el.scrollWidth - el.clientWidth;
        const next = el.scrollLeft + (dt / 1000) * 40; // ~40px/s
        el.scrollLeft = next >= max ? 0 : next;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const list = items.slice(0, 10);

  return (
    <section className="relative">
      <div className="mb-4 flex items-baseline justify-between gap-4 px-4 sm:px-8">
        <h2 className="text-lg font-semibold tracking-tight sm:text-2xl">
          <span
            className="mr-2 inline-block h-4 w-1 translate-y-0.5 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          Top 10 Right Now
        </h2>
        <span className="text-[11px] uppercase tracking-widest text-neutral-500">Auto-scrolling</span>
      </div>
      <div
        ref={ref}
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onTouchStart={() => (paused.current = true)}
        onTouchEnd={() => (paused.current = false)}
        onWheel={() => (paused.current = true)}
        className="scrollbar-none flex gap-8 overflow-x-auto overscroll-x-contain px-4 pb-6 sm:px-8"
      >
        {list.map((it, i) => {
          const src = poster(it.poster_path, "w342");
          const type = mediaTypeOf(it);
          return (
            <Link
              key={`${it.id}-${i}`}
              to="/watch/$type/$id"
              params={{ type, id: String(it.id) }}
              className="group relative flex shrink-0 items-end gap-2 last:pr-4 sm:last:pr-8"
            >
              <span
                aria-hidden
                className="pointer-events-none select-none font-display text-[9rem] font-black leading-none tracking-tighter sm:text-[12rem]"
                style={{
                  WebkitTextStroke: "2px rgba(255,255,255,0.25)",
                  color: "transparent",
                  textShadow: "0 0 40px color-mix(in oklab, var(--accent) 25%, transparent)",
                }}
              >
                {i + 1}
              </span>
              <div className="relative -ml-6 w-40 shrink-0 sm:w-48">
                <div className="aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10 transition group-hover:ring-white/30">
                  {src && (
                    <img
                      src={src}
                      alt={titleOf(it)}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <div className="mt-2 truncate text-sm font-medium">{titleOf(it)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
