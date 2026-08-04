import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Play, Star } from "lucide-react";
import { animeById } from "@/lib/anilist";
import { animeEpisodes, animeWatch } from "@/lib/anime.functions";
import { HlsPlayer } from "@/components/HlsPlayer";
import { useSiteConfig } from "@/lib/site-config";
import { ANIME_API_PROVIDERS, DEFAULT_ANIME_PROVIDERS } from "@/lib/servers";

const detailQO = (id: number) =>
  queryOptions({
    queryKey: ["anime", "detail", id],
    queryFn: () => animeById(id),
    staleTime: 10 * 60_000,
  });

export const Route = createFileRoute("/_authenticated/anime/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Anime #${params.id} — WuHubHD` }],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <div className="text-2xl font-semibold">Couldn't load this title</div>
      <p className="mt-2 text-sm text-neutral-400">{(error as Error)?.message}</p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-full px-4 py-2 text-sm font-medium text-black"
        style={{ background: "var(--accent)" }}
      >
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-12 text-center">Anime not found</div>,
  component: AnimeDetail,
});

function AnimeDetail() {
  const params = Route.useParams();
  const id = Number(params.id);
  const { data, isLoading } = useQuery(detailQO(id));
  const site = useSiteConfig();
  const providerIds = site.animeProviders?.length ? site.animeProviders : DEFAULT_ANIME_PROVIDERS;
  const providers = providerIds
    .map((id) => ANIME_API_PROVIDERS.find((p) => p.id === id))
    .filter(Boolean) as typeof ANIME_API_PROVIDERS[number][];
  const [provider, setProvider] = useState<string>(providers[0]?.id ?? "hianime");
  const [audio, setAudio] = useState<"sub" | "dub">("sub");
  const [selected, setSelected] = useState<string | null>(null);
  const providerMeta = providers.find((p) => p.id === provider) ?? providers[0];
  const dubSupported = provider !== "animepahe";
  const dub = audio === "dub" && dubSupported;
  const { data: epData, isLoading: epLoading } = useQuery({
    queryKey: ["anime", "episodes", id, data?.idMal, data?.title, provider, dub],
    queryFn: () =>
      animeEpisodes({
        data: {
          id,
          malId: data?.idMal ?? undefined,
          title: data?.title,
          provider,
          dub,
        },
      }),
    enabled: !!data,
    staleTime: 5 * 60_000,
  });
  const episodes = epData?.episodes ?? [];
  const activeId = selected ?? episodes[0]?.id ?? null;
  const activeEp = episodes.find((e) => e.id === activeId) ?? episodes[0];

  const { data: watchData, isFetching: watchFetching } = useQuery({
    queryKey: ["anime", "watch", activeId, provider, dub],
    queryFn: () =>
      animeWatch({ data: { episodeId: activeId as string, provider, dub } }),
    enabled: !!activeId,
    staleTime: 60_000,
  });

  const bestSource = useMemo(() => {
    const sources = watchData?.sources ?? [];
    // Prefer default/backup labeled quality, else first m3u8, else first.
    return (
      sources.find((s: { isM3U8: boolean; quality: string }) => s.isM3U8 && /default|auto/i.test(s.quality)) ||
      sources.find((s: { isM3U8: boolean }) => s.isM3U8) ||
      sources[0] ||
      null
    );
  }, [watchData]);

  if (isLoading || !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden">
        {data.banner || data.poster ? (
          <img
            src={data.banner || data.poster || ""}
            alt={data.title}
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <Link
          to="/anime"
          className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs backdrop-blur hover:bg-black/80 sm:left-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
        <div className="grid gap-6 sm:grid-cols-[220px_1fr] -mt-24 sm:-mt-32">
          <div className="relative aspect-[2/3] w-40 overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/10 sm:w-full">
            {data.poster && (
              <img src={data.poster} alt={data.title} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold sm:text-4xl">{data.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              {data.year && <span>{data.year}</span>}
              {data.format && <span>· {data.format}</span>}
              {data.episodes && <span>· {data.episodes} episodes</span>}
              {data.score != null && (
                <span className="inline-flex items-center gap-1">
                  · <Star className="h-3 w-3" style={{ color: "var(--accent)" }} /> {data.score.toFixed(1)}
                </span>
              )}
            </div>
            {data.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-300"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {data.overview && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-300">
                {data.overview}
              </p>
            )}
          </div>
        </div>

        {/* Player + episodes */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {activeEp ? (
              watchData?.embed ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                  <iframe
                    src={watchData.embed}
                    title={`${data.title} — episode ${activeEp.number}`}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                  />
                </div>
              ) : bestSource ? (
                bestSource.isM3U8 ? (
                  <HlsPlayer src={bestSource.url} poster={data.banner || data.poster} />
                ) : (
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                    <video src={bestSource.url} controls playsInline className="h-full w-full" />
                  </div>
                )
              ) : watchFetching ? (
                <div className="flex aspect-video items-center justify-center rounded-xl bg-black text-sm text-neutral-400 ring-1 ring-white/10">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching stream…
                </div>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl bg-black text-sm text-neutral-400 ring-1 ring-white/10">
                  <div>No stream available from {provider}.</div>
                  <div className="text-xs text-neutral-500">Try a different provider.</div>
                </div>
              )
            ) : (

              <div className="flex aspect-video items-center justify-center rounded-xl bg-black text-sm text-neutral-400 ring-1 ring-white/10">
                {epLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading episodes…
                  </>
                ) : (
                  "No episodes returned by Consumet for this provider yet."
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400">
              <div className="inline-flex items-center gap-2">
                <span className="text-neutral-500">Provider</span>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setSelected(null);
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs outline-none"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setAudio("sub");
                    setSelected(null);
                  }}
                  className={`rounded-full px-2.5 py-1 transition ${
                    audio === "sub" ? "text-black" : "text-neutral-300 hover:text-white"
                  }`}
                  style={audio === "sub" ? { background: "var(--accent)" } : undefined}
                >
                  Sub
                </button>
                <button
                  type="button"
                  disabled={!dubSupported}
                  title={dubSupported ? "Dubbed episodes" : "Dub not available on this provider"}
                  onClick={() => {
                    setAudio("dub");
                    setSelected(null);
                  }}
                  className={`rounded-full px-2.5 py-1 transition disabled:opacity-40 ${
                    audio === "dub" && dubSupported ? "text-black" : "text-neutral-300 hover:text-white"
                  }`}
                  style={audio === "dub" && dubSupported ? { background: "var(--accent)" } : undefined}
                >
                  Dub
                </button>
              </div>
              {activeEp && (
                <span>
                  Episode {activeEp.number}
                  {activeEp.title ? ` · ${activeEp.title}` : ""}
                </span>
              )}
            </div>
            {data.trailer && (
              <div className="pt-4">
                <div className="mb-2 text-xs uppercase tracking-widest text-neutral-500">Trailer</div>
                <div className="aspect-video max-w-2xl overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                  <iframe
                    title={`${data.title} trailer`}
                    src={`https://www.youtube-nocookie.com/embed/${data.trailer.youtubeKey}?rel=0`}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-white/5 bg-[#0b0b0c]">
            <div className="border-b border-white/5 p-4">
              <div className="text-[11px] tracking-widest text-neutral-500 uppercase">
                Episodes ({episodes.length})
              </div>
            </div>
            <div className="scrollbar-none max-h-[560px] overflow-y-auto p-2">
              {epLoading && (
                <div className="p-4 text-sm text-neutral-500">Loading…</div>
              )}
              {!epLoading && episodes.length === 0 && (
                <div className="p-4 text-sm text-neutral-500">
                  No episodes found for this provider.
                </div>
              )}
              {episodes.map((ep) => {
                const active = ep.id === activeId;
                return (
                  <button
                    key={ep.id}
                    onClick={() => setSelected(ep.id)}
                    className={`group flex w-full items-start gap-3 rounded-xl p-2 text-left transition ${
                      active ? "bg-accent-soft ring-1 ring-[var(--accent)]" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-neutral-900">
                      {ep.image ? (
                        <img src={ep.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                          Ep {ep.number}
                        </div>
                      )}
                      {active && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Play className="h-4 w-4 fill-current" style={{ color: "var(--accent)" }} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="truncate text-sm">
                        <span className="text-neutral-500">Ep {ep.number}</span>
                        {ep.title ? ` · ${ep.title}` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
