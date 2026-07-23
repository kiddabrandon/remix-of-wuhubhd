import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "@/lib/admin-helpers.server";

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { admin: false };
    return { admin: Boolean(data) };
  });

export const getSiteConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined as any },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await client.from("app_config").select("*").eq("id", "site").maybeSingle();
  return (data?.value as Record<string, any>) ?? {};
});

export const saveSiteConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { value: Record<string, any> }) =>
    z.object({ value: z.record(z.string(), z.any()) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdminRow } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdminRow) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("app_config")
      .upsert({ id: "site", value: data.value, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantSelfAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Bootstrap: allow the FIRST authenticated user to claim admin. After that, disabled.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Admin already exists. Ask an existing admin to grant your role.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Announcements ----------
const AnnouncementInput = z.object({
  message: z.string().min(1).max(500),
  variant: z.enum(["info", "warn", "critical"]).default("info"),
});
export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const createAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnnouncementInput.parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("announcements").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Hero overrides ----------
const HeroInput = z.object({
  content_id: z.number().int().positive(),
  content_type: z.enum(["movie", "tv"]),
  title: z.string().min(1).max(200),
  tagline: z.string().max(280).optional().nullable(),
  backdrop_path: z.string().max(200).optional().nullable(),
  sort_order: z.number().int().default(0),
});
export const listHeroOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("hero_overrides")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const createHeroOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HeroInput.parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("hero_overrides").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const deleteHeroOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("hero_overrides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Feature flags ----------
const FlagInput = z.object({
  key: z.string().min(1).max(80),
  value: z.record(z.string(), z.any()),
});
export const listFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("feature_flags")
      .select("*")
      .order("key", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const upsertFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FlagInput.parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("feature_flags")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const deleteFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("feature_flags").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Server health ----------
export const listServerHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("server_health")
      .select("*")
      .order("server_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const PROVIDERS = [
  { name: "Videasy", url: "https://player.videasy.net", category: "stream" },
  { name: "VidLink", url: "https://vidlink.pro", category: "stream" },
  { name: "VidSrc", url: "https://vidsrc.to", category: "stream" },
  { name: "VixSrc", url: "https://vixsrc.to", category: "stream" },
];
export const probeAllProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const rows = await Promise.all(
      PROVIDERS.map(async (p) => {
        const started = Date.now();
        let online = false;
        let latency: number | null = null;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const r = await fetch(p.url, { method: "HEAD", signal: controller.signal });
          clearTimeout(timer);
          online = r.ok || (r.status >= 200 && r.status < 500);
          latency = Date.now() - started;
        } catch {
          online = false;
          latency = null;
        }
        return {
          server_name: p.name,
          category: p.category,
          is_online: online,
          latency_ms: latency,
          last_checked: new Date().toISOString(),
        };
      }),
    );
    const { error } = await context.supabase.from("server_health").upsert(rows);
    if (error) throw new Error(error.message);
    return rows;
  });

// ---------- Error logs ----------
export const listErrorLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const clearErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("error_logs")
      .delete()
      .gt("created_at", "1900-01-01");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Stats ----------
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [profiles, progressUsers, watchlistUsers, roleUsers, plays24, plays7, watchlist, errors24, topRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id"),
      supabaseAdmin.from("user_progress").select("user_id"),
      supabaseAdmin.from("user_watchlists").select("user_id"),
      supabaseAdmin.from("user_roles").select("user_id"),
      supabaseAdmin.from("user_progress").select("id", { count: "exact", head: true }).gte("updated_at", dayAgo),
      supabaseAdmin.from("user_progress").select("id", { count: "exact", head: true }).gte("updated_at", weekAgo),
      supabaseAdmin.from("user_watchlists").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
      supabaseAdmin
        .from("user_progress")
        .select("tmdb_id,media_type,title")
        .gte("updated_at", weekAgo)
        .limit(500),
    ]);
    const buckets = new Map<string, { tmdb_id: number; media_type: string; title: string; plays: number }>();
    for (const row of (topRes.data ?? []) as Array<{ tmdb_id: number; media_type: string; title: string }>) {
      const k = `${row.media_type}:${row.tmdb_id}`;
      const existing = buckets.get(k);
      if (existing) existing.plays += 1;
      else buckets.set(k, { tmdb_id: row.tmdb_id, media_type: row.media_type, title: row.title, plays: 1 });
    }
    const top = Array.from(buckets.values()).sort((a, b) => b.plays - a.plays).slice(0, 10);
    const userIds = new Set<string>();
    for (const row of (profiles.data ?? []) as Array<{ id?: string | null }>) if (row.id) userIds.add(row.id);
    for (const row of (progressUsers.data ?? []) as Array<{ user_id?: string | null }>) if (row.user_id) userIds.add(row.user_id);
    for (const row of (watchlistUsers.data ?? []) as Array<{ user_id?: string | null }>) if (row.user_id) userIds.add(row.user_id);
    for (const row of (roleUsers.data ?? []) as Array<{ user_id?: string | null }>) if (row.user_id) userIds.add(row.user_id);
    return {
      users: userIds.size,
      plays24h: plays24.count ?? 0,
      plays7d: plays7.count ?? 0,
      watchlist: watchlist.count ?? 0,
      errors24h: errors24.count ?? 0,
      top,
    };
  });
