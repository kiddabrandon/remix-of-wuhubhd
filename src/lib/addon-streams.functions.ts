import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ALL_ADDONS } from "@/lib/addons";

const Schema = z.object({
  addonId: z.string().min(1).max(60),
  type: z.enum(["movie", "series"]),
  imdbId: z.string().regex(/^tt\d+$/),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(0).max(2000).optional(),
});

export type AddonStream = {
  name: string;
  description: string;
  url: string;
};

export type AddonResolveResult = {
  streams: AddonStream[];
  /** Set when nothing playable could be resolved — shown as troubleshooting text. */
  error: string | null;
};

/**
 * Queries a Stremio add-on's public stream endpoint and keeps only entries with a
 * direct HTTP/HLS url. Magnet-only results are dropped because browsers can't play them.
 */
export const resolveAddonStreams = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data }): Promise<AddonResolveResult> => {
    const addon = ALL_ADDONS.find((a) => a.id === data.addonId);
    if (!addon) return { streams: [], error: "Unknown add-on." };
    if (addon.platform !== "stremio" || addon.streamKind !== "http") {
      return {
        streams: [],
        error: "This add-on doesn't expose browser-playable streams. Install it in the Stremio or Nuvio app.",
      };
    }

    const base = addon.manifest.replace(/\/manifest\.json$/, "");
    const id =
      data.type === "series" && data.season != null && data.episode != null
        ? `${data.imdbId}:${data.season}:${data.episode}`
        : data.imdbId;

    try {
      const res = await fetch(`${base}/stream/${data.type}/${encodeURIComponent(id)}.json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { streams: [], error: `Add-on responded with ${res.status}.` };
      const json = (await res.json()) as {
        streams?: { name?: string; title?: string; description?: string; url?: string; infoHash?: string }[];
      };
      const streams: AddonStream[] = (json.streams ?? [])
        .filter((s) => typeof s.url === "string" && /^https?:\/\//.test(s.url))
        .slice(0, 20)
        .map((s) => ({
          name: s.name?.trim() || addon.name,
          description: (s.title || s.description || "").trim().slice(0, 120),
          url: s.url as string,
        }));

      if (streams.length === 0) {
        return {
          streams: [],
          error:
            "No browser-playable link for this title. The add-on only returned torrent sources — play it in Stremio or Nuvio instead.",
        };
      }
      return { streams, error: null };
    } catch {
      return { streams: [], error: "The add-on didn't respond in time. Try again or use another server." };
    }
  });
