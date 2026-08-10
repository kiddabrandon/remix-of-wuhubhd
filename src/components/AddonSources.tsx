import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Play,
  Puzzle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ALL_ADDONS, installUrl, stremioWebUrl, type Addon } from "@/lib/addons";
import { getAddonStatus, resolveAllAddonStreams } from "@/lib/addon-streams.functions";
import { externalPlayerUrl, type AddonStream } from "@/lib/addon-types";

/**
 * Add-on sources shown inside the player's server picker.
 *
 * Nothing needs installing: the server fans out across every capable Stremio
 * add-on and Nuvio provider pack and returns links classified as direct,
 * debrid, or raw magnet. Magnets get external-player launchers instead of the
 * in-app player.
 */
export function AddonSources({
  type,
  imdbId,
  tmdbId,
  season,
  episode,
  onPlay,
}: {
  type: "movie" | "tv";
  imdbId?: string | null;
  tmdbId?: number | string | null;
  season?: number;
  episode?: number;
  onPlay: (url: string, label: string) => void;
}) {
  const resolveAll = useServerFn(resolveAllAddonStreams);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const numericTmdb = Number(tmdbId);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["addon-streams-all", type, imdbId, tmdbId, season, episode],
    queryFn: () =>
      resolveAll({
        data: {
          type: type === "tv" ? ("series" as const) : ("movie" as const),
          imdbId: imdbId as string,
          ...(Number.isFinite(numericTmdb) && numericTmdb > 0 ? { tmdbId: numericTmdb } : {}),
          ...(type === "tv" ? { season: season ?? 1, episode: episode ?? 1 } : {}),
        },
      }),
    enabled: !!imdbId,
    staleTime: 5 * 60_000,
  });

  const streams = data?.streams ?? [];

  return (
    <div className="border-t border-white/10 pt-1">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Add-on sources
        </span>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={!imdbId || isFetching}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Scanning" : "Rescan"}
        </button>
      </div>

      {!imdbId && (
        <p className="px-3 pb-2 text-[11px] text-amber-200">
          No IMDb id for this title, so add-on sources can&apos;t be resolved.
        </p>
      )}

      {imdbId && isFetching && streams.length === 0 && (
        <p className="px-3 pb-2 text-[11px] text-neutral-500">
          Scanning add-ons for playable links…
        </p>
      )}

      {imdbId && !isFetching && streams.length === 0 && (
        <p className="flex items-start gap-1.5 px-3 pb-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            No add-on link found for this title
            {data ? ` (checked ${data.tried} add-ons)` : ""}. Try another server above or check
            add-on status below.
          </span>
        </p>
      )}

      <div className="max-h-56 space-y-1 overflow-y-auto px-1 pb-1">
        {streams.map((s) => (
          <StreamRow key={s.url} stream={s} onPlay={onPlay} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowStatus((v) => !v)}
        className="w-full px-3 py-2 text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-300"
      >
        {showStatus ? "Hide" : "Show"} · add-on status
      </button>
      {showStatus && <AddonStatusPanel />}

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="w-full px-3 py-2 text-left text-[10px] uppercase tracking-[0.2em] text-neutral-500 hover:text-neutral-300"
      >
        {showAdvanced ? "Hide" : "Advanced"} · install in Stremio / Nuvio
      </button>

      {showAdvanced && (
        <div className="space-y-1 px-1 pb-2">
          {ALL_ADDONS.map((addon) => (
            <AdvancedAddonRow key={addon.id} addon={addon} />
          ))}
        </div>
      )}
    </div>
  );
}

function StreamRow({
  stream: s,
  onPlay,
}: {
  stream: AddonStream;
  onPlay: (url: string, label: string) => void;
}) {
  const isMagnet = s.kind === "magnet";

  return (
    <div className="rounded-lg px-2 py-2 transition hover:bg-white/5">
      <button
        type="button"
        disabled={isMagnet}
        onClick={() => onPlay(s.url, `${s.addonName} · ${s.name}`)}
        className="flex w-full items-center gap-2 text-left text-[12px] disabled:cursor-default"
      >
        <Play
          className={`h-3.5 w-3.5 shrink-0 ${isMagnet ? "opacity-30" : ""}`}
          style={{ color: "var(--accent)" }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{s.name}</span>
          <span className="block truncate text-[10px] text-neutral-500">
            {s.addonName}
            {s.description ? ` · ${s.description}` : ""}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-300">
          {s.quality}
          {s.size ? ` · ${s.size}` : ""}
        </span>
      </button>

      <div className="mt-1 flex flex-wrap items-center gap-1 pl-5">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
            s.kind === "direct"
              ? "bg-emerald-400/15 text-emerald-200"
              : s.kind === "debrid"
                ? "bg-sky-400/15 text-sky-200"
                : "bg-amber-400/15 text-amber-200"
          }`}
        >
          {s.kindLabel}
        </span>
        {isMagnet && (
          <>
            <span className="text-[9px] text-neutral-500">Needs an external player:</span>
            <a
              href={externalPlayerUrl("vlc", s.url)}
              className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px]"
            >
              VLC
            </a>
            <a
              href={externalPlayerUrl("mpv", s.url)}
              className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px]"
            >
              MPV
            </a>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(s.url)}
              className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px]"
            >
              Copy magnet
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddonStatusPanel() {
  const check = useServerFn(getAddonStatus);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["addon-status"],
    queryFn: () => check(),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-1 px-1 pb-2">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[10px] text-neutral-400">
          {data ? `${data.okCount}/${data.total} loading correctly` : "Checking add-ons…"}
        </span>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-300 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Recheck
        </button>
      </div>

      <div className="max-h-52 space-y-0.5 overflow-y-auto">
        {(data?.statuses ?? []).map((st) => (
          <div key={st.id} className="rounded-lg px-2 py-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              {st.ok ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-3 w-3 shrink-0 text-red-400" />
              )}
              <span className="min-w-0 flex-1 truncate">{st.name}</span>
              <span className="shrink-0 text-[9px] uppercase tracking-wider text-neutral-500">
                {st.platform}
                {st.providers ? ` · ${st.providers} providers` : ""}
                {st.ok ? ` · ${st.latencyMs}ms` : ""}
              </span>
            </div>
            {st.error && <p className="pl-5 text-[10px] text-red-300">{st.error}</p>}
            {st.ok && !st.canStream && (
              <p className="pl-5 text-[10px] text-neutral-500">
                Loaded, but provides catalogues/subtitles only — no playable streams.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvancedAddonRow({ addon }: { addon: Addon }) {
  const [copied, setCopied] = useState(false);

  const copyManifest = async () => {
    try {
      await navigator.clipboard.writeText(addon.manifest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
      <span className="flex min-w-0 items-center gap-2 text-[11px]">
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-white/10">
          <Puzzle className="h-2.5 w-2.5" />
        </span>
        <span className="truncate">{addon.name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <a
          href={installUrl(addon)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-black"
          style={{ background: "var(--accent)" }}
        >
          <Download className="h-3 w-3" /> Install
        </a>
        {addon.platform === "stremio" && (
          <a
            href={stremioWebUrl(addon.manifest)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px]"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          type="button"
          onClick={copyManifest}
          className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px]"
          aria-label="Copy manifest URL"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </span>
    </div>
  );
}
