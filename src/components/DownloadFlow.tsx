import { useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { launchSplayer, splayerUrl, splayerWebFallbackUrl } from "@/lib/downloads";
import { recordDownload } from "@/lib/downloads.functions";
import { resolveAllAddonStreams } from "@/lib/addon-streams.functions";
import type { AddonStream } from "@/lib/addon-types";

export type DownloadFlowProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  tmdbId?: number;
  imdbId?: string | null;
  mediaType: string;
  season?: number;
  episode?: number;
  posterPath?: string | null;
  /** Fallback link (usually the watch page) when no direct file can be resolved. */
  streamUrl: string;
};

type Step = "sources" | "handoff";

export function DownloadFlow({
  open,
  onClose,
  title,
  tmdbId,
  imdbId,
  mediaType,
  season,
  episode,
  posterPath,
  streamUrl,
}: DownloadFlowProps) {
  const qc = useQueryClient();
  const resolveAll = useServerFn(resolveAllAddonStreams);
  const [step, setStep] = useState<Step>("sources");
  const [picked, setPicked] = useState<AddonStream | null>(null);

  const canResolve = Boolean(imdbId && /^tt\d+$/.test(imdbId));

  const {
    data: resolved,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["download-sources", imdbId, mediaType, season, episode],
    queryFn: () =>
      resolveAll({
        data: {
          type: mediaType === "tv" ? ("series" as const) : ("movie" as const),
          imdbId: imdbId as string,
          ...(tmdbId ? { tmdbId } : {}),
          ...(season != null ? { season } : {}),
          ...(episode != null ? { episode } : {}),
        },
      }),
    enabled: open && canResolve,
    staleTime: 2 * 60_000,
  });

  // Only files an external downloader can actually fetch.
  const files = (resolved?.streams ?? []).filter((s) => s.kind !== "magnet");
  const magnets = (resolved?.streams ?? []).filter((s) => s.kind === "magnet");

  const record = useMutation({
    mutationFn: async (stream: AddonStream | null) => {
      try {
        await recordDownload({
          data: {
            ...(tmdbId ? { tmdbId } : {}),
            mediaType,
            title,
            posterPath: posterPath ?? null,
            ...(season != null ? { season } : {}),
            ...(episode != null ? { episode } : {}),
            quality: stream?.quality || "auto",
          },
        });
      } catch {
        // Guests aren't signed in — logging is best-effort, never block the download.
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["download-events"] });
    },
  });

  const start = (stream: AddonStream | null) => {
    setPicked(stream);
    setStep("handoff");
    // Logging is best-effort and must never gate the handoff.
    record.mutate(stream);
    const url = stream?.url ?? streamUrl;
    const label = stream ? `${title} · ${stream.quality || stream.name}` : title;
    launchSplayer(url, label);
  };

  const close = () => {
    setStep("sources");
    setPicked(null);
    onClose();
  };

  const target = picked?.url ?? streamUrl;
  const label = picked ? `${title} · ${picked.quality}` : title;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto border-white/10 bg-neutral-950 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Download</DialogTitle>
        </DialogHeader>

        {step === "sources" ? (
          <div>
            {!canResolve ? (
              <p className="text-sm text-neutral-400">
                No downloadable file could be identified for this title. Open a source in the player first, then try again.
              </p>
            ) : isFetching && !resolved ? (
              <p className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Finding downloadable files…
              </p>
            ) : files.length === 0 && magnets.length === 0 ? (
              <div className="text-sm text-neutral-400">
                <p>No direct files found for this title right now.</p>
                <button
                  onClick={() => void refetch()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-400">Pick a file to hand off to SPlayer.</p>
                <div className="mt-3 space-y-2">
                  {[...files, ...magnets].slice(0, 25).map((s, i) => (
                    <button
                      key={`${s.addonId}-${i}`}
                      onClick={() => start(s)}
                      disabled={record.isPending}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-left transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{s.quality || s.name}</span>
                        <span className="block truncate text-[11px] text-neutral-500">
                          {s.addonName}
                          {s.size ? ` · ${s.size}` : ""} · {s.kindLabel}
                        </span>
                      </span>
                      <Download className="h-4 w-4 shrink-0 text-neutral-400" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {record.isPending && (
              <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing…
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-neutral-400">Handing off to SPlayer…</p>
            <a
              href={splayerUrl(target, label)}
              className="mt-3 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-black"
              style={{ background: "var(--accent)" }}
            >
              <ExternalLink className="h-4 w-4" /> Open in SPlayer
            </a>
            <a
              href={splayerWebFallbackUrl(target, label)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-xs text-neutral-400 underline"
            >
              SPlayer not installed? Use the web fallback
            </a>
            {picked && picked.kind !== "magnet" && (
              <a
                href={picked.url}
                target="_blank"
                rel="noreferrer"
                download
                className="mt-3 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                <Download className="h-4 w-4" /> Download in browser
              </a>
            )}
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(target)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-2.5 text-xs text-neutral-300 hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
            <Link to="/downloads" onClick={close} className="mt-4 block text-center text-xs text-neutral-500 underline">
              Downloads dashboard
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DownloadButton(props: DownloadFlowProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10 hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
      <DownloadFlow {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
