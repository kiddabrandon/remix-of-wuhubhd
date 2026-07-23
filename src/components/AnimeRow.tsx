import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeCard } from "./AnimeCard";
import type { AnimeItem } from "@/lib/anime.functions";

export function AnimeRow({ title, items }: { title: string; items: AnimeItem[] }) {
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
        <div className="hidden gap-1 sm:flex">
          <button
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--accent)" }} />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="rounded-full border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" style={{ color: "var(--accent)" }} />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 sm:px-8"
      >
        {items.map((it) => (
          <AnimeCard key={it.id} item={it} />
        ))}
      </div>
    </section>
  );
}
