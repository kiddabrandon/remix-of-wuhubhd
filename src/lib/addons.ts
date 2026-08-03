// Stremio add-ons and Nuvio providers offered in-app.
// Installing opens the Stremio protocol handler (desktop/mobile app),
// with a web fallback to the Stremio web player.

export type Addon = {
  id: string;
  name: string;
  description: string;
  manifest: string;
};

export const STREMIO_ADDONS: Addon[] = [
  { id: "torrentio", name: "Torrentio", description: "Torrent streams from public trackers.", manifest: "https://torrentio.strem.fun/manifest.json" },
  { id: "opensubtitles", name: "OpenSubtitles v3", description: "Community subtitles in every language.", manifest: "https://opensubtitles-v3.strem.io/manifest.json" },
  { id: "cinemeta", name: "Cinemeta", description: "Official movie & series metadata catalogue.", manifest: "https://v3-cinemeta.strem.io/manifest.json" },
  { id: "watchhub", name: "WatchHub", description: "Where to stream, rent, or buy legally.", manifest: "https://watchhub.strem.io/manifest.json" },
  { id: "public-domain", name: "Public Domain Movies", description: "Free, legal classics.", manifest: "https://public-domain-movies.now.sh/manifest.json" },
  { id: "youtube", name: "YouTube", description: "YouTube channels and videos inside Stremio.", manifest: "https://v3-channels.strem.io/manifest.json" },
  { id: "anime-kitsu", name: "Anime Kitsu", description: "Anime catalogues powered by Kitsu.", manifest: "https://anime-kitsu.strem.fun/manifest.json" },
  { id: "trakt", name: "Trakt", description: "Sync your Trakt lists and history.", manifest: "https://497aa58fb47a-trakt.baby-beamup.club/manifest.json" },
  { id: "tmdb-addon", name: "TMDB Addon", description: "Rich TMDB metadata and posters.", manifest: "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json" },
];

export const NUVIO_PLUGINS: Addon[] = [
  { id: "yoru", name: "Yoru", description: "Yoru provider bundle for Nuvio.", manifest: "https://raw.githubusercontent.com/yoruix/nuvio-providers/refs/heads/main/manifest.json" },
  { id: "d3adlyrocket", name: "D3adlyRocket", description: "All-in-One Nuvio provider pack.", manifest: "https://raw.githubusercontent.com/D3adlyRocket/All-in-One-Nuvio/refs/heads/main/manifest.json" },
  { id: "easystreams", name: "Easystreams", description: "Italian-focused Nuvio providers.", manifest: "https://raw.githubusercontent.com/realbestia1/nuvio-providers-it/refs/heads/main/manifest.json" },
];

/** stremio:// deep link that opens the install prompt in the Stremio app. */
export function stremioInstallUrl(manifest: string) {
  return `stremio://${manifest.replace(/^https?:\/\//, "")}`;
}

/** Web fallback — opens the add-on install screen in Stremio Web. */
export function stremioWebUrl(manifest: string) {
  return `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifest)}`;
}
