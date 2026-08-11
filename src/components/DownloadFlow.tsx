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

        {entitlement.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your credits…
          </div>
        ) : step === "check" && !hasCredits ? (
          <div>
            <p className="text-sm text-neutral-400">You need a download plan to continue. Pick one:</p>
            <div className="mt-3 space-y-2">
              {DOWNLOAD_TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => buy.mutate(tier.id)}
                  disabled={buy.isPending}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{tier.name}</div>
                    <div className="truncate text-xs text-neutral-400">{tier.blurb}</div>
                  </div>
                  <div className="shrink-0 font-display text-sm font-bold" style={{ color: "var(--accent)" }}>
                    KSh {tier.priceKes}
                  </div>
                </button>
              ))}
            </div>
            {buy.isError && <p className="mt-2 text-xs text-red-300">{(buy.error as Error).message}</p>}
          </div>
        ) : step === "check" && hasCredits ? (
          <div className="py-2">
            <p className="text-sm text-neutral-400">
              {entitlement.data?.unlimited ? "You have unlimited downloads." : `You have ${entitlement.data?.remaining} credit(s).`}
            </p>
            <button
              onClick={() => setStep("quality")}
              className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold text-black"
              style={{ background: "var(--accent)" }}
            >
              Continue
            </button>
          </div>
        ) : step === "pay" ? (
          <div>
            <p className="text-sm text-neutral-400">Complete your M-Pesa payment to unlock this download.</p>
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <p>
                Paybill: <span className="font-mono">247247</span> · Account: <span className="font-mono">WUHUBHD</span>
              </p>
              <p className="mt-1">
                Amount: <span className="font-mono">KSh {amountKes}</span> · Ref: <span className="font-mono">{purchaseId?.slice(0, 8)}</span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={providerRef}
                onChange={(e) => setProviderRef(e.target.value)}
                placeholder="M-Pesa transaction code"
                className="min-w-0 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-neutral-500"
              />
              <button
                onClick={() => confirm.mutate()}
                disabled={!providerRef || confirm.isPending}
                className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                style={{ background: "var(--accent)" }}
              >
                {confirm.isPending ? "Confirming…" : "I've paid — confirm"}
              </button>
            </div>
            {confirm.isError && <p className="mt-2 text-xs text-red-300">{(confirm.error as Error).message}</p>}
          </div>
        ) : step === "quality" ? (
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
