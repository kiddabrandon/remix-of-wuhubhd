import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, ChevronUp, Search } from "lucide-react";
import { shortsFeed } from "@/lib/youtube.functions";
import { YoutubePlayer } from "@/components/youtube/YoutubePlayer";

export const Route = createFileRoute("/_authenticated/youtube/shorts")({
  head: () => ({
    meta: [
      { title: "Shorts — WuHubHD" },
      { name: "description", content: "Swipe through YouTube Shorts inside WuHubHD, with search and autoplay." },
      { property: "og:title", content: "Shorts — WuHubHD" },
      { property: "og:description", content: "A full-screen, swipeable Shorts feed built into WuHubHD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShortsPage,
});

function ShortsPage() {
  const feed = useServerFn(shortsFeed);
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("shorts");
  const [index, setIndex] = useState(0);
  const touchY = useRef<number | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ["shorts-feed", query],
    queryFn: () => feed({ data: { q: query, limit: 30 } }),
    staleTime: 5 * 60_000,
  });

  const shorts = data ?? [];
  const active = shorts[index];

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const go = (delta: number) => {
    setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(shorts.length - 1, 0)));
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <Link to="/youtube" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> YouTube
        </Link>
        <h1 className="font-display text-lg font-bold sm:text-xl">Shorts</h1>
      </div>

      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (term.trim()) setQuery(term.trim());
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-neutral-500" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search Shorts"
            aria-label="Search Shorts"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-600"
          />
        </label>
        <button type="submit" className="shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold text-black" style={{ background: "var(--accent)" }}>
          Go
        </button>
      </form>

      {isFetching && shorts.length === 0 && <p className="mt-10 text-sm text-neutral-500">Loading Shorts…</p>}
      {!isFetching && shorts.length === 0 && <p className="mt-10 text-sm text-neutral-500">No Shorts found. Try another search.</p>}

      {active && (
        <div className="mt-5 flex flex-col items-center">
          <div
            className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
            style={{ aspectRatio: "9/16" }}
            onWheel={(e) => {
              if (e.deltaY > 40) go(1);
              else if (e.deltaY < -40) go(-1);
            }}
            onTouchStart={(e) => {
              touchY.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchY.current;
              const end = e.changedTouches[0]?.clientY;
              if (start == null || end == null) return;
              if (start - end > 60) go(1);
              else if (end - start > 60) go(-1);
              touchY.current = null;
            }}
          >
            <YoutubePlayer key={active.id} videoId={active.id} vertical autoplay onEnded={() => go(1)} className="h-full w-full" />
          </div>

          <div className="mt-3 w-full max-w-[22rem]">
            <p className="line-clamp-2 text-sm font-medium">{active.title}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{active.views ?? ""}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="tabular-nums">
                {index + 1} / {shorts.length}
              </span>
              <button
                type="button"
                onClick={() => go(1)}
                disabled={index >= shorts.length - 1}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 disabled:opacity-30"
              >
                Next <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
