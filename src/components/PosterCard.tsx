import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { useRef, useState } from "react";
import { poster, titleOf, yearOf, mediaTypeOf, type TmdbItem } from "@/lib/tmdb-utils";
import { tmdbTrailerKey } from "@/lib/tmdb.functions";

export function PosterCard({ item, size = "md" }: { item: TmdbItem; size?: "sm" | "md" | "lg" }) {
  const type = mediaTypeOf(item);
  const w = size === "sm" ? "w-32" : size === "lg" ? "w-52" : "w-40";
  const src = poster(item.poster_path, "w342");
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

  const [hovering, setHovering] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerErrored, setTrailerErrored] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Guard the trailer query so a fetch error never crashes the card.
  const { data: trailer } = useQuery({
    queryKey: ["trailer", type, item.id],
    queryFn: async () => {
      try {
        return await tmdbTrailerKey({ data: { type, id: item.id } });
      } catch {
        return null;
      }
    },
    enabled: hovering && !trailerErrored,
    retry: false,
    staleTime: 10 * 60_000,
  });
  const trailerKey = trailer?.key ?? null;

  const onEnter = () => {
    setHovering(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShowTrailer(true), 1500);
  };
  const onLeave = () => {
    setHovering(false);
    setShowTrailer(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
  };

  return (
    <Link
      to="/watch/$type/$id"
      params={{ type, id: String(item.id) }}
      className={`group shrink-0 ${w} snap-start`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <motion.div
        whileHover={{ y: -4, scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5"
      >
        {src ? (
          <img
            loading="lazy"
            src={src}
            alt={titleOf(item)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">{titleOf(item)}</div>
        )}
        {showTrailer && trailerKey && !trailerErrored && (
          <iframe
            title="preview"
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&modestbranding=1&playsinline=1&showinfo=0&rel=0`}
            className="absolute inset-0 h-full w-full scale-[1.35] opacity-90 transition-opacity"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="autoplay; encrypted-media"
            referrerPolicy="no-referrer"
            onError={() => setTrailerErrored(true)}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {rating && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            <Star className="h-3 w-3 fill-current" style={{ color: "var(--accent)" }} />
            <span>{rating}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="line-clamp-2 text-sm font-medium">{titleOf(item)}</div>
          <div className="text-xs text-neutral-400">{yearOf(item)}</div>
        </div>
      </motion.div>
      <div className="mt-2 truncate text-sm text-neutral-200 group-hover:text-white">{titleOf(item)}</div>
      <div className="text-xs text-neutral-500">{yearOf(item)}</div>
    </Link>
  );
}
