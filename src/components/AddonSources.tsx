import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Download, ExternalLink, Play, Puzzle } from "lucide-react";
import { ALL_ADDONS, checkCompatibility, installUrl, stremioWebUrl, type Addon } from "@/lib/addons";
import { resolveAddonStreams } from "@/lib/addon-streams.functions";

/**
 * Add-on sources shown inside the player's server picker. Every account gets the
 * full add-on set — a compatibility check decides whether an in-app player option
 * is offered or troubleshooting guidance is shown instead.
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
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="border-t border-white/10 pt-1">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        Add-ons & plugins
      </div>
      {ALL_ADDONS.map((addon) => (
        <AddonRow
          key={addon.id}
          addon={addon}
          type={type}
          imdbId={imdbId}
          season={season}
          episode={episode}
          open={openId === addon.id}
          onToggle={() => setOpenId((v) => (v === addon.id ? null : addon.id))}
          onPlay={onPlay}
        />
      ))}
    </div>
  );
}

function AddonRow({
  addon,
  type,
  imdbId,
  season,
  episode,
  open,
  onToggle,
  onPlay,
}: {
  addon: Addon;
  type: "movie" | "tv";
  imdbId?: string | null;
  season?: number;
  episode?: number;
  open: boolean;
  onToggle: () => void;
  onPlay: (url: string, label: string) => void;
}) {
  const compat = checkCompatibility(addon);
  const resolve = useServerFn(resolveAddonStreams);
  const [copied, setCopied] = useState(false);

  const canResolve = compat.playable && addon.platform === "stremio" && !!imdbId;

  const { data, isFetching } = useQuery({
    queryKey: ["addon-streams", addon.id, type, imdbId, season, episode],
    queryFn: () =>
      resolve({
        data: {
          addonId: addon.id,
          type: type === "tv" ? "series" : "movie",
          imdbId: imdbId as string,
          ...(type === "tv" ? { season: season ?? 1, episode: episode ?? 1 } : {}),
        },
      }),
    enabled: open && canResolve,
    staleTime: 5 * 60_000,
  });

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
    <div className="px-1">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5 ${
          open ? "bg-white/5" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <Puzzle className="h-3 w-3" />
          </span>
          <span className="truncate">{addon.name}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
            compat.playable ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-neutral-400"
          }`}
        >
          {compat.playable ? "In-app" : "App"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-2 pb-3 pt-1">
          <p className="text-[11px] leading-relaxed text-neutral-400">{compat.guidance}</p>

          {canResolve && (
            <div className="space-y-1">
              {isFetching && <p className="text-[11px] text-neutral-500">Looking for playable links…</p>}
              {data?.error && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{data.error}</span>
                </p>
              )}
              {(data?.streams ?? []).map((s) => (
                <button
                  key={s.url}
                  type="button"
                  onClick={() => onPlay(s.url, `${addon.name} · ${s.name}`)}
                  className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-left text-[11px] hover:bg-white/10"
                >
                  <Play className="h-3 w-3 shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    {s.description && (
                      <span className="block truncate text-neutral-500">{s.description}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {compat.playable && addon.platform === "stremio" && !imdbId && (
            <p className="text-[11px] text-amber-200">
              No IMDb id for this title, so in-app resolving is unavailable — play it in the Stremio app.
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <a
              href={installUrl(addon)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-black"
              style={{ background: "var(--accent)" }}
            >
              <Download className="h-3 w-3" /> Install
            </a>
            {addon.platform === "stremio" && (
              <a
                href={stremioWebUrl(addon.manifest)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] hover:bg-white/10"
              >
                <ExternalLink className="h-3 w-3" /> Web
              </a>
            )}
            <button
              type="button"
              onClick={copyManifest}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] hover:bg-white/10"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Manifest"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
