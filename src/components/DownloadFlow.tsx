import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QUALITIES, splayerUrl, splayerWebFallbackUrl } from "@/lib/downloads";
import { recordDownload } from "@/lib/downloads.functions";

export type DownloadFlowProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  tmdbId?: number;
  mediaType: string;
  season?: number;
  episode?: number;
  posterPath?: string | null;
  streamUrl: string;
};

type Step = "quality" | "handoff";

export function DownloadFlow({ open, onClose, title, tmdbId, mediaType, season, episode, posterPath, streamUrl }: DownloadFlowProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("quality");
  const [quality, setQuality] = useState<string>("720p");
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [handoffWeb, setHandoffWeb] = useState<string | null>(null);

  const record = useMutation({
    mutationFn: () =>
      recordDownload({
        data: {
          tmdbId,
          mediaType,
          title,
          posterPath: posterPath ?? null,
          season,
          episode,
          quality,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["download-events"] });
      setHandoffUrl(splayerUrl(streamUrl, title));
      setHandoffWeb(splayerWebFallbackUrl(streamUrl, title));
      setStep("handoff");
    },
  });

  const reset = () => {
    setStep("quality");
    setQuality("720p");
    setHandoffUrl(null);
    setHandoffWeb(null);
  };

  const close = () => {
    reset();
    onClose();
  };


  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md border-white/10 bg-neutral-950 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Download</DialogTitle>
        </DialogHeader>

        {step === "quality" ? (

          <div>
            <p className="text-sm text-neutral-400">Choose a download quality.</p>
            <div className="mt-3 space-y-2">
              {QUALITIES.map((q) => (
                <label
                  key={q.id}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 transition hover:bg-white/10"
                >
                  <input
                    type="radio"
                    name="quality"
                    checked={quality === q.id}
                    onChange={() => setQuality(q.id)}
                    className="shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 truncate text-sm font-semibold">{q.label}</span>
                  <span className="shrink-0 text-xs text-neutral-500">{q.sizeHint}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => record.mutate()}
              disabled={record.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {record.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Start download
            </button>
            {record.isError && <p className="mt-2 text-xs text-red-300">{(record.error as Error).message}</p>}
          </div>
        ) : step === "handoff" && handoffUrl ? (
          <div>
            <p className="text-sm text-neutral-400">Handing off to SPlayer…</p>
            <a
              href={handoffUrl}
              className="mt-3 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-black"
              style={{ background: "var(--accent)" }}
            >
              <ExternalLink className="h-4 w-4" /> Open in SPlayer
            </a>
            {handoffWeb && (
              <a href={handoffWeb} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs text-neutral-400 underline">
                SPlayer not installed? Use the web fallback
              </a>
            )}
            <Link to="/downloads" onClick={close} className="mt-4 block text-center text-xs text-neutral-500 underline">
              Downloads dashboard
            </Link>
          </div>
        ) : null}
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
