import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect } from "react";
import { useState } from "react";
import { Star, Plus, Check, Calendar, Clock, Focus, Users, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createParty } from "@/lib/party.functions";
import { Player } from "@/components/Player";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { Carousel } from "@/components/Carousel";
import { Ambilight } from "@/components/Ambilight";
import { tmdbMovie, tmdbTv } from "@/lib/tmdb.functions";
import { backdrop, poster } from "@/lib/tmdb-utils";
import { useApp } from "@/lib/app-store";

const schema = z.object({
  s: fallback(z.number().int(), 1).default(1),
  e: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/watch/$type/$id")({
  validateSearch: zodValidator(schema),
  parseParams: (p) => ({ type: p.type as "movie" | "tv", id: p.id }),
  component: Watch,
});

function Watch() {
  const { type, id } = Route.useParams();
  const { s, e } = Route.useSearch();
  const navigate = useNavigate({ from: "/watch/$type/$id" });
  const idNum = Number(id);
  const { toggleWatch, inWatchlist, saveProgress, progressFor, settings, setSettings } = useApp();
  const createPartyFn = useServerFn(createParty);
  const [partyBusy, setPartyBusy] = useState(false);
  const [partyErr, setPartyErr] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [type, idNum],
    queryFn: () =>
      type === "movie" ? tmdbMovie({ data: { id: idNum } }) : tmdbTv({ data: { id: idNum } }),
    staleTime: 5 * 60_000,
  });

  const prior = progressFor(idNum, type);
  const resumeSeconds =
    prior && !prior.fully_watched && (type === "movie" || (prior.season === s && prior.episode === e))
      ? prior.position_seconds
      : 0;

  // Seed the row on first load so it appears in Continue Watching immediately.
  useEffect(() => {
    if (!data) return;
    const title = data.title || data.name || "Untitled";
    saveProgress({
      tmdb_id: idNum,
      media_type: type,
      title,
      poster_path: data.poster_path ?? null,
      backdrop_path: data.backdrop_path ?? null,
      season: type === "tv" ? s : undefined,
      episode: type === "tv" ? e : undefined,
      mark_episode: type === "tv" ? { s, e } : undefined,
    });
  }, [data, type, idNum, s, e, saveProgress]);

  if (isLoading || !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">Loading…</div>
    );
  }

  const title = data.title || data.name;
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const bg = backdrop(data.backdrop_path, "original");
  const saved = inWatchlist(idNum, type);

  return (
    <div className="relative">
      {bg && (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] opacity-30 hide-in-focus">
          <img src={bg} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black" />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <Ambilight image={bg}>
              <Player
                type={type}
                id={idNum}
                season={type === "tv" ? s : undefined}
                episode={type === "tv" ? e : undefined}
                resumeSeconds={resumeSeconds}
                title={title ?? undefined}
                poster={bg}
                onProgress={({ position_seconds, duration_seconds }) => {
                  saveProgress({
                    tmdb_id: idNum,
                    media_type: type,
                    title: title ?? "Untitled",
                    poster_path: data.poster_path ?? null,
                    backdrop_path: data.backdrop_path ?? null,
                    season: type === "tv" ? s : undefined,
                    episode: type === "tv" ? e : undefined,
                    position_seconds,
                    duration_seconds,
                    mark_episode: type === "tv" ? { s, e } : undefined,
                  });
                }}
              />
            </Ambilight>

            <div className="mt-6 hide-in-focus">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 uppercase tracking-widest">
                  {type === "movie" ? "Movie" : "Series"}
                </span>
                {year && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {year}
                  </span>
                )}
                {data.runtime ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {data.runtime} min
                  </span>
                ) : null}
                {data.vote_average ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current" style={{ color: "var(--accent)" }} />
                    {data.vote_average.toFixed(1)}
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(data.genres ?? []).map((g: any) => (
                  <span key={g.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-neutral-300">
                    {g.name}
                  </span>
                ))}
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-300 sm:text-base">{data.overview}</p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    toggleWatch({
                      id: idNum,
                      type,
                      title: title ?? "Untitled",
                      poster: data.poster_path ?? null,
                      year,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10"
                >
                  {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {saved ? "In Watchlist" : "Add to Watchlist"}
                </button>
                <button
                  onClick={() => setSettings({ focusMode: !settings.focusMode })}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-neutral-300 hover:bg-white/10"
                >
                  <Focus className="h-4 w-4" /> Focus mode: {settings.focusMode ? "on" : "off"}
                </button>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-5 py-2.5 text-sm text-neutral-300 hover:bg-white/5"
                >
                  Back to Discover
                </Link>
                <div className="relative inline-flex items-center">
                  <button
                    onClick={async () => {
                      setPartyBusy(true);
                      setPartyErr(null);
                      try {
                        const r = await createPartyFn({
                          data: {
                            content_id: idNum,
                            content_type: type,
                            title: title ?? "Untitled",
                            season_number: type === "tv" ? s : null,
                            episode_number: type === "tv" ? e : null,
                          },
                        });
                        navigate({ to: "/party/$code", params: { code: r.code }, search: {} as never });
                      } catch (er) {
                        setPartyErr(er instanceof Error ? er.message : "Could not create party");
                      } finally {
                        setPartyBusy(false);
                      }
                    }}
                    disabled={partyBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
                  >
                    <Users className="h-4 w-4" />
                    {partyBusy ? "Creating party…" : "Start Watch Party"}
                  </button>
                  <PartyInfoButton />
                </div>
              </div>
              {partyErr && (
                <div className="mt-3 text-xs text-red-300">{partyErr}</div>
              )}
            </div>
          </div>

          {type === "tv" && data.seasons && (
            <div className="hide-in-focus lg:sticky lg:top-20 lg:h-[70vh]">
              <EpisodeSelector
                tvId={idNum}
                seasons={data.seasons}
                season={s}
                episode={e}
                onChange={(ns, ne) => navigate({ search: { s: ns, e: ne } })}
              />
            </div>
          )}
        </div>

        {data.credits?.cast?.length ? (
          <section className="mt-14 hide-in-focus">
            <h2 className="mb-4 text-lg font-semibold">Cast</h2>
            <div className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
              {data.credits.cast.slice(0, 15).map((c: any) => {
                const src = poster(c.profile_path, "w185");
                return (
                  <div key={c.id} className="w-28 shrink-0 text-center">
                    <div className="aspect-square overflow-hidden rounded-full bg-neutral-900">
                      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="mt-2 truncate text-xs font-medium">{c.name}</div>
                    <div className="truncate text-[11px] text-neutral-500">{c.character}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {data.recommendations?.results?.length ? (
          <section className="mt-14 -mx-4 hide-in-focus sm:-mx-8">
            <Carousel
              title="More like this"
              items={data.recommendations.results.map((r: any) => ({ ...r, media_type: type }))}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function PartyInfoButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative ml-1">
      <button
        type="button"
        aria-label="How Watch Party works"
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-neutral-300 hover:text-white"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <>
          {/* Mobile: centered modal within viewport. Desktop: anchored popover. */}
          <div
            onMouseDown={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:hidden"
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-[#0b0b0c] p-4 text-xs text-neutral-300 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:translate-x-0 sm:translate-y-0"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-2 text-sm font-semibold text-white">How Watch Party works</div>
            <ol className="list-decimal space-y-1.5 pl-4 text-neutral-400">
              <li>Click <b className="text-white">Start Watch Party</b> to create a private room for this title.</li>
              <li>You'll land in the party page with a short <b className="text-white">invite code</b> in the URL — share it with friends.</li>
              <li>Everyone signed in who opens the link joins the same room. The host controls the episode; the player syncs automatically.</li>
              <li>Use the side chat to talk in real time. Leaving the page closes your seat but the room stays open.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
