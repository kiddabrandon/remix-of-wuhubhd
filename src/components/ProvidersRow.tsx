import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";

export const PROVIDERS = [
  { id: "8", name: "Netflix", color: "#E50914" },
  { id: "9", name: "Prime Video", color: "#00A8E1" },
  { id: "337", name: "Disney+", color: "#0D3AAF" },
  { id: "1899", name: "Max", color: "#8E5CFF" },
  { id: "15", name: "Hulu", color: "#1CE783" },
  { id: "531", name: "Paramount+", color: "#0064FF" },
  { id: "350", name: "Apple TV+", color: "#FFFFFF" },
];

export function ProvidersRow() {
  return (
    <section className="relative -mt-16 px-4 sm:px-8">
      <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
        {PROVIDERS.map((p) => (
          <Link
            key={p.id}
            to="/browse/$provider"
            params={{ provider: p.id }}
            className="group shrink-0"
          >
            <motion.div
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-5 backdrop-blur-lg transition-colors group-hover:border-white/25"
              style={{
                boxShadow: `inset 0 0 0 1px rgba(255,255,255,.02)`,
              }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-lg text-xs font-bold"
                style={{ background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}55` }}
              >
                {p.name[0]}
              </span>
              <span className="text-sm font-medium text-neutral-200 transition-colors group-hover:text-white">
                {p.name}
              </span>
            </motion.div>
          </Link>
        ))}
      </div>
    </section>
  );
}
