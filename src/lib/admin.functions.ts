import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "@/lib/admin-helpers.server";

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // is_admin covers both 'admin' and 'super_admin'
    const { data, error } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
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
type TopRow = { tmdb_id: number; media_type: string; title: string; plays: number };

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    // Uses a security-definer DB function so no privileged service key is needed.
    const { data, error } = await context.supabase.rpc("admin_stats");
    if (error) throw new Error(error.message);
    const stats = (data ?? {}) as {
      users?: number;
      plays24h?: number;
      plays7d?: number;
      watchlist?: number;
      errors24h?: number;
      top?: TopRow[];
    };
    return {
      users: stats.users ?? 0,
      plays24h: stats.plays24h ?? 0,
      plays7d: stats.plays7d ?? 0,
      watchlist: stats.watchlist ?? 0,
      errors24h: stats.errors24h ?? 0,
      top: stats.top ?? [],
    };
  });

