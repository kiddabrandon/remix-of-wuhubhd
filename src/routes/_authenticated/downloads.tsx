import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useApp } from "@/lib/app-store";
import { CheckCircle2, Clock, Crown, Download, ShieldCheck, XCircle } from "lucide-react";
import { DOWNLOAD_TIERS } from "@/lib/downloads";
import { getEntitlement, listDownloads, listPurchases, startPurchase, confirmPurchase } from "@/lib/downloads.functions";
import { poster } from "@/lib/tmdb-utils";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — WuHubHD" },
      { name: "description", content: "Manage your download credits, purchase plans, and view your download history." },
      { property: "og:title", content: "Downloads — WuHubHD" },
      { property: "og:description", content: "Buy download credits and hand off titles to SPlayer for offline viewing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DownloadsPage,
});

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

function countdown(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / (24 * 3600 * 1000));
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / (3600 * 1000));
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor(diff / 60000);
  return `${Math.max(mins, 1)}m left`;
}

const STATUS_PILL: Record<string, string> = {
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  failed: "border-red-400/30 bg-red-400/10 text-red-200",
  refunded: "border-neutral-400/30 bg-neutral-400/10 text-neutral-300",
  handed_off: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  started: "border-amber-400/30 bg-amber-400/10 text-amber-200",
};

function DownloadsPage() {
  const qc = useQueryClient();
  const [payFor, setPayFor] = useState<string | null>(null);
  const [ref, setRef] = useState("");

  // Guests can browse this page, but these reads are account-scoped — without a
  // session the server fn 401s, so gate them instead of crashing the route.
  const { session } = useApp();
  const signedIn = !!session;
  const entitlement = useQuery({
    queryKey: ["download-entitlement", session?.user.id ?? "guest"],
    queryFn: () => getEntitlement(),
    enabled: signedIn,
    retry: false,
  });
  const purchases = useQuery({
    queryKey: ["download-purchases", session?.user.id ?? "guest"],
    queryFn: () => listPurchases(),
    enabled: signedIn,
    retry: false,
  });
  const downloads = useQuery({
    queryKey: ["download-events", session?.user.id ?? "guest"],
    queryFn: () => listDownloads(),
    enabled: signedIn,
    retry: false,
  });

  const buy = useMutation({
    mutationFn: (tier: "single" | "week" | "lifetime") => startPurchase({ data: { tier } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["download-purchases"] });
      setPayFor(row.id);
      setRef("");
    },
  });

  const confirm = useMutation({
    mutationFn: (purchaseId: string) => confirmPurchase({ data: { purchaseId, providerRef: ref } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["download-purchases"] });
      qc.invalidateQueries({ queryKey: ["download-entitlement"] });
      setPayFor(null);
      setRef("");
    },
  });

  const ent = entitlement.data;
  const pendingPurchase = purchases.data?.find((p) => p.id === payFor);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Downloads</h1>
      <p className="mt-1 text-sm text-neutral-400">Buy credits, hand off to SPlayer, and watch offline.</p>

      {!signedIn && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
          You're browsing as a guest. Downloads still work — create an account in Settings to keep
          your download history and credits across devices.
        </div>
      )}

      {/* Hero: entitlement */}
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Your entitlement</span>
          </div>
          {entitlement.isLoading ? (
            <div className="mt-2 h-8 w-40 animate-pulse rounded bg-white/10" />
          ) : ent?.unlimited ? (
            <div className="mt-1 flex items-center gap-2 font-display text-3xl font-bold">
              <Crown className="h-6 w-6 shrink-0" style={{ color: "var(--accent)" }} />
              Unlimited
            </div>
          ) : (
            <div className="mt-1 font-display text-3xl font-bold">
              {ent?.remaining ?? 0} <span className="text-base font-normal text-neutral-400">credits left</span>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            {ent?.tier && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 capitalize">{ent.tier} plan</span>
            )}
            {ent?.expires_at && (
              <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <Clock className="h-3 w-3" /> {countdown(ent.expires_at)}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 rounded-full p-3" style={{ background: "color-mix(in oklab, var(--accent) 18%, transparent)" }}>
          <Download className="h-6 w-6" style={{ color: "var(--accent)" }} />
        </div>
      </div>

      {/* Tiers */}
      <h2 className="mt-10 font-display text-xl font-bold">Buy credits</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {DOWNLOAD_TIERS.map((tier) => (
          <div key={tier.id} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="font-display text-lg font-bold">{tier.name}</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: "var(--accent)" }}>
              KSh {tier.priceKes}
            </div>
            <p className="mt-2 flex-1 text-sm text-neutral-400">{tier.blurb}</p>
            <button
              onClick={() => buy.mutate(tier.id)}
              disabled={buy.isPending}
              className="mt-4 rounded-full px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {buy.isPending ? "Starting…" : "Buy"}
            </button>
          </div>
        ))}
      </div>

      {/* Payment instructions */}
      {pendingPurchase && (
        <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-100">
          <p className="font-semibold">Complete your M-Pesa payment</p>
          <p className="mt-1 text-amber-200/90">
            Paybill: <span className="font-mono">247247</span> · Account: <span className="font-mono">WUHUBHD</span> · Amount:{" "}
            <span className="font-mono">KSh {pendingPurchase.amount_kes}</span>
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="M-Pesa transaction code"
              className="min-w-0 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-neutral-500"
            />
            <button
              onClick={() => confirm.mutate(pendingPurchase.id)}
              disabled={!ref || confirm.isPending}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {confirm.isPending ? "Confirming…" : "I've paid — confirm"}
            </button>
          </div>
          {confirm.isError && <p className="mt-2 text-red-300">{(confirm.error as Error).message}</p>}
        </div>
      )}

      {/* Purchases */}
      <h2 className="mt-10 font-display text-xl font-bold">Your purchases</h2>
      {purchases.data?.length ? (
        <div className="mt-4 space-y-2">
          {purchases.data.map((p) => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold capitalize">{p.tier} — KSh {p.amount_kes}</div>
                <div className="text-xs text-neutral-500">{relativeTime(p.created_at)}</div>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs capitalize ${STATUS_PILL[p.status] ?? ""}`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">No purchases yet.</p>
      )}

      {/* History */}
      <h2 className="mt-10 font-display text-xl font-bold">Download history</h2>
      {downloads.data?.length ? (
        <div className="mt-4 space-y-2">
          {downloads.data.map((d) => {
            const src = poster(d.poster_path, "w92");
            return (
              <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-neutral-900">
                  {src ? <img src={src} alt={d.title} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{d.title}</div>
                  <div className="truncate text-xs text-neutral-500">
                    {d.season != null && d.episode != null ? `S${d.season}E${d.episode} · ` : ""}
                    {d.quality} · {relativeTime(d.created_at)}
                  </div>
                </div>
                <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs capitalize ${STATUS_PILL[d.status] ?? ""}`}>
                  {d.status === "handed_off" ? <CheckCircle2 className="h-3 w-3" /> : d.status === "failed" ? <XCircle className="h-3 w-3" /> : null}
                  {d.status.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">No downloads yet. Grab something from a title's player.</p>
      )}
    </div>
  );
}
