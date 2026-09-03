// Pure, client-safe constants + helpers for the premium downloads feature.
// No server imports here — this module is shared by both server fns and UI.

export type TierId = "single" | "week" | "lifetime";

export type DownloadTier = {
  id: TierId;
  name: string;
  priceKes: number;
  credits: number;
  unlimited: boolean;
  expiresDays: number | null;
  blurb: string;
};

export const DOWNLOAD_TIERS: DownloadTier[] = [
  {
    id: "single",
    name: "Single Download",
    priceKes: 30,
    credits: 1,
    unlimited: false,
    expiresDays: null,
    blurb: "One download credit. Never expires.",
  },
  {
    id: "week",
    name: "Weekly Pass",
    priceKes: 100,
    credits: 20,
    unlimited: false,
    expiresDays: 7,
    blurb: "20 download credits. Valid for 7 days.",
  },
  {
    id: "lifetime",
    name: "Lifetime Unlimited",
    priceKes: 1000,
    credits: 0,
    unlimited: true,
    expiresDays: null,
    blurb: "Unlimited downloads, forever. One-time payment.",
  },
];

export function getTier(id: TierId): DownloadTier {
  const tier = DOWNLOAD_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

export type Quality = {
  id: "360p" | "480p" | "720p" | "1080p" | "4K";
  label: string;
  sizeHint: string;
};

export const QUALITIES: Quality[] = [
  { id: "360p", label: "360p", sizeHint: "~150MB / hr" },
  { id: "480p", label: "480p", sizeHint: "~280MB / hr" },
  { id: "720p", label: "720p", sizeHint: "~550MB / hr" },
  { id: "1080p", label: "1080p", sizeHint: "~1.1GB / hr" },
  { id: "4K", label: "4K", sizeHint: "~3.5GB / hr" },
];

/** Builds the SPlayer app deep link used to hand off a resolved stream. */
export function splayerUrl(streamUrl: string, title: string): string {
  const params = `url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(title)}`;
  return `splayer://play?${params}`;
}

/** Android intent URL — the only reliable way to hand a stream to an app from Chrome on Android. */
export function splayerIntentUrl(streamUrl: string, title: string): string {
  const clean = streamUrl.replace(/^https?:\/\//, "");
  const scheme = streamUrl.startsWith("https") ? "https" : "http";
  return (
    `intent://${clean}#Intent;scheme=${scheme};type=video/*;` +
    `S.title=${encodeURIComponent(title)};end`
  );
}

/** Where to get SPlayer if it isn't installed. */
export function splayerWebFallbackUrl(_streamUrl?: string, _title?: string): string {
  return "https://splayer.org/";
}

function isMagnet(url: string) {
  return url.startsWith("magnet:") || url.endsWith(".torrent");
}

/**
 * Triggers a real browser download of a resolved file. Cross-origin responses
 * ignore the `download` attribute, so this still falls back to opening the file
 * in a new tab, which is what actually saves the file on mobile browsers.
 */
export function browserDownload(streamUrl: string, title: string): void {
  if (typeof document === "undefined" || !streamUrl) return;
  if (isMagnet(streamUrl)) {
    window.location.href = streamUrl;
    return;
  }
  const a = document.createElement("a");
  a.href = streamUrl;
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim()}`;
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Hands a stream to SPlayer. Uses a hidden iframe (Android/desktop) or an
 * intent URL so an unregistered scheme can never navigate the page away, and
 * falls back to a real browser download when the app never takes focus.
 */
export function launchSplayer(streamUrl: string, title: string, opts?: { fallback?: boolean }): void {
  if (typeof window === "undefined" || !streamUrl) return;
  const isAndroid = /android/i.test(navigator.userAgent);
  const deepLink = isAndroid ? splayerIntentUrl(streamUrl, title) : splayerUrl(streamUrl, title);
  let launched = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") launched = true;
  };
  document.addEventListener("visibilitychange", onHide);

  if (isAndroid) {
    window.location.href = deepLink;
  } else {
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    frame.src = deepLink;
    document.body.appendChild(frame);
    window.setTimeout(() => frame.remove(), 1200);
  }

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!launched && !document.hidden && opts?.fallback !== false) {
      // SPlayer never took over — save the file directly instead of dead-ending.
      browserDownload(streamUrl, title);
    }
  }, 1600);
}
