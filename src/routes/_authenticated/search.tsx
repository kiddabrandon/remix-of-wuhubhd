import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { tmdbSearchMulti } from "@/lib/tmdb.functions";
import { PosterCard } from "@/components/PosterCard";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search — WuHubHD" },
      { name: "description", content: "Search movies and TV shows on WuHubHD." },
      { property: "og:title", content: "Search — WuHubHD" },
      { property: "og:description", content: "Search movies and TV shows." },
    ],
  }),
  component: SearchPage,
});

type Item = { id: number; title?: string; name?: string; poster_path?: string | null; media_type: "movie" | "tv"; release_date?: string; first_air_date?: string; vote_average?: number };

function SearchPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cls = useServerFn(tmdbSearchMulti);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await cls({ data: { query } });
      const rows = (r?.results ?? []) as Item[];
      setItems(
        rows.filter((x) => x.media_type === "movie" || x.media_type === "tv").slice(0, 30),
      );
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Search failed");
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Search</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Find movies and TV shows across TMDB.
      </p>

      <form onSubmit={run} className="mt-6 flex items-center gap-2">
        <input
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="Search movies & shows"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/20"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
          style={{ background: "var(--accent, #00D8FF)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
          Search
        </button>
      </form>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((it) => (
          <Link
            key={`${it.media_type}-${it.id}`}
            to="/watch/$type/$id"
            params={{ type: it.media_type, id: String(it.id) }}
          >
            <PosterCard item={it as never} />
          </Link>
        ))}
        {!busy && items.length === 0 && !err && (
          <div className="col-span-full py-12 text-center text-sm text-neutral-500">
            Try a title, actor, or franchise.
          </div>
        )}
      </div>
    </div>
  );
}
