import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { searchYoutube, searchYoutubeShorts, youtubeVideoInfo } from "@/lib/youtube.functions";
import { YoutubePlayer } from "@/components/youtube/YoutubePlayer";
import { ChannelLink } from "@/components/youtube/ChannelLink";

const WatchSearchSchema = z.object({ shorts: z.union([z.literal(1), z.literal(0)]).optional() });

export const Route = createFileRoute("/_authenticated/youtube/$id")({
  validateSearch: (s: unknown) => WatchSearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Watch on YouTube — WuHubHD" },
      { name: "description", content: "Play a YouTube video or Short inside WuHubHD with related results." },
      { property: "og:title", content: "Watch on YouTube — WuHubHD" },
      {
        property: "og:description",
        content: "Full-screen YouTube playback with related videos, inside WuHubHD.",
      },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: YoutubeWatch,
});

function YoutubeWatch() {
  const { id } = Route.useParams();
  const { shorts: isShorts } = Route.useSearch();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const details = useServerFn(youtubeVideoInfo);
  const search = useServerFn(searchYoutube);
  const searchShorts = useServerFn(searchYoutubeShorts);

  const { data: info } = useQuery({
    queryKey: ["youtube-video", id],
    queryFn: () => details({ data: { id } }),
    staleTime: 30 * 60_000,
  });

  const { data: related } = useQuery({
    queryKey: ["youtube-related", info?.channel ?? "", info?.title ?? ""],
    queryFn: () => search({ data: { q: info?.channel || info?.title || "trailers", limit: 12 } }),
    enabled: Boolean(info) && !isShorts,
    staleTime: 10 * 60_000,
  });

  const { data: shortsQueue } = useQuery({
    queryKey: ["youtube-shorts-queue", info?.title ?? id],
    queryFn: () => searchShorts({ data: { q: info?.title || "shorts", limit: 20 } }),
    enabled: Boolean(isShorts) && Boolean(info),
    staleTime: 10 * 60_000,
  });

  if (isShorts) {
    const queue = shortsQueue ?? [];
    const idx = queue.findIndex((s) => s.id === id);
    const goTo = (i: number) => {
      const next = queue[i];
      if (next) navigate({ to: "/youtube/$id", params: { id: next.id }, search: { shorts: 1 } as never });
    };

    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center px-4 py-6">
        <Link to="/youtube" className="mb-4 inline-flex items-center gap-1.5 self-start text-xs text-neutral-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to YouTube
        </Link>
        <div
          className="relative w-full max-w-[24rem] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
          style={{ aspectRatio: "9/16" }}
          onWheel={(e) => {
            if (idx < 0) return;
            if (e.deltaY > 40) goTo(idx + 1);
            else if (e.deltaY < -40) goTo(idx - 1);
          }}
        >
          <YoutubePlayer key={id} videoId={id} vertical autoplay onEnded={() => goTo(idx + 1)} className="h-full w-full" />
        </div>
        <div className="mt-3 flex w-full max-w-[24rem] items-center justify-between text-xs text-neutral-400">
          <button
            type="button"
            disabled={idx <= 0}
            onClick={() => goTo(idx - 1)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="truncate px-2">{info?.title ?? "Short"}</span>
          <button
            type="button"
            disabled={idx < 0 || idx >= queue.length - 1}
            onClick={() => goTo(idx + 1)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <Link
        to="/youtube"
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to YouTube
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/5">
            <div className="relative aspect-video w-full">
              <YoutubePlayer key={id} videoId={id} autoplay className="absolute inset-0 h-full w-full" />
            </div>
          </div>
          <h1 className="mt-4 font-display text-xl font-bold leading-tight sm:text-2xl">
            {info?.title ?? "Loading…"}
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            {info?.views && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {info.views}
              </span>
            )}
            {info?.published && <span>{info.published}</span>}
            {info?.likes && (
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" /> {info.likes}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            {info?.channelAvatar ? (
              <img src={info.channelAvatar} alt={info.channel} loading="lazy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-800" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                <ChannelLink channelId={info?.channelId ?? null} name={info?.channel ?? ""} />
              </div>
              {info?.subscribers && <div className="truncate text-[11px] text-neutral-500">{info.subscribers}</div>}
            </div>
          </div>

          {info?.description ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className={`whitespace-pre-wrap break-words text-sm text-neutral-300 ${expanded ? "" : "line-clamp-3"}`}>
                {info.description}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-xs font-semibold text-neutral-400 hover:text-white"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            More like this
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {(related ?? [])
              .filter((v) => v.id !== id)
              .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => navigate({ to: "/youtube/$id", params: { id: v.id } })}
                  className="group flex gap-3 text-left"
                >
                  <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-900 ring-1 ring-white/5">
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-xs font-medium">{v.title}</div>
                    <div className="mt-0.5 truncate text-[11px] text-neutral-500">{v.channel}</div>
                  </div>
                </button>
              ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
