import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import type { AnimeItem } from "@/lib/anime.functions";

export function AnimeCard({ item, size = "md" }: { item: AnimeItem; size?: "sm" | "md" | "lg" }) {
  const w = size === "sm" ? "w-32" : size === "lg" ? "w-52" : "w-40";
  return (
    <Link
      to="/anime/$id"
      params={{ id: String(item.id) }}
      className={`group shrink-0 ${w} snap-start`}
    >
      <motion.div
        whileHover={{ y: -4, scale: 1.03 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5"
      >
        {item.poster ? (
          <img
            loading="lazy"
            src={item.poster}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-neutral-500">
            {item.title}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {item.score != null && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
            <Star className="h-3 w-3 fill-current" style={{ color: "var(--accent)" }} />
            <span>{item.score.toFixed(1)}</span>
          </div>
        )}
      </motion.div>
      <div className="mt-2 truncate text-sm text-neutral-200 group-hover:text-white">
        {item.title}
      </div>
      <div className="text-xs text-neutral-500">
        {[item.year, item.episodes ? `${item.episodes} ep` : null].filter(Boolean).join(" · ")}
      </div>
    </Link>
  );
}
