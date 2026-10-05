import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { PosterCard } from "./PosterCard";
import { UpcomingCard } from "./UpcomingCard";
import type { TmdbItem } from "@/lib/tmdb-utils";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function Carousel({
  title,
  items,
  viewAllHref,
  upcoming,
}: {
  upcoming?: boolean;
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
    <section className="relative mx-auto max-w-[1600px]">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-8 lg:px-12">
        <h2 className="min-w-0 truncate font-display text-lg font-semibold tracking-normal sm:text-2xl">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link to={viewAllHref}>View all <ArrowRight /></Link>
            </Button>
          )}
          <div className="hidden gap-1 sm:flex">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll(-1)}
              className="h-8 w-8 bg-background/60"
              aria-label="Scroll left"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll(1)}
              className="h-8 w-8 bg-background/60"
              aria-label="Scroll right"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
      <div
        ref={ref}
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 sm:gap-4 sm:px-8 lg:px-12"
      >
        {items.map((it) => (
          upcoming ? <UpcomingCard key={`${it.id}-${it.media_type ?? ""}`} item={it} /> : <PosterCard key={`${it.id}-${it.media_type ?? ""}`} item={it} />
        ))}
      </div>
    </section>
  );
}

