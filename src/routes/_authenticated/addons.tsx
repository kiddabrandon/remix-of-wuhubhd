import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Puzzle, ExternalLink, Copy, Check } from "lucide-react";
import {
  NUVIO_PLUGINS,
  STREMIO_ADDONS,
  stremioInstallUrl,
  stremioWebUrl,
  type Addon,
} from "@/lib/addons";

export const Route = createFileRoute("/_authenticated/addons")({
  head: () => ({
    meta: [
      { title: "Streaming Add-ons — WuHubHD" },
      {
        name: "description",
        content:
          "Install Stremio add-ons and Nuvio provider packs to unlock more streaming sources inside WuHubHD.",
      },
      { property: "og:title", content: "Streaming Add-ons — WuHubHD" },
      {
        property: "og:description",
        content: "Torrentio, Cinemeta, Anime Kitsu, Nuvio providers and more, one tap away.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddonsPage,
});

function AddonsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <header className="mb-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Sources
        </div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Streaming add-ons</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Install these into Stremio or Nuvio for extra streams, subtitles and catalogues. Tap
          install to hand the manifest to the app, or copy the URL to paste it manually.
        </p>
      </header>

      <Section title="Stremio add-ons" items={STREMIO_ADDONS} />
      <Section title="Nuvio providers" items={NUVIO_PLUGINS} nuvioOnly />
    </div>
  );
}

function Section({
  title,
  items,
  nuvioOnly = false,
}: {
  title: string;
  items: Addon[];
  nuvioOnly?: boolean;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <AddonCard key={a.id} addon={a} nuvioOnly={nuvioOnly} />
        ))}
      </div>
    </section>
  );
}

function AddonCard({ addon, nuvioOnly }: { addon: Addon; nuvioOnly: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addon.manifest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div>
        <div className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-black"
            style={{ background: "var(--accent)" }}
          >
            <Puzzle className="h-4 w-4" />
          </span>
          <h3 className="font-semibold">{addon.name}</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-neutral-400">{addon.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!nuvioOnly && (
          <>
            <a
              href={stremioInstallUrl(addon.manifest)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-black"
              style={{ background: "var(--accent)" }}
            >
              Install
            </a>
            <a
              href={stremioWebUrl(addon.manifest)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Stremio Web
            </a>
          </>
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy manifest"}
        </button>
      </div>
    </div>
  );
}
