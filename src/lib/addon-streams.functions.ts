import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AddonResolveResult, AddonStatusReport, ResolveAllResult } from "@/lib/addon-types";

const ResolveOneSchema = z.object({
  addonId: z.string().min(1).max(60),
  type: z.enum(["movie", "series"]),
  imdbId: z.string().regex(/^tt\d+$/),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(0).max(2000).optional(),
});

const ResolveAllSchema = z.object({
  type: z.enum(["movie", "series"]),
  imdbId: z.string().regex(/^tt\d+$/),
  tmdbId: z.number().int().positive().optional(),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(0).max(2000).optional(),
});

/** Queries a single Stremio add-on's stream endpoint. */
export const resolveAddonStreams = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ResolveOneSchema.parse(d))
  .handler(async ({ data }): Promise<AddonResolveResult> => {
    const { ALL_ADDONS } = await import("@/lib/addons");
    const { fetchStremioStreams } = await import("@/lib/addon-streams.server");
    const addon = ALL_ADDONS.find((a) => a.id === data.addonId);
    if (!addon) return { streams: [], error: "Unknown add-on." };

    const id =
      data.type === "series" && data.season != null && data.episode != null
        ? `${data.imdbId}:${data.season}:${data.episode}`
        : data.imdbId;

    try {
      const streams = (await fetchStremioStreams(addon, id, data.type)).slice(0, 20);
      if (streams.length === 0) return { streams: [], error: "No links found for this title yet." };
      return { streams, error: null };
    } catch (e) {
      return {
        streams: [],
        error: e instanceof Error ? e.message : "The add-on didn't respond in time.",
      };
    }
  });

/** Fans out across every bundled Stremio add-on and Nuvio pack. */
export const resolveAllAddonStreams = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ResolveAllSchema.parse(d))
  .handler(async ({ data }): Promise<ResolveAllResult> => {
    const { resolveAll } = await import("@/lib/addon-streams.server");
    return resolveAll(data);
  });

/** Health check for every bundled add-on / provider pack. */
export const getAddonStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<AddonStatusReport> => {
    const { checkAllAddons } = await import("@/lib/addon-streams.server");
    return checkAllAddons();
  },
);

/**
 * Deep verification of the Nuvio provider packs (Yoru, D3adlyRocket, …):
 * manifest reachability plus per-provider script load, with clear diagnostics.
 */
export const verifyProviderPacks = createServerFn({ method: "GET" }).handler(async () => {
  const { NUVIO_PLUGINS } = await import("@/lib/addons");
  const { verifyNuvioPack } = await import("@/lib/nuvio.server");
  const results = await Promise.all(
    NUVIO_PLUGINS.map((p) => verifyNuvioPack(p.id, p.name, p.manifest)),
  );
  return {
    checkedAt: new Date().toISOString(),
    packs: results,
    totalProviders: results.reduce((n, r) => n + r.declared, 0),
    totalLoaded: results.reduce((n, r) => n + r.loaded, 0),
    totalFailed: results.reduce((n, r) => n + r.failed, 0),
  };
});
