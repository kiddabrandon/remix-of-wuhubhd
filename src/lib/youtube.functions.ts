import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type YoutubeVideo = {
  id: string;
  title: string;
  channel: string;
  channelId: string | null;
  thumbnail: string;
  published: string | null;
};

export type YoutubeShort = {
  id: string;
  title: string;
  channel: string;
  channelId: string | null;
  thumbnail: string;
  views: string | null;
};

const SearchSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(40).optional(),
});

/** Public web-client key used by youtube.com itself — not a private credential. */
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const WEB_CONTEXT = { client: { clientName: "WEB", clientVersion: "2.20240401.00.00", hl: "en", gl: "US" } };

function extractBrowseId(owner?: {
  runs?: { text?: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string } } }[];
}): string | null {
  return owner?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null;
}

type VideoRenderer = {
  videoId?: string;
  title?: { runs?: { text?: string }[] };
  ownerText?: { runs?: { text?: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string } } }[] };
  publishedTimeText?: { simpleText?: string };
  thumbnail?: { thumbnails?: { url: string; width: number }[] };
};

type ReelRenderer = {
  videoId?: string;
  headline?: { simpleText?: string; runs?: { text?: string }[] };
  thumbnail?: { thumbnails?: { url: string; width: number }[] };
  viewCountText?: { simpleText?: string };
  accessibilityText?: string;
};

type ShortsLockupRenderer = {
  entityId?: string;
  onTap?: { innertubeCommand?: { reelWatchEndpoint?: { videoId?: string } } };
  thumbnail?: { thumbnails?: { url: string; width: number }[] };
  overlayMetadata?: { primaryText?: { content?: string }; secondaryText?: { content?: string } };
  accessibilityText?: string;
};

type Renderer = {
  videoRenderer?: VideoRenderer;
  reelItemRenderer?: ReelRenderer;
  shortsLockupViewModel?: ShortsLockupRenderer;
  richItemRenderer?: { content?: Renderer };
  itemSectionRenderer?: { contents?: Renderer[] };
};

function bestThumb(thumbs?: { url: string; width: number }[], fallbackId?: string) {
  return (
    thumbs?.find((t) => t.width >= 336)?.url ??
    thumbs?.at(-1)?.url ??
    (fallbackId ? `https://i.ytimg.com/vi/${fallbackId}/hqdefault.jpg` : "")
  );
}

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
          context: WEB_CONTEXT,
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
          out.push({
            id: v.videoId,
            title: v.title?.runs?.map((r) => r.text ?? "").join("") || "Untitled",
            channel: v.ownerText?.runs?.[0]?.text ?? "YouTube",
            channelId: extractBrowseId(v.ownerText),
            thumbnail: bestThumb(v.thumbnail?.thumbnails, v.videoId),
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

/** Search YouTube Shorts (duration <4 min filter). */
export const searchYoutubeShorts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeShort[]> => {
    const limit = data.limit ?? 16;
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: WEB_CONTEXT,
          query: data.q,
          params: "EgIYAQ%3D%3D", // short duration filter
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        contents?: {
          twoColumnSearchResultsRenderer?: {
            primaryContents?: {
              sectionListRenderer?: { contents?: Renderer[] };
            };
          };
        };
      };

      const sections = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents ?? [];
      const out: YoutubeShort[] = [];

      const pushFromRenderer = (r: Renderer) => {
        if (r.reelItemRenderer?.videoId) {
          const reel = r.reelItemRenderer;
          out.push({
            id: reel.videoId!,
            title:
              reel.headline?.simpleText ??
              reel.headline?.runs?.map((t) => t.text ?? "").join("") ??
              reel.accessibilityText ??
              "Short",
            channel: "YouTube",
            channelId: null,
            thumbnail: bestThumb(reel.thumbnail?.thumbnails, reel.videoId),
            views: reel.viewCountText?.simpleText ?? null,
          });
        }
        const lockup = r.shortsLockupViewModel;
        const lockupId = lockup?.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ?? lockup?.entityId;
        if (lockupId) {
          out.push({
            id: lockupId,
            title: lockup?.overlayMetadata?.primaryText?.content ?? lockup?.accessibilityText ?? "Short",
            channel: "YouTube",
            channelId: null,
            thumbnail: bestThumb(lockup?.thumbnail?.thumbnails, lockupId),
            views: lockup?.overlayMetadata?.secondaryText?.content ?? null,
          });
        }
      };

      const walk = (items: Renderer[] | undefined) => {
        for (const item of items ?? []) {
          if (item.itemSectionRenderer?.contents) {
            walk(item.itemSectionRenderer.contents);
            continue;
          }
          if (item.richItemRenderer?.content) {
            pushFromRenderer(item.richItemRenderer.content);
            continue;
          }
          pushFromRenderer(item);
        }
      };
      walk(sections);

      const seen = new Set<string>();
      const dedup = out.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
      return dedup.slice(0, limit);
    } catch {
      return [];
    }
  });

const VideoSchema = z.object({ id: z.string().min(5).max(20) });

export type YoutubeVideoDetails = {
  id: string;
  title: string;
  channel: string;
  channelId: string | null;
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
      channelId: null,
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
      const json = (await res.json()) as {
        title?: string;
        author_name?: string;
        author_url?: string;
        thumbnail_url?: string;
      };
      const channelId = json.author_url?.match(/\/channel\/([\w-]+)/)?.[1] ?? null;
      return {
        id: data.id,
        title: json.title ?? fallback.title,
        channel: json.author_name ?? fallback.channel,
        channelId,
        thumbnail: json.thumbnail_url ?? fallback.thumbnail,
      };
    } catch {
      return fallback;
    }
  });

const ChannelSchema = z.object({ id: z.string().min(2).max(64) });

export type YoutubeChannel = {
  id: string;
  title: string;
  avatar: string | null;
  banner: string | null;
  subscribers: string | null;
  description: string;
  videos: YoutubeVideo[];
};

type BrowseVideoRenderer = {
  videoRenderer?: VideoRenderer;
  gridVideoRenderer?: VideoRenderer;
  richItemRenderer?: { content?: BrowseVideoRenderer };
  itemSectionRenderer?: { contents?: BrowseVideoRenderer[] };
  richSectionRenderer?: { content?: { richShelfRenderer?: { contents?: BrowseVideoRenderer[] } } };
  tabRenderer?: {
    title?: string;
    content?: {
      richGridRenderer?: { contents?: BrowseVideoRenderer[] };
      sectionListRenderer?: { contents?: BrowseVideoRenderer[] };
    };
  };
};

/** Fetch a channel's header + recent uploads through the InnerTube browse endpoint. */
export const youtubeChannel = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ChannelSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeChannel | null> => {
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${INNERTUBE_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: WEB_CONTEXT, browseId: data.id }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        metadata?: {
          channelMetadataRenderer?: { title?: string; description?: string; externalId?: string; avatar?: { thumbnails?: { url: string }[] } };
        };
        header?: {
          c4TabbedHeaderRenderer?: {
            avatar?: { thumbnails?: { url: string }[] };
            banner?: { thumbnails?: { url: string }[] };
            subscriberCountText?: { simpleText?: string };
          };
          pageHeaderRenderer?: {
            content?: {
              pageHeaderViewModel?: {
                image?: { decoratedAvatarViewModel?: { avatar?: { avatarViewModel?: { image?: { sources?: { url: string }[] } } } } };
                banner?: { imageBannerViewModel?: { image?: { sources?: { url: string }[] } } };
                metadata?: { contentMetadataViewModel?: { metadataRows?: { metadataParts?: { text?: { content?: string } }[] }[] } };
              };
            };
          };
        };
        contents?: {
          twoColumnBrowseResultsRenderer?: {
            tabs?: BrowseVideoRenderer[];
          };
        };
      };

      const meta = json.metadata?.channelMetadataRenderer;
      const c4 = json.header?.c4TabbedHeaderRenderer;
      const pageHeader = json.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
      const avatar =
        c4?.avatar?.thumbnails?.at(-1)?.url ??
        pageHeader?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.at(-1)?.url ??
        meta?.avatar?.thumbnails?.at(-1)?.url ??
        null;
      const banner = c4?.banner?.thumbnails?.at(-1)?.url ?? pageHeader?.banner?.imageBannerViewModel?.image?.sources?.at(-1)?.url ?? null;
      const subscribers =
        c4?.subscriberCountText?.simpleText ??
        pageHeader?.metadata?.contentMetadataViewModel?.metadataRows
          ?.flatMap((r) => r.metadataParts ?? [])
          .map((p) => p.text?.content)
          .find((t) => t && /subscriber/i.test(t)) ??
        null;

      const videos: YoutubeVideo[] = [];
      const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];

      const pushVideo = (v?: VideoRenderer) => {
        if (!v?.videoId) return;
        videos.push({
          id: v.videoId,
          title: v.title?.runs?.map((r) => r.text ?? "").join("") || "Untitled",
          channel: meta?.title ?? "Channel",
          channelId: meta?.externalId ?? data.id,
          thumbnail: bestThumb(v.thumbnail?.thumbnails, v.videoId),
          published: v.publishedTimeText?.simpleText ?? null,
        });
      };

      const walk = (items: BrowseVideoRenderer[] | undefined) => {
        for (const item of items ?? []) {
          if (item.videoRenderer) pushVideo(item.videoRenderer);
          if (item.gridVideoRenderer) pushVideo(item.gridVideoRenderer);
          if (item.richItemRenderer?.content) walk([item.richItemRenderer.content]);
          if (item.itemSectionRenderer?.contents) walk(item.itemSectionRenderer.contents);
          if (item.richSectionRenderer?.content?.richShelfRenderer?.contents)
            walk(item.richSectionRenderer.content.richShelfRenderer.contents);
          if (item.tabRenderer?.content?.richGridRenderer?.contents)
            walk(item.tabRenderer.content.richGridRenderer.contents);
          if (item.tabRenderer?.content?.sectionListRenderer?.contents)
            walk(item.tabRenderer.content.sectionListRenderer.contents);
        }
      };
      walk(tabs);

      return {
        id: meta?.externalId ?? data.id,
        title: meta?.title ?? "Channel",
        avatar,
        banner,
        subscribers,
        description: meta?.description ?? "",
        videos: videos.slice(0, 30),
      };
    } catch {
      return null;
    }
  });

// ---------------------------------------------------------------------------
// Channel search + rich video metadata
// ---------------------------------------------------------------------------

export type YoutubeChannelResult = {
  id: string;
  title: string;
  avatar: string;
  subscribers: string | null;
  videoCount: string | null;
  description: string;
};

type ChannelRenderer = {
  channelId?: string;
  title?: { simpleText?: string; runs?: { text?: string }[] };
  thumbnail?: { thumbnails?: { url: string; width: number }[] };
  videoCountText?: { simpleText?: string; runs?: { text?: string }[] };
  subscriberCountText?: { simpleText?: string };
  descriptionSnippet?: { runs?: { text?: string }[] };
};

/** Search YouTube channels (the "Channels" filter on youtube.com). */
export const searchYoutubeChannels = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SearchSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeChannelResult[]> => {
    const limit = data.limit ?? 16;
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: WEB_CONTEXT,
          query: data.q,
          params: "EgIQAg%3D%3D", // channels only
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        contents?: {
          twoColumnSearchResultsRenderer?: {
            primaryContents?: {
              sectionListRenderer?: { contents?: { itemSectionRenderer?: { contents?: { channelRenderer?: ChannelRenderer }[] } }[] };
            };
          };
        };
      };
      const sections =
        json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];
      const out: YoutubeChannelResult[] = [];
      for (const section of sections) {
        for (const item of section.itemSectionRenderer?.contents ?? []) {
          const c = item.channelRenderer;
          if (!c?.channelId) continue;
          const raw = c.thumbnail?.thumbnails?.at(-1)?.url ?? "";
          out.push({
            id: c.channelId,
            title: c.title?.simpleText ?? c.title?.runs?.map((r) => r.text ?? "").join("") ?? "Channel",
            avatar: raw.startsWith("//") ? `https:${raw}` : raw,
            subscribers: c.subscriberCountText?.simpleText ?? null,
            videoCount:
              c.videoCountText?.simpleText ??
              c.videoCountText?.runs?.map((r) => r.text ?? "").join("") ??
              null,
            description: c.descriptionSnippet?.runs?.map((r) => r.text ?? "").join("") ?? "",
          });
          if (out.length >= limit) return out;
        }
      }
      return out;
    } catch {
      return [];
    }
  });

export type YoutubeVideoInfo = YoutubeVideoDetails & {
  views: string | null;
  published: string | null;
  likes: string | null;
  description: string;
  subscribers: string | null;
  channelAvatar: string | null;
};

/** Full watch-page metadata (views, date, likes, description) via InnerTube `next`. */
export const youtubeVideoInfo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => VideoSchema.parse(d))
  .handler(async ({ data }): Promise<YoutubeVideoInfo> => {
    const base: YoutubeVideoInfo = {
      id: data.id,
      title: "YouTube video",
      channel: "YouTube",
      channelId: null,
      thumbnail: `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`,
      views: null,
      published: null,
      likes: null,
      description: "",
      subscribers: null,
      channelAvatar: null,
    };
    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${INNERTUBE_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: WEB_CONTEXT, videoId: data.id }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return base;
      const json = (await res.json()) as Record<string, unknown>;

      // Walk the results blob for the two renderers we care about.
      let primary: any = null;
      let secondary: any = null;
      const contents =
        (json as any)?.contents?.twoColumnWatchNextResults?.results?.results?.contents ?? [];
      for (const c of contents) {
        if (c?.videoPrimaryInfoRenderer) primary = c.videoPrimaryInfoRenderer;
        if (c?.videoSecondaryInfoRenderer) secondary = c.videoSecondaryInfoRenderer;
      }

      const runsText = (v: any): string =>
        v?.simpleText ?? (Array.isArray(v?.runs) ? v.runs.map((r: any) => r?.text ?? "").join("") : "");

      const owner = secondary?.owner?.videoOwnerRenderer;
      const likeButton =
        primary?.videoActions?.menuRenderer?.topLevelButtons?.find(
          (b: any) => b?.segmentedLikeDislikeButtonViewModel || b?.toggleButtonRenderer,
        );
      const likes =
        likeButton?.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel?.likeButtonViewModel
          ?.toggleButtonViewModel?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel?.title ??
        runsText(likeButton?.toggleButtonRenderer?.defaultText) ??
        null;

      const avatarRaw = owner?.thumbnail?.thumbnails?.at?.(-1)?.url ?? null;

      return {
        id: data.id,
        title: runsText(primary?.title) || base.title,
        channel: runsText(owner?.title) || base.channel,
        channelId: owner?.navigationEndpoint?.browseEndpoint?.browseId ?? null,
        thumbnail: base.thumbnail,
        views: runsText(primary?.viewCount?.videoViewCountRenderer?.viewCount) || null,
        published:
          runsText(primary?.dateText) ||
          runsText(primary?.relativeDateText) ||
          null,
        likes: likes || null,
        description:
          runsText(secondary?.attributedDescription) ||
          runsText(secondary?.description) ||
          "",
        subscribers: runsText(owner?.subscriberCountText) || null,
        channelAvatar: avatarRaw ? (avatarRaw.startsWith("//") ? `https:${avatarRaw}` : avatarRaw) : null,
      };
    } catch {
      return base;
    }
  });

/** A trending-ish Shorts feed for the dedicated Shorts page. */
export const shortsFeed = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SearchSchema.partial({ q: true }).parse(d ?? {}))
  .handler(async ({ data }): Promise<YoutubeShort[]> => {
    const q = data.q?.trim() || "shorts";
    const res = await searchYoutubeShorts({ data: { q, limit: data.limit ?? 30 } });
    return res;
  });
