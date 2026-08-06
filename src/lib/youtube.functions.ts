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
  limit: z.number().int().min(1).max(40).optional(),
});

/** Public web-client key used by youtube.com itself — not a private credential. */
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

type Renderer = {
  videoRenderer?: {
    videoId?: string;
    title?: { runs?: { text?: string }[] };
    ownerText?: { runs?: { text?: string }[] };
    publishedTimeText?: { simpleText?: string };
    thumbnail?: { thumbnails?: { url: string; width: number }[] };
  };
};

/** Server-side YouTube search through YouTube's own web client endpoint. */
export const searchYoutube = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeVideo[]> => {
    const limit = data.limit ?? 24;
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: { client: { clientName: "WEB", clientVersion: "2.20240401.00.00", hl: "en", gl: "US" } },
          query: data.q,
          params: "EgIQAQ%3D%3D", // videos only
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        contents?: {
          twoColumnSearchResultsRenderer?: {
            primaryContents?: {
              sectionListRenderer?: { contents?: { itemSectionRenderer?: { contents?: Renderer[] } }[] };
            };
          };
        };
      };

      const sections =
        json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];
      const out: YoutubeVideo[] = [];
      for (const section of sections) {
        for (const item of section.itemSectionRenderer?.contents ?? []) {
          const v = item.videoRenderer;
          if (!v?.videoId) continue;
          const thumbs = v.thumbnail?.thumbnails ?? [];
          out.push({
            id: v.videoId,
            title: v.title?.runs?.map((r) => r.text ?? "").join("") || "Untitled",
            channel: v.ownerText?.runs?.[0]?.text ?? "YouTube",
            thumbnail:
              thumbs.find((t) => t.width >= 336)?.url ??
              thumbs.at(-1)?.url ??
              `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            published: v.publishedTimeText?.simpleText ?? null,
          });
          if (out.length >= limit) return out;
        }
      }
      return out;
    } catch {
      return [];
    }
  });

const VideoSchema = z.object({ id: z.string().min(5).max(20) });

export type YoutubeVideoDetails = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
};

/** Lightweight title/author lookup via YouTube's public oEmbed endpoint. */
export const youtubeVideoDetails = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => VideoSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeVideoDetails> => {
    const fallback: YoutubeVideoDetails = {
      id: data.id,
      title: "YouTube video",
      channel: "YouTube",
      thumbnail: `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
    };
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${data.id}`,
        )}`,
        { signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) return fallback;
      const json = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
      return {
        id: data.id,
        title: json.title ?? fallback.title,
        channel: json.author_name ?? fallback.channel,
        thumbnail: json.thumbnail_url ?? fallback.thumbnail,
      };
    } catch {
      return fallback;
    }
  });
