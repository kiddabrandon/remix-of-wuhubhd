import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const mediaType = z.enum(["movie", "tv"]);

const PreferencesSchema = z.record(z.string(), z.any());

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = ((context.claims as any)?.email as string | undefined) ?? null;
    const displayName = email ? email.split("@")[0] : null;
    await context.supabase
      .from("profiles")
      .upsert({
        id: context.userId,
        email,
        display_name: displayName,
        preferences: {},
        updated_at: new Date().toISOString(),
      }, { onConflict: "id", ignoreDuplicates: true });

    const { data, error } = await context.supabase
      .from("profiles")
      .select("id,email,display_name,avatar_url,preferences")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { id: context.userId, email, display_name: displayName, avatar_url: null, preferences: {} };
  });

export const saveMyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { preferences: Record<string, any> }) =>
    z.object({ preferences: PreferencesSchema }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const email = ((context.claims as any)?.email as string | undefined) ?? null;
    const { error } = await context.supabase
      .from("profiles")
      .upsert({
        id: context.userId,
        email,
        display_name: email ? email.split("@")[0] : null,
        preferences: data.preferences,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWatchlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_watchlists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tmdb_id: number; media_type: "movie" | "tv"; title: string; poster_path?: string | null; year?: string }) =>
    z.object({
      tmdb_id: z.number().int(),
      media_type: mediaType,
      title: z.string(),
      poster_path: z.string().nullable().optional(),
      year: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_watchlists")
      .upsert(
        {
          user_id: context.userId,
          tmdb_id: data.tmdb_id,
          media_type: data.media_type,
          title: data.title,
          poster_path: data.poster_path ?? null,
          year: data.year ?? null,
        },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tmdb_id: number; media_type: "movie" | "tv" }) =>
    z.object({ tmdb_id: z.number().int(), media_type: mediaType }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_watchlists")
      .delete()
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id)
      .eq("media_type", data.media_type);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_progress")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    tmdb_id: number;
    media_type: "movie" | "tv";
    title: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    season?: number | null;
    episode?: number | null;
    progress_pct?: number;
    position_seconds?: number;
    duration_seconds?: number;
    fully_watched?: boolean;
    mark_episode?: { s: number; e: number };
  }) => d)
  .handler(async ({ context, data }) => {
    const supa = context.supabase;
    const { data: existing } = await supa
      .from("user_progress")
      .select("watched_episodes")
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id)
      .eq("media_type", data.media_type)
      .maybeSingle();

    let watched: string[] = Array.isArray(existing?.watched_episodes) ? (existing!.watched_episodes as string[]) : [];
    if (data.mark_episode) {
      const tag = `s${data.mark_episode.s}e${data.mark_episode.e}`;
      if (!watched.includes(tag)) watched = [...watched, tag];
    }

    const pct = data.progress_pct ?? (
      data.position_seconds && data.duration_seconds
        ? Math.min(100, Math.round((data.position_seconds / data.duration_seconds) * 100))
        : 0
    );
    const fully = data.fully_watched ?? (
      data.position_seconds && data.duration_seconds
        ? data.position_seconds / data.duration_seconds >= 0.9
        : false
    );

    const { error } = await supa
      .from("user_progress")
      .upsert(
        {
          user_id: context.userId,
          tmdb_id: data.tmdb_id,
          media_type: data.media_type,
          title: data.title,
          poster_path: data.poster_path ?? null,
          backdrop_path: data.backdrop_path ?? null,
          season: data.season ?? null,
          episode: data.episode ?? null,
          progress_pct: pct,
          position_seconds: data.position_seconds ?? 0,
          duration_seconds: data.duration_seconds ?? 0,
          fully_watched: fully,
          watched_episodes: watched,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, fully_watched: fully };
  });

export const removeProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tmdb_id: number; media_type: "movie" | "tv" }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_progress")
      .delete()
      .eq("user_id", context.userId)
      .eq("tmdb_id", data.tmdb_id)
      .eq("media_type", data.media_type);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
