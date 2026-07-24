import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "@/lib/admin-helpers.server";

export const getSiteConfig = createServerFn({ method: "GET" }).handler(async (): Promise<{ json: string }> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("id", "site")
    .maybeSingle();
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_config")
      .upsert({ id: "site", value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
