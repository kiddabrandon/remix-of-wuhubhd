import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { Player } from "@/components/Player";
import { PartyPanel } from "@/components/PartyPanel";
import { getParty, updatePartyTarget } from "@/lib/party.functions";
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
  const get = useServerFn(getParty);
  const update = useServerFn(updatePartyTarget);
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

  // Realtime — follow host's episode changes
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
          />
          {playerKind === "tv" && isHost && (
            <HostEpisodeControls
              current={{ s: room.season_number ?? 1, e: room.episode_number ?? 1 }}
              onChange={(s, e) => update({ data: { code, season_number: s, episode_number: e } })}
            />
          )}
          <p className="mt-4 text-xs text-neutral-500">
            Chat, presence, and host episode switches sync live. Play/pause frames don't — start at the same moment.
          </p>
        </div>
        <PartyPanel code={code} />
      </div>
    </div>
  );
}

function HostEpisodeControls({
  current,
  onChange,
}: {
  current: { s: number; e: number };
  onChange: (s: number, e: number) => void;
}) {
  const [s, setS] = useState(current.s);
  const [e, setE] = useState(current.e);
  useEffect(() => {
    setS(current.s);
    setE(current.e);
  }, [current.s, current.e]);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
      <span className="text-xs uppercase tracking-widest text-neutral-500">Host controls</span>
      <label className="inline-flex items-center gap-1 text-xs text-neutral-400">
        S
        <input
          type="number"
          min={1}
          value={s}
          onChange={(ev) => setS(Math.max(1, Number(ev.target.value) || 1))}
          className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm"
        />
      </label>
      <label className="inline-flex items-center gap-1 text-xs text-neutral-400">
        E
        <input
          type="number"
          min={1}
          value={e}
          onChange={(ev) => setE(Math.max(1, Number(ev.target.value) || 1))}
          className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(s, e)}
        className="rounded-md px-3 py-1 text-xs font-semibold text-black"
        style={{ background: "var(--accent-hex, #00D8FF)" }}
      >
        Sync party
      </button>
    </div>
  );
}