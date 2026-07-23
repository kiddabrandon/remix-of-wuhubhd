import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { PosterCard } from "./PosterCard";
import type { TmdbItem } from "@/lib/tmdb-utils";

export function Carousel({
  title,
  items,
  viewAllHref,
}: {
  title: string;
  items: TmdbItem[];
  viewAllHref?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="relative">
      <div className="mb-4 flex items-baseline justify-between gap-4 px-4 sm:px-8">
        <h2 className="text-lg font-semibold tracking-tight sm:text-2xl">
          <span
            className="mr-2 inline-block h-4 w-1 translate-y-0.5 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <a
              href={viewAllHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
            >
              View all <ArrowRight className="h-3 w-3" style={{ color: "var(--accent)" }} />
            </a>
          )}
          <div className="hidden gap-1 sm:flex">
            <button
              onClick={() => scroll(-1)}
              className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" style={{ color: "var(--accent)" }} />
            </button>
            <button
              onClick={() => scroll(1)}
              className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" style={{ color: "var(--accent)" }} />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={ref}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:px-8"
      >
        {items.map((it) => (
          <PosterCard key={`${it.id}-${it.media_type ?? ""}`} item={it} />
        ))}
      </div>
    </section>
  );
}

