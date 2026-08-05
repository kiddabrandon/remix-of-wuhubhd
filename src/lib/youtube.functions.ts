import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type YoutubeVideo = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  published: string | null;
};

const SearchSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(30).optional(),
});

/**
 * YouTube search without an API key: proxies a public Invidious-compatible
 * instance, falling back across mirrors so the page stays usable.
 */
export const searchYoutube = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeVideo[]> => {
    const mirrors = [
      "https://inv.nadeko.net",
      "https://invidious.nerdvpn.de",
      "https://yewtu.be",
      "https://vid.puffyan.us",
    ];
    const limit = data.limit ?? 24;

    for (const base of mirrors) {
      try {
        const res = await fetch(
          `${base}/api/v1/search?q=${encodeURIComponent(data.q)}&type=video&sort_by=relevance`,
          { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) },
        );
        if (!res.ok) continue;
        const json = (await res.json()) as {
          type?: string;
          videoId?: string;
          title?: string;
          author?: string;
          publishedText?: string;
          videoThumbnails?: { url: string; width: number }[];
        }[];
        const out = (Array.isArray(json) ? json : [])
          .filter((v) => v.videoId && (v.type ?? "video") === "video")
          .slice(0, limit)
          .map((v) => {
            const thumbs = v.videoThumbnails ?? [];
            const best =
              thumbs.find((t) => t.width >= 480)?.url ??
              thumbs[0]?.url ??
              `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
            return {
              id: v.videoId!,
              title: v.title ?? "Untitled",
              channel: v.author ?? "YouTube",
              thumbnail: best.startsWith("http") ? best : `${base}${best}`,
              published: v.publishedText ?? null,
            };
          });
        if (out.length) return out;
      } catch {
        // try the next mirror
      }
    }
    return [];
  });
