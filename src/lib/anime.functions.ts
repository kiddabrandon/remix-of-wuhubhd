// Anime streaming with direct HiAnime scraper first, then Consumet-shaped
// public API fallbacks when a source blocks the runtime.
import { createServerFn } from "@tanstack/react-start";

export type { AnimeItem } from "@/lib/anilist";

const DEFAULT_BASES = [
  "https://api-aniwatch.onrender.com",
  "https://consumet-api-h1ga.onrender.com",
  "https://consumet-api-puce.vercel.app",
  "https://api-consumet-org.vercel.app",
  "https://api.consumet.org",
];

function bases(): string[] {
  const env = (process.env.ANIME_API_BASES || "").trim();
  const extra = env
    ? env.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  // Env-configured bases take priority.
  return Array.from(new Set([...extra, ...DEFAULT_BASES]));
}

export type AnimeEpisode = {
  id: string;
  number: number;
  title: string | null;
  image: string | null;
};

async function withBaseOverride<T>(baseUrl: string, fn: (h: any) => Promise<T>) {
  const { Hianime } = await import("hianime");
  const h = new Hianime() as any;
  h.BASE_URL = baseUrl;
  return fn(h);
}

async function hianimeEpisodes(id: number, title: string | undefined, malId: number | undefined, dub: boolean): Promise<AnimeEpisode[]> {
  let lastErr: unknown = null;
  for (const base of ["https://hianime.to", "https://hianimez.to"]) {
    try {
      return await withBaseOverride(base, async (h) => {
        const fromMal = await h.getEpisodesByMALID(String(malId ?? id)).catch(() => []);
        if (fromMal?.length) return fromMal.map((ep: any) => ({
          id: ep.id,
          number: Number(ep.number) || 0,
          title: ep.title || null,
          image: null,
        }));
        const detail = await h.search(title || String(id));
        const first = detail?.results?.[0];
        if (!first?.dataId) return [];
        const eps = await h.getEpisodes(first.dataId);
        return (eps ?? []).map((ep: any) => ({
          id: ep.id,
          number: Number(ep.number) || 0,
          title: ep.title || null,
          image: null,
        }));
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("HiAnime unreachable");
}

async function hianimeWatch(episodeId: string, dub: boolean) {
  let lastErr: unknown = null;
  for (const base of ["https://hianime.to", "https://hianimez.to"]) {
    try {
      return await withBaseOverride(base, async (h) => {
        const servers = await h.getEpisodeServers(episodeId);
        const list = dub ? servers.dub : servers.sub;
        const server = list?.find((s: any) => /hd|vid/i.test(s.name)) ?? list?.[0] ?? servers.sub?.[0] ?? servers.dub?.[0];
        if (!server?.id) throw new Error("No HiAnime server returned");
        const res = await h.getEpisodeSources(server.id);
        return {
          sources: (res.sources ?? []).map((s: any) => ({
            url: s.file,
            quality: s.type || server.name || "auto",
            isM3U8: String(s.file ?? "").includes(".m3u8") || s.type === "hls",
          })).filter((s: AnimeStreamSource) => !!s.url),
          subtitles: (res.tracks ?? []).filter((t: any) => t.file && t.kind === "captions").map((t: any) => ({ url: t.file, lang: t.label || "Subtitle" })),
          headers: res.headers ?? {},
          error: null as string | null,
        };
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("HiAnime source unreachable");
}

export type AnimeStreamSource = {
  url: string;
  quality: string;
  isM3U8: boolean;
};

async function consumet<T>(path: string, timeoutMs = 9000): Promise<T> {
  let lastErr: unknown = null;
  for (const base of bases()) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`${base}: HTTP ${res.status}`);
        continue;
      }
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All anime API mirrors failed");
}

function megaplayEmbed(episodeId: string, dub: boolean) {
  // HiAnime episode ids look like "one-piece-100?ep=2142"; Megaplay wants the numeric ep id.
  const epNum = /ep=(\d+)/.exec(episodeId)?.[1] ?? /(\d+)\s*$/.exec(episodeId)?.[1];
  if (!epNum) throw new Error("Could not derive a Megaplay episode id");
  return `https://megaplay.buzz/stream/s-2/${epNum}/${dub ? "dub" : "sub"}`;
}

export const animeEpisodes = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; malId?: number | null; title?: string; provider?: string; dub?: boolean }) => d)
  .handler(async ({ data }) => {
    const provider = data.provider || "hianime";
    const dubParam = data.dub ? "&dub=true" : "";
    try {
      // Megaplay plays HiAnime episode ids, so its episode list comes from HiAnime.
      if (provider === "hianime" || provider === "megaplay") {
        const episodes = await hianimeEpisodes(data.id, data.title, data.malId ?? undefined, !!data.dub);
        return { episodes, provider, dub: !!data.dub, error: episodes.length ? null : "No HiAnime episodes found" };
      }
      const info = await consumet<{ episodes?: AnimeEpisode[] }>(
        `/meta/anilist/info/${data.id}?provider=${encodeURIComponent(provider)}${dubParam}`,
      );
      return {
        episodes: info.episodes ?? [],
        provider,
        dub: !!data.dub,
        error: null as string | null,
      };
    } catch (e) {
      return {
        episodes: [] as AnimeEpisode[],
        provider,
        dub: !!data.dub,
        error: e instanceof Error ? e.message : "Providers unreachable",
      };
    }
  });

type WatchResult = {
  sources: AnimeStreamSource[];
  subtitles: { url: string; lang: string }[];
  headers: Record<string, string>;
  embed: string | null;
  error: string | null;
};

export const animeWatch = createServerFn({ method: "GET" })
  .inputValidator((d: { episodeId: string; provider?: string; dub?: boolean }) => d)
  .handler(async ({ data }): Promise<WatchResult> => {
    const provider = data.provider || "hianime";
    try {
      if (provider === "megaplay") {
        return {
          sources: [],
          subtitles: [],
          headers: {},
          embed: megaplayEmbed(data.episodeId, !!data.dub),
          error: null,
        };
      }
      if (provider === "hianime") {
        const res = await hianimeWatch(data.episodeId, !!data.dub);
        return { ...res, embed: null };
      }
      const res = await consumet<{
        sources?: AnimeStreamSource[];
        subtitles?: { url: string; lang: string }[];
        headers?: Record<string, string>;
      }>(
        `/meta/anilist/watch/${encodeURIComponent(data.episodeId)}?provider=${encodeURIComponent(provider)}`,
      );
      return {
        sources: res.sources ?? [],
        subtitles: res.subtitles ?? [],
        headers: res.headers ?? {},
        embed: null,
        error: null,
      };
    } catch (e) {
      return {
        sources: [],
        subtitles: [],
        headers: {},
        embed: null,
        error: e instanceof Error ? e.message : "Providers unreachable",
      };
    }
  });

