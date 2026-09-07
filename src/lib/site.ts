export const SITE_NAME = "WuHubHD";
export const SITE_URL = "https://wuhubhd.site";

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/**
 * Canonical origin for links that leave the app (auth emails, share links).
 * Falls back to the current origin while developing or in a Lovable preview.
 */
export function siteOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const host = window.location.hostname;
  const isLocal = LOCAL_HOSTS.includes(host) || host.endsWith(".local");
  const isPreview =
    host.endsWith("lovable.app") ||
    host.endsWith("lovableproject.com") ||
    host.endsWith("netlify.app");
  return isLocal || isPreview ? window.location.origin : SITE_URL;
}

export function siteUrl(path = "/"): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
