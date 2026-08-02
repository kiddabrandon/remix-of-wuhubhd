import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "@/lib/admin-helpers.server";

export const getSiteConfig = createServerFn({ method: "GET" }).handler(async (): Promise<{ json: string }> => {
  // Public read via the publishable key — app_config allows anonymous SELECT,
  // so no privileged service key is required (keeps Netlify deploys working).
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { json: "{}" };
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined as never },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.from("app_config").select("value").eq("id", "site").maybeSingle();
  if (error) return { json: "{}" };
  return { json: JSON.stringify(data?.value ?? {}) };
});

const SaveSchema = z.object({
  json: z.string(),
});

export const saveSiteConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveSchema.parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const value = JSON.parse(data.json);
    const { error } = await context.supabase
      .from("app_config")
      .upsert({ id: "site", value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
