// Stremio add-ons and Nuvio provider packs bundled with WuHubHD.
// Every user gets the full set — streams are resolved server-side and played
// directly inside WuHubHD's own player. No install step is required for
// anything that can return an http(s)/HLS stream.

export type AddonStreamKind =
  | "http" // direct HTTP / HLS urls → playable inside WuHubHD
  | "torrent" // magnet / infoHash only → external app required
  | "metadata" // catalogues & artwork, no streams
  | "subtitles"; // subtitle tracks only

export type Addon = {
  id: string;
  name: string;
  description: string;
  manifest: string;
  /** Which platform the manifest targets. */
  platform: "stremio" | "nuvio";
  /** Fallback capability guess, used only when the live manifest can't be read. */
  streamKind: AddonStreamKind;
};

export const STREMIO_ADDONS: Addon[] = [
  { id: "torrentio", name: "Torrentio", description: "Torrent streams from public trackers.", manifest: "https://torrentio.strem.fun/manifest.json", platform: "stremio", streamKind: "torrent" },
  { id: "comet", name: "Comet", description: "Debrid-powered stream aggregator.", manifest: "https://comet.elfhosted.com/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "mediafusion", name: "MediaFusion", description: "Multi-source streams and catalogues.", manifest: "https://mediafusion.elfhosted.com/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "aiostreams", name: "AIOStreams", description: "All-in-one aggregated stream results.", manifest: "https://aiostreams.elfhosted.com/stremio/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "orion", name: "Orion", description: "Orion indexer-backed streams.", manifest: "https://5a0d1888fa64-orion.baby-beamup.club/manifest.json", platform: "stremio", streamKind: "torrent" },
  { id: "duckkota-tools", name: "Duckkota Tools", description: "Stremio utility tools pack.", manifest: "https://duckkota.gitlab.io/stremio-tools/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "meteor-weebs", name: "Meteor for the Weebs", description: "Anime-focused stream provider.", manifest: "https://meteorfortheweebs.midnightignite.me/stremio/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "ytztvio", name: "YTZ TV", description: "Live TV channels and streams.", manifest: "https://ytztvio.galacticcapsule.workers.dev/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "aniscraper", name: "AniScraper", description: "Anime scraper with direct links.", manifest: "https://aniscraper.nmtl.app/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "streampeak", name: "StreamPeak", description: "Direct HTTP stream provider.", manifest: "https://addon.streampeak.workers.dev/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "stream-store", name: "Stream Store", description: "Curated stream store.", manifest: "https://stremio-stream-store.vercel.app/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "gemini-recommender", name: "Gemini Recommender", description: "AI-powered recommendations.", manifest: "https://stremio-gemini-recommender.vercel.app/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "anime-kitsu", name: "Anime Kitsu", description: "Anime catalogues powered by Kitsu.", manifest: "https://anime-kitsu.strem.fun/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "hdhub", name: "HDHub", description: "HD releases in 2160p/1080p/720p.", manifest: "https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "nebulastreams", name: "NebulaStreams", description: "Aggregated direct streams.", manifest: "https://nebulastreams.onrender.com/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "jackettio", name: "Jackettio", description: "Jackett-powered torrent search.", manifest: "https://jackettio.elfhosted.com/manifest.json", platform: "stremio", streamKind: "torrent" },
  { id: "streamx", name: "StreamX", description: "Direct stream aggregator.", manifest: "https://streamx.electron.al/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "tmdb-addon", name: "TMDB Addon", description: "Rich TMDB metadata and posters.", manifest: "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "tpb-plus", name: "ThePirateBay+", description: "TPB torrent index.", manifest: "https://thepiratebay-plus.strem.fun/manifest.json", platform: "stremio", streamKind: "torrent" },
  { id: "stremio-addons-net", name: "Stremio Addons Directory", description: "Community add-on directory.", manifest: "https://stremio-addons.net/api/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "opensubtitles", name: "OpenSubtitles v3", description: "Community subtitles in every language.", manifest: "https://opensubtitles-v3.strem.io/manifest.json", platform: "stremio", streamKind: "subtitles" },
  { id: "cinemeta", name: "Cinemeta", description: "Official movie & series metadata catalogue.", manifest: "https://v3-cinemeta.strem.io/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "public-domain", name: "Public Domain Movies", description: "Free, legal classics — direct HTTP streams.", manifest: "https://public-domain-movies.now.sh/manifest.json", platform: "stremio", streamKind: "http" },
];

export const NUVIO_PLUGINS: Addon[] = [
  { id: "yoru", name: "Yoru", description: "Yoru provider bundle for Nuvio.", manifest: "https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json", platform: "nuvio", streamKind: "http" },
  { id: "d3adlyrocket", name: "D3adlyRocket", description: "All-in-One Nuvio provider pack.", manifest: "https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/refs/heads/main/manifest.json", platform: "nuvio", streamKind: "http" },
  { id: "easystreams", name: "Easystreams", description: "Italian-focused Nuvio providers.", manifest: "https://raw.githubusercontent.com/realbestia1/nuvio-providers-it/refs/heads/main/manifest.json", platform: "nuvio", streamKind: "http" },
];

/** Everything ships enabled for every account, forever. */
export const ALL_ADDONS: Addon[] = [...STREMIO_ADDONS, ...NUVIO_PLUGINS];

/** Add-ons whose streams *might* be resolvable and played by WuHubHD's own player. */
export const IN_APP_ADDONS: Addon[] = ALL_ADDONS.filter((a) => a.streamKind === "http");

export type Compatibility = {
  playable: boolean;
  label: string;
  guidance: string;
};

/** Fallback-only compatibility check, used until the live manifest resolves. */
export function checkCompatibility(addon: Addon): Compatibility {
  switch (addon.streamKind) {
    case "http":
      return {
        playable: true,
        label: "Playable in app",
        guidance: "Returns direct HTTP/HLS links, so WuHubHD streams it natively.",
      };
    case "torrent":
      return {
        playable: false,
        label: "Torrent pack",
        guidance: "This pack only returns magnet links, which browsers can't play directly.",
      };
    case "subtitles":
      return {
        playable: false,
        label: "Subtitles only",
        guidance: "Supplies subtitle tracks, not video.",
      };
    default:
      return {
        playable: false,
        label: "Catalogue only",
        guidance: "Adds catalogues, artwork and metadata — there is no video stream to play.",
      };
  }
}

/** stremio:// deep link — kept only for the advanced/manual disclosure. */
export function stremioInstallUrl(manifest: string) {
  return `stremio://${manifest.replace(/^https?:\/\//, "")}`;
}

/** Web fallback — opens the add-on install screen in Stremio Web. */
export function stremioWebUrl(manifest: string) {
  return `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifest)}`;
}

/** nuvio:// deep link for provider packs — kept only for the advanced disclosure. */
export function nuvioInstallUrl(manifest: string) {
  return `nuvio://install?url=${encodeURIComponent(manifest)}`;
}

export function installUrl(addon: Addon) {
  return addon.platform === "nuvio" ? nuvioInstallUrl(addon.manifest) : stremioInstallUrl(addon.manifest);
}
