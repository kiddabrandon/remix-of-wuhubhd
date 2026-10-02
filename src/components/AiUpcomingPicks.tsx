import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { aiUpcomingPicks } from "@/lib/ai-picks.functions";
import { UpcomingCard } from "./UpcomingCard";

const GENRES = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Fantasy", "Romance", "Thriller", "Animation", "Anime", "Crime", "Documentary", "Mystery", "Family"];
const KEY = "wuhub:fav-genres";

export function AiUpcomingPicks() {
  const [genres, setGenres] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setGenres(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {}
  }, []);

  const toggle = (g: string) => {
    const next = genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g];
    setGenres(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await aiUpcomingPicks({ data: { genres } });
      setItems(r.results);
      if (!r.results.length) setError("No matches found — try other genres.");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-4 sm:px-8">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-2xl">
        <Sparkles className="h-5 w-5" style={{ color: "var(--accent)" }} /> AI Picks: Coming Soon For You
      </h2>
      <p className="mb-3 text-xs text-neutral-400">Choose your favourite genres and get upcoming titles picked for you.</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {GENRES.map((g) => {
          const on = genres.includes(g);
          return (
            <button
              key={g}
              onClick={() => toggle(g)}
              className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-transparent font-semibold text-black" : "border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10"}`}
              style={on ? { background: "var(--accent)" } : undefined}
            >
              {g}
            </button>
          );
        })}
      </div>
      <button
        onClick={run}
        disabled={!genres.length || loading}
        className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Finding picks…" : "Recommend for me"}
      </button>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {items.length > 0 && (
        <div className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-4">
          {items.map((it) => (
            <div key={`${it.media_type}-${it.id}`} className="w-40 shrink-0">
              <UpcomingCard item={it} />
              {it.reason && <p className="mt-1 line-clamp-3 text-[11px] text-neutral-400">{it.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
