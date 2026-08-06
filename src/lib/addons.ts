// Stremio add-ons and Nuvio providers bundled with WuHubHD.
// Every user gets the full set — there is no add-ons page to visit.
// "Install" hands the manifest to the Stremio/Nuvio app; in-app playback is
// only possible for add-ons that return direct HTTP/HLS stream URLs.

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
  streamKind: AddonStreamKind;
};

export const STREMIO_ADDONS: Addon[] = [
  { id: "torrentio", name: "Torrentio", description: "Torrent streams from public trackers.", manifest: "https://torrentio.strem.fun/manifest.json", platform: "stremio", streamKind: "torrent" },
  { id: "opensubtitles", name: "OpenSubtitles v3", description: "Community subtitles in every language.", manifest: "https://opensubtitles-v3.strem.io/manifest.json", platform: "stremio", streamKind: "subtitles" },
  { id: "cinemeta", name: "Cinemeta", description: "Official movie & series metadata catalogue.", manifest: "https://v3-cinemeta.strem.io/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "watchhub", name: "WatchHub", description: "Where to stream, rent, or buy legally.", manifest: "https://watchhub.strem.io/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "public-domain", name: "Public Domain Movies", description: "Free, legal classics — direct HTTP streams.", manifest: "https://public-domain-movies.now.sh/manifest.json", platform: "stremio", streamKind: "http" },
  { id: "youtube", name: "YouTube", description: "YouTube channels and videos inside Stremio.", manifest: "https://v3-channels.strem.io/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "anime-kitsu", name: "Anime Kitsu", description: "Anime catalogues powered by Kitsu.", manifest: "https://anime-kitsu.strem.fun/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "trakt", name: "Trakt", description: "Sync your Trakt lists and history.", manifest: "https://497aa58fb47a-trakt.baby-beamup.club/manifest.json", platform: "stremio", streamKind: "metadata" },
  { id: "tmdb-addon", name: "TMDB Addon", description: "Rich TMDB metadata and posters.", manifest: "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json", platform: "stremio", streamKind: "metadata" },
];

export const NUVIO_PLUGINS: Addon[] = [
  { id: "yoru", name: "Yoru", description: "Yoru provider bundle for Nuvio.", manifest: "https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json", platform: "nuvio", streamKind: "http" },
  { id: "d3adlyrocket", name: "D3adlyRocket", description: "All-in-One Nuvio provider pack.", manifest: "https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/refs/heads/main/manifest.json", platform: "nuvio", streamKind: "http" },
  { id: "easystreams", name: "Easystreams", description: "Italian-focused Nuvio providers.", manifest: "https://raw.githubusercontent.com/realbestia1/nuvio-providers-it/refs/heads/main/manifest.json", platform: "nuvio", streamKind: "http" },
];

/** Everything ships enabled for every account, forever. */
export const ALL_ADDONS: Addon[] = [...STREMIO_ADDONS, ...NUVIO_PLUGINS];

/** Add-ons whose streams can be resolved and played by WuHubHD's own player. */
export const IN_APP_ADDONS: Addon[] = ALL_ADDONS.filter((a) => a.streamKind === "http");

export type Compatibility = {
  playable: boolean;
  label: string;
  guidance: string;
};

/** Compatibility check that drives whether an in-app player option is offered. */
export function checkCompatibility(addon: Addon): Compatibility {
  switch (addon.streamKind) {
    case "http":
      return {
        playable: true,
        label: "Playable in app",
        guidance:
          "Returns direct HTTP/HLS links, so WuHubHD can stream it natively. If nothing resolves, the source has no release for this title yet — try another server.",
      };
    case "torrent":
      return {
        playable: false,
        label: "Needs Stremio / Nuvio",
        guidance:
          "This pack only returns magnet links. Browsers cannot play torrents, so install it into the Stremio or Nuvio app and play there. Tap Install to hand over the manifest.",
      };
    case "subtitles":
      return {
        playable: false,
        label: "Subtitles only",
        guidance:
          "Supplies subtitle tracks, not video. Install it in Stremio/Nuvio; inside WuHubHD pick your subtitle language in Settings instead.",
      };
    default:
      return {
        playable: false,
        label: "Catalogue only",
        guidance:
          "Adds catalogues, artwork and metadata — there is no video stream to play. Install it in Stremio/Nuvio to browse those catalogues.",
      };
  }
}

/** stremio:// deep link that opens the install prompt in the Stremio app. */
export function stremioInstallUrl(manifest: string) {
  return `stremio://${manifest.replace(/^https?:\/\//, "")}`;
}

/** Web fallback — opens the add-on install screen in Stremio Web. */
export function stremioWebUrl(manifest: string) {
  return `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifest)}`;
}

/** nuvio:// deep link for provider packs. */
export function nuvioInstallUrl(manifest: string) {
  return `nuvio://install?url=${encodeURIComponent(manifest)}`;
}

export function installUrl(addon: Addon) {
  return addon.platform === "nuvio" ? nuvioInstallUrl(addon.manifest) : stremioInstallUrl(addon.manifest);
}
