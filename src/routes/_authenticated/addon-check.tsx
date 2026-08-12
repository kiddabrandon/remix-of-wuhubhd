import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { getAddonStatus, verifyProviderPacks } from "@/lib/addon-streams.functions";

export const Route = createFileRoute("/_authenticated/addon-check")({
  head: () => ({
    meta: [
      { title: "Add-on diagnostics — WuHubHD" },
      { name: "description", content: "End-to-end health check of every bundled Stremio add-on and Nuvio provider pack." },
      { property: "og:title", content: "Add-on diagnostics — WuHubHD" },
      { property: "og:description", content: "Verify Yoru, D3adlyRocket and every Stremio manifest with per-provider diagnostics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddonCheck,
});

function AddonCheck() {
  const verify = useServerFn(verifyProviderPacks);
  const status = useServerFn(getAddonStatus);

  const packs = useQuery({ queryKey: ["verify-packs"], queryFn: () => verify({}), staleTime: 60_000 });
  const addons = useQuery({ queryKey: ["addon-status"], queryFn: () => status({}), staleTime: 60_000 });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Add-on diagnostics</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Verifies every Stremio manifest and loads each Nuvio provider script end-to-end.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void packs.refetch();
            void addons.refetch();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold hover:bg-white/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${packs.isFetching ? "animate-spin" : ""}`} /> Re-run checks
        </button>
      </header>

      <section className="mt-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Nuvio provider packs</h2>
        {packs.isPending ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading every provider script…
          </p>
        ) : packs.isError ? (
          <p className="mt-3 text-sm text-red-300">{(packs.error as Error).message}</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-neutral-400">
              {packs.data?.totalLoaded} of {packs.data?.totalProviders} providers loaded
              {packs.data?.totalFailed ? ` · ${packs.data.totalFailed} failing` : " · all healthy"}
            </p>
            <div className="mt-3 space-y-3">
              {(packs.data?.packs ?? []).map((p) => (
                <div key={p.packId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {p.manifestOk && p.failed === 0 ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      )}
                      <span className="truncate text-sm font-semibold">{p.packName}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      {p.loaded}/{p.declared} providers · {p.durationMs}ms
                    </span>
                  </div>
                  {p.error && <p className="mt-2 text-xs text-red-300">{p.error}</p>}
                  {p.failed > 0 && (
                    <ul className="mt-2 space-y-1">
                      {p.providers
                        .filter((c) => !c.ok)
                        .map((c) => (
                          <li key={c.id} className="text-[11px] text-neutral-400">
                            <span className="text-neutral-200">{c.name}</span> — {c.error}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Stremio add-ons</h2>
        {addons.isPending ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking manifests…
          </p>
        ) : addons.isError ? (
          <p className="mt-3 text-sm text-red-300">{(addons.error as Error).message}</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-neutral-400">
              {addons.data?.okCount} of {addons.data?.total} manifests reachable
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(addons.data?.statuses ?? []).map((s) => (
                <div key={s.id} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  {s.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{s.name}</div>
                    <div className="truncate text-[11px] text-neutral-500">
                      {s.ok ? `${s.latencyMs}ms${s.providers ? ` · ${s.providers} providers` : ""}` : s.error}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
