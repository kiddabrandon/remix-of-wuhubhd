import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Youtube as YoutubeIcon, Zap } from "lucide-react";
import { searchYoutube, searchYoutubeChannels, searchYoutubeShorts } from "@/lib/youtube.functions";
import { ShortsRow } from "@/components/youtube/ShortsRow";
import { ChannelLink } from "@/components/youtube/ChannelLink";

export const Route = createFileRoute("/_authenticated/youtube/")({
  head: () => ({
    meta: [
      { title: "YouTube — WuHubHD" },
      { name: "description", content: "Search and watch YouTube videos, Shorts and channels without leaving WuHubHD." },
      { property: "og:title", content: "YouTube — WuHubHD" },
      { property: "og:description", content: "Search YouTube videos, Shorts and channels and play them inside WuHubHD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: YoutubePage,
});

const SUGGESTIONS = ["official trailer 2026", "anime openings", "movie reviews", "behind the scenes", "top 10 movies"];

type Tab = "videos" | "shorts" | "channels";

function YoutubePage() {
  const search = useServerFn(searchYoutube);
  const searchShorts = useServerFn(searchYoutubeShorts);
  const searchChannels = useServerFn(searchYoutubeChannels);
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("official trailer 2026");
  const [tab, setTab] = useState<Tab>("videos");

  const { data, isFetching } = useQuery({
    queryKey: ["youtube", query],
    queryFn: () => search({ data: { q: query } }),
    enabled: tab === "videos" && query.trim().length > 0,
    staleTime: 5 * 60_000,
  });

  const { data: shortsData } = useQuery({
    queryKey: ["youtube-shorts", query],
    queryFn: () => searchShorts({ data: { q: query, limit: 14 } }),
    enabled: query.trim().length > 0 && tab !== "channels",
    staleTime: 5 * 60_000,
  });

  const { data: channelsData, isFetching: channelsLoading } = useQuery({
    queryKey: ["youtube-channels", query],
    queryFn: () => searchChannels({ data: { q: query, limit: 20 } }),
    enabled: tab === "channels" && query.trim().length > 0,
    staleTime: 5 * 60_000,
  });

  const videos = data ?? [];
  const shorts = shortsData ?? [];
  const channels = channelsData ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <YoutubeIcon className="h-5 w-5" style={{ color: "#FF0033" }} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">YouTube</h1>
            <p className="truncate text-xs text-neutral-400">Videos, Shorts and channels — all in app.</p>
          </div>
        </div>
        <Link
          to="/youtube/shorts"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold hover:bg-white/10"
        >
          <Zap className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} /> Shorts feed
        </Link>
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
            placeholder="Search videos, Shorts or channels"
            aria-label="Search YouTube"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-600"
          />
        </label>
        <button type="submit" className="shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold text-black" style={{ background: "var(--accent)" }}>
          Search
        </button>
      </form>

      <div className="mt-4 flex gap-2">
        {(["videos", "shorts", "channels"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
              tab === t ? "border-transparent bg-white/15 text-white" : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

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

      {tab === "channels" ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {channelsLoading && channels.length === 0 && <p className="text-sm text-neutral-500">Searching channels…</p>}
          {!channelsLoading && channels.length === 0 && <p className="text-sm text-neutral-500">No channels found.</p>}
          {channels.map((c) => (
            <Link
              key={c.id}
              to="/youtube/channel/$channelId"
              params={{ channelId: c.id }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
            >
              {c.avatar ? (
                <img src={c.avatar} alt={c.title} loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-full bg-neutral-800" />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.title}</div>
                <div className="truncate text-[11px] text-neutral-500">
                  {[c.subscribers, c.videoCount].filter(Boolean).join(" · ")}
                </div>
                {c.description && <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">{c.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : tab === "shorts" ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shorts.length === 0 && <p className="text-sm text-neutral-500">No Shorts found.</p>}
          {shorts.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate({ to: "/youtube/$id", params: { id: s.id }, search: { shorts: 1 } as never })}
              className="group text-left"
            >
              <div className="relative w-full overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5" style={{ aspectRatio: "9/16" }}>
                <img src={s.thumbnail} alt={s.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
              </div>
              <div className="mt-1.5 line-clamp-2 text-xs font-medium">{s.title}</div>
              {s.views && <div className="text-[11px] text-neutral-500">{s.views}</div>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <ShortsRow shorts={shorts} />

          {isFetching && videos.length === 0 && <p className="mt-10 text-sm text-neutral-500">Searching YouTube…</p>}
          {!isFetching && videos.length === 0 && <p className="mt-10 text-sm text-neutral-500">No results. Try another search.</p>}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((v) => (
              <div key={v.id} className="group text-left">
                <button type="button" onClick={() => navigate({ to: "/youtube/$id", params: { id: v.id } })} className="block w-full text-left">
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5">
                    <img src={v.thumbnail} alt={v.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-medium">{v.title}</div>
                </button>
                <div className="mt-0.5 truncate text-xs text-neutral-500">
                  <ChannelLink channelId={v.channelId} name={v.channel} />
                  {v.published ? ` · ${v.published}` : ""}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
