import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Download, ExternalLink, Play, Puzzle, RefreshCw } from "lucide-react";
import { ALL_ADDONS, installUrl, stremioWebUrl, type Addon } from "@/lib/addons";
import { resolveAllAddonStreams } from "@/lib/addon-streams.functions";

/**
 * Add-on sources shown inside the player's server picker.
 *
 * Nothing needs installing: the server fans out across every capable add-on and
 * returns direct HTTP/HLS links, which play in-app. The manual install links stay
 * available under "Advanced" for people who also use the Stremio/Nuvio apps.
 */
export function AddonSources({
  type,
  imdbId,
  season,
  episode,
  onPlay,
}: {
  type: "movie" | "tv";
  imdbId?: string | null;
  season?: number;
  episode?: number;
  onPlay: (url: string, label: string) => void;
}) {
  const resolveAll = useServerFn(resolveAllAddonStreams);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["addon-streams-all", type, imdbId, season, episode],
    queryFn: () =>
      resolveAll({
        data: {
          type: type === "tv" ? ("series" as const) : ("movie" as const),
          imdbId: imdbId as string,
          ...(type === "tv" ? { season: season ?? 1, episode: episode ?? 1 } : {}),
        },
      }),
    enabled: !!imdbId,
    staleTime: 5 * 60_000,
  });

  const streams = data?.streams ?? [];

  return (
    <div className="border-t border-white/10 pt-1">
      <div className="flex items-center justify-between px-3 py-2">
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
            No browser-playable add-on link found for this title
            {data ? ` (checked ${data.tried} add-ons)` : ""}. Try another server above.
          </span>
        </p>
      )}

      <div className="max-h-56 space-y-1 overflow-y-auto px-1 pb-1">
        {streams.map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => onPlay(s.url, `${s.addonName} · ${s.name}`)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12px] transition hover:bg-white/5"
          >
            <Play className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
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
        ))}
      </div>

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
