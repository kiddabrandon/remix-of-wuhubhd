import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Users } from "lucide-react";
import { youtubeChannel } from "@/lib/youtube.functions";

export const Route = createFileRoute("/_authenticated/youtube/channel/$channelId")({
  head: () => ({
    meta: [
      { title: "YouTube Channel — WuHubHD" },
      { name: "description", content: "Browse a YouTube channel's recent uploads inside WuHubHD." },
      { property: "og:title", content: "YouTube Channel — WuHubHD" },
      { property: "og:description", content: "View channel info and recent videos without leaving WuHubHD." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChannelPage,
});

function ChannelPage() {
  const { channelId } = Route.useParams();
  const navigate = useNavigate();
  const fetchChannel = useServerFn(youtubeChannel);

  const { data: channel, isFetching } = useQuery({
    queryKey: ["youtube-channel", channelId],
    queryFn: () => fetchChannel({ data: { id: channelId } }),
    staleTime: 15 * 60_000,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <Link to="/youtube" className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to YouTube
      </Link>

      {isFetching && !channel && <p className="mt-10 text-sm text-neutral-500">Loading channel…</p>}
      {!isFetching && !channel && <p className="mt-10 text-sm text-neutral-500">Channel not found.</p>}

      {channel && (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/5">
            <div className="relative h-24 w-full bg-neutral-800 sm:h-40">
              {channel.banner && <img src={channel.banner} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-black sm:h-24 sm:w-24">
                {channel.avatar && <img src={channel.avatar} alt={channel.title} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-display text-xl font-bold sm:text-2xl">{channel.title}</h1>
                {channel.subscribers && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-400">
                    <Users className="h-3.5 w-3.5" /> {channel.subscribers}
                  </p>
                )}
                {channel.description && (
                  <p className="mt-1.5 line-clamp-2 max-w-2xl text-xs text-neutral-500">{channel.description}</p>
                )}
              </div>
            </div>
          </div>

          <h2 className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Recent videos
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channel.videos.map((v) => (
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
                {v.published && <div className="mt-0.5 truncate text-xs text-neutral-500">{v.published}</div>}
              </button>
            ))}
            {channel.videos.length === 0 && (
              <p className="col-span-full text-sm text-neutral-500">No videos found for this channel.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
