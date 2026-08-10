// Shared, client-safe types for the add-on system (Stremio add-ons + Nuvio packs).

/** How a resolved link can be played. */
export type StreamKindTag = "direct" | "debrid" | "magnet";

export type AddonStream = {
  name: string;
  description: string;
  /** Playable url, or a magnet URI when `kind === "magnet"`. */
  url: string;
  addonId: string;
  addonName: string;
  quality: string;
  size: string | null;
  kind: StreamKindTag;
  /** Human label for the classification, e.g. "Debrid (Real-Debrid)". */
  kindLabel: string;
};

export type ResolveAllResult = {
  streams: AddonStream[];
  tried: number;
  errors: { addonId: string; addonName: string; message: string }[];
};

export type AddonResolveResult = {
  streams: AddonStream[];
  error: string | null;
};

export type AddonStatus = {
  id: string;
  name: string;
  platform: "stremio" | "nuvio";
  ok: boolean;
  /** Milliseconds the manifest fetch took. */
  latencyMs: number;
  /** Whether this add-on can return streams (vs catalogue/subtitles only). */
  canStream: boolean;
  /** Number of providers in a Nuvio pack, when applicable. */
  providers?: number;
  error: string | null;
};

export type AddonStatusReport = {
  checkedAt: string;
  total: number;
  okCount: number;
  failed: AddonStatus[];
  statuses: AddonStatus[];
};

/** Timeout applied to every individual add-on network call. */
export const ADDON_TIMEOUT_MS = 5_000;

/** Builds an external-player deep link for magnet / raw torrent sources. */
export function externalPlayerUrl(app: "vlc" | "mpv" | "web", url: string) {
  if (app === "vlc") return `vlc://${url}`;
  if (app === "mpv") return `mpv://${url}`;
  return url;
}
