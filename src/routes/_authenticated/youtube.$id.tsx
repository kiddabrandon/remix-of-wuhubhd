import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { searchYoutube, youtubeVideoDetails } from "@/lib/youtube.functions";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/_authenticated/youtube/$id")({
  head: () => ({
    meta: [
      { title: "Watch on YouTube — WuHubHD" },
      { name: "description", content: "Play a YouTube video inside WuHubHD with related results." },
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
  const { settings } = useApp();
  const navigate = useNavigate();
  const details = useServerFn(youtubeVideoDetails);
  const search = useServerFn(searchYoutube);

  const { data: info } = useQuery({
    queryKey: ["youtube-video", id],
    queryFn: () => details({ data: { id } }),
    staleTime: 30 * 60_000,
  });

  const { data: related } = useQuery({
    queryKey: ["youtube-related", info?.channel ?? "", info?.title ?? ""],
    queryFn: () => search({ data: { q: info?.channel || info?.title || "trailers", limit: 12 } }),
    enabled: Boolean(info),
    staleTime: 10 * 60_000,
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

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
              <iframe
                key={id}
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=${
                  settings.autoplay ? 1 : 0
                }&rel=0&modestbranding=1&playsinline=1&cc_lang_pref=${settings.subtitleLang || "en"}${
                  origin ? `&origin=${encodeURIComponent(origin)}` : ""
                }`}
                title={info?.title ?? "YouTube video"}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                /* YouTube rejects embeds with a stripped referrer (error 153). */
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
          <h1 className="mt-4 font-display text-xl font-bold leading-tight sm:text-2xl">
            {info?.title ?? "Loading…"}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">{info?.channel ?? ""}</p>
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
