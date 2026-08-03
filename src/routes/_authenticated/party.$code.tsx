import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, X, Timer, RefreshCw } from "lucide-react";
import { Player } from "@/components/Player";
import { PartyPanel } from "@/components/PartyPanel";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { getParty, updatePartyState } from "@/lib/party.functions";
import { tmdbTv } from "@/lib/tmdb.functions";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-store";

type PartyRow = {
  code: string;
  host_id: string;
  content_id: number;
  content_type: "movie" | "tv" | "anime" | "cartoon";
  title: string;
  season_number: number | null;
  episode_number: number | null;
  server_id: string | null;
  start_at: string | null;
  sync_nonce: number | null;
};

export const Route = createFileRoute("/_authenticated/party/$code")({
  head: () => ({
    meta: [
      { title: "Watch Party — CinehubHD" },
      { name: "description", content: "Watch together with friends." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => ({ code: params.code.toUpperCase() }),
  component: PartyPage,
});

function PartyPage() {
  const { code } = Route.useLoaderData();
  const { session } = useApp();
  const [room, setRoom] = useState<PartyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const get = useServerFn(getParty);
  const update = useServerFn(updatePartyState);
  const isHost = session?.user?.id === room?.host_id;

  useEffect(() => {
    let alive = true;
    get({ data: { code } })
      .then((row) => alive && setRoom(row as PartyRow))
      .catch((e) => alive && setError(e.message ?? "Party not found"));
    return () => {
      alive = false;
    };
  }, [code, get]);

  // Realtime — follow every host-driven state change (episode, server, start time).
  useEffect(() => {
    if (!room) return;
    const chan = supabase
      .channel(`party-room-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "party_rooms", filter: `code=eq.${code}` },
        (payload) => setRoom(payload.new as PartyRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, [code, room]);

  const playerKind = useMemo<"movie" | "tv" | null>(() => {
    if (!room) return null;
    if (room.content_type === "movie") return "movie";
    if (room.content_type === "tv") return "tv";
    return null;
  }, [room]);

  const { data: tv } = useQuery({
    queryKey: ["tv", room?.content_id],
    queryFn: () => tmdbTv({ data: { id: room!.content_id } }),
    enabled: Boolean(room && room.content_type === "tv"),
    staleTime: 5 * 60_000,
  });

  const push = useCallback(
    (patch: Parameters<typeof update>[0]["data"]) => {
      if (!isHost) return;
      void update({ data: patch }).catch((e) => console.error(e));
    },
    [isHost, update],
  );

  if (error) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-4 text-center">
        <div className="max-w-md">
          <h1 className="font-display text-3xl font-bold">Party unavailable</h1>
          <p className="mt-2 text-sm text-neutral-400">{error}</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </div>
    );
  }
  if (!room) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-neutral-500">Joining party…</div>;
  }

  if (!playerKind) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-neutral-400">
        Anime and cartoon parties aren't playable in the shared player yet, but chat and presence still work below.
        <div className="mt-6"><PartyPanel code={code} /></div>
      </div>
    );
  }

  const seasons = (tv?.seasons ?? []).filter(
    (s: { season_number: number }) => s.season_number > 0,
  ) as { season_number: number; name: string; episode_count: number }[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Party watch</div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{room.title}</h1>
          {room.content_type === "tv" && (
            <div className="mt-1 text-xs text-neutral-400">
              S{room.season_number ?? 1} · E{room.episode_number ?? 1}
              {isHost && (
                <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
                  Host
                </span>
              )}
            </div>
          )}
        </div>
        <Link
          to="/watch/$type/$id"
          params={{ type: playerKind, id: String(room.content_id) }}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
        >
          Open solo view
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <Player
            type={playerKind}
            id={room.content_id}
            season={playerKind === "tv" ? room.season_number ?? 1 : undefined}
            episode={playerKind === "tv" ? room.episode_number ?? 1 : undefined}
            title={room.title}
            serverId={room.server_id ?? undefined}
            lockServer={!isHost}
            reloadKey={room.sync_nonce ?? 0}
            onServerChange={(id) => push({ code, server_id: id })}
            overlay={
              <>
                <StartCountdown startAt={room.start_at} />
                <ChatOverlay code={code} open={chatOpen} onClose={() => setChatOpen(false)} />
                <button
                  type="button"
                  onClick={() => setChatOpen((v) => !v)}
                  className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-neutral-100 backdrop-blur hover:bg-black/90 hide-in-focus"
                >
                  {chatOpen ? <X className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                  Chat
                </button>
              </>
            }
          />

          {isHost && (
            <HostControls
              onStart={(seconds) => push({ code, start_in: seconds })}
              onResync={() => push({ code, resync: true })}
            />
          )}

          {playerKind === "tv" && seasons.length > 0 && (
            <div className="mt-6 h-[520px]">
              <EpisodeSelector
                tvId={room.content_id}
                seasons={seasons}
                season={room.season_number ?? 1}
                episode={room.episode_number ?? 1}
                onChange={(s, e) =>
                  isHost
                    ? push({ code, season_number: s, episode_number: e })
                    : undefined
                }
              />
              {!isHost && (
                <p className="mt-2 text-xs text-neutral-500">
                  Only the host can change the episode for the party.
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-neutral-500">
            The host controls the episode, the server, and the shared countdown — everyone's player follows
            automatically. Individual play/pause frames stay local (the stream providers run in their own player).
          </p>
        </div>
        <div className="hidden lg:block">
          <PartyPanel code={code} />
        </div>
      </div>
    </div>
  );
}

function HostControls({
  onStart,
  onResync,
}: {
  onStart: (seconds: number) => void;
  onResync: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
      <span className="text-xs uppercase tracking-widest text-neutral-500">Host controls</span>
      {[5, 10, 30].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onStart(s)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-black"
          style={{ background: "var(--accent-hex, #00D8FF)" }}
        >
          <Timer className="h-3.5 w-3.5" />
          Start in {s}s
        </button>
      ))}
      <button
        type="button"
        onClick={onResync}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload everyone
      </button>
    </div>
  );
}

function StartCountdown({ startAt }: { startAt: string | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!startAt) {
      setRemaining(null);
      return;
    }
    const target = new Date(startAt).getTime();
    const tick = () => {
      const left = Math.ceil((target - Date.now()) / 1000);
      setRemaining(left > 0 ? left : null);
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [startAt]);

  if (remaining == null) return null;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-neutral-400">Press play together in</div>
        <div className="font-display text-7xl font-bold" style={{ color: "var(--accent-hex, #00D8FF)" }}>
          {remaining}
        </div>
      </div>
    </div>
  );
}

function ChatOverlay({
  code,
  open,
  onClose,
}: {
  code: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="absolute bottom-14 right-3 z-20 w-[min(340px,calc(100%-1.5rem))]">
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="absolute -top-2 -right-2 z-10 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-black/80 text-neutral-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="overflow-hidden rounded-2xl shadow-2xl">
          <PartyPanel code={code} compact />
        </div>
      </div>
    </div>
  );
}
