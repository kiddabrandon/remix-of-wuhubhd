import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Youtube as YoutubeIcon } from "lucide-react";
import { searchYoutube } from "@/lib/youtube.functions";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/_authenticated/youtube/")({
  head: () => ({
    meta: [
      { title: "YouTube — WuHubHD" },
      { name: "description", content: "Search and watch YouTube videos without leaving WuHubHD." },
      { property: "og:title", content: "YouTube — WuHubHD" },
      { property: "og:description", content: "Search YouTube and play videos inside WuHubHD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: YoutubePage,
});

const SUGGESTIONS = ["official trailer 2026", "anime openings", "movie reviews", "behind the scenes", "top 10 movies"];

function YoutubePage() {
  const { settings } = useApp();
  const search = useServerFn(searchYoutube);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("official trailer 2026");

  const { data, isFetching } = useQuery({
    queryKey: ["youtube", query],
    queryFn: () => search({ data: { q: query } }),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60_000,
  });

  const videos = data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <YoutubeIcon className="h-5 w-5" style={{ color: "#FF0033" }} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">YouTube</h1>
            <p className="truncate text-xs text-neutral-400">Search and play without leaving the app.</p>
          </div>
        </div>
      </header>

      <form
        className="mt-6 flex items-center gap-2"
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
            placeholder="Search YouTube"
            aria-label="Search YouTube"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-600"
          />
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold text-black"
          style={{ background: "var(--accent)" }}
        >
          Search
        </button>
      </form>

      <div className="scrollbar-none mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTerm(s);
              setQuery(s);
            }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
              query === s ? "border-transparent bg-white/15 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {isFetching && videos.length === 0 && (
        <p className="mt-10 text-sm text-neutral-500">Searching YouTube…</p>
      )}
      {!isFetching && videos.length === 0 && (
        <p className="mt-10 text-sm text-neutral-500">No results. Try another search.</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {videos.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => navigate({ to: "/youtube/$id", params: { id: v.id } })}
            className="group text-left"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5">
              <img
                src={v.thumbnail}
                alt={v.title}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
            </div>
            <div className="mt-2 line-clamp-2 text-sm font-medium">{v.title}</div>
            <div className="mt-0.5 truncate text-xs text-neutral-500">
              {v.channel}
              {v.published ? ` · ${v.published}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
