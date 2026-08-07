import { useNavigate } from "@tanstack/react-router";
import type { YoutubeShort } from "@/lib/youtube.functions";
import { Zap } from "lucide-react";

export function ShortsRow({ shorts }: { shorts: YoutubeShort[] }) {
  const navigate = useNavigate();
  if (shorts.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        <Zap className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /> Shorts
      </h2>
      <div className="scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {shorts.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              navigate({
                to: "/youtube/$id",
                params: { id: s.id },
                search: { shorts: 1 } as never,
              })
            }
            className="group w-32 shrink-0 text-left sm:w-40"
          >
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5">
              <img
                src={s.thumbnail}
                alt={s.title}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                <div className="line-clamp-2 text-[11px] font-medium text-white">{s.title}</div>
                {s.views && <div className="mt-0.5 text-[10px] text-neutral-300">{s.views}</div>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
