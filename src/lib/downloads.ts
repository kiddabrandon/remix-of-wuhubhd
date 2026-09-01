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

/** Builds the SPlayer app deep link used to hand off a resolved stream for download. */
export function splayerUrl(streamUrl: string, title: string): string {
  const params = `url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(title)}`;
  return `splayer://download?${params}`;
}

/** Web fallback if the SPlayer app isn't installed (e.g. store/landing page with the same params). */
export function splayerWebFallbackUrl(streamUrl: string, title: string): string {
  const params = `url=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(title)}`;
  return `https://splayer.org/download?${params}`;
}

/**
 * Opens SPlayer for a resolved stream. Browsers silently ignore unknown
 * protocol handlers, so we detect a failed launch (page never hides) and
 * fall back to the SPlayer web handler in a new tab.
 */
export function launchSplayer(streamUrl: string, title: string): void {
  if (typeof window === "undefined" || !streamUrl) return;
  const deepLink = splayerUrl(streamUrl, title);
  let launched = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") launched = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.location.href = deepLink;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (!launched && !document.hidden) {
      window.open(splayerWebFallbackUrl(streamUrl, title), "_blank", "noopener");
    }
  }, 1400);
}
