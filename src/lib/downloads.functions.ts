import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DOWNLOAD_TIERS, getTier, type TierId } from "@/lib/downloads";

export type Entitlement = {
  unlimited: boolean;
  granted: number;
  used: number;
  remaining: number;
  tier: string | null;
  expires_at: string | null;
};

export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlement> => {
    const { data, error } = await context.supabase.rpc("download_entitlement");
    if (error) throw new Error(error.message);
    const raw = (data ?? {}) as Partial<Entitlement>;
    return {
      unlimited: !!raw.unlimited,
      granted: raw.granted ?? 0,
      used: raw.used ?? 0,
      remaining: raw.remaining ?? 0,
      tier: raw.tier ?? null,
      expires_at: raw.expires_at ?? null,
    };
  });

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("download_purchases")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDownloads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("download_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const StartPurchaseInput = z.object({
  tier: z.enum(["single", "week", "lifetime"]),
});

export const startPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tier: TierId }) => StartPurchaseInput.parse(d))
  .handler(async ({ context, data }) => {
    const tier = getTier(data.tier);
    const expiresAt = tier.expiresDays
      ? new Date(Date.now() + tier.expiresDays * 24 * 3600 * 1000).toISOString()
      : null;

    const { data: row, error } = await context.supabase
      .from("download_purchases")
      .insert({
        user_id: context.userId,
        tier: tier.id,
        amount_kes: tier.priceKes,
        credits_granted: tier.credits,
        unlimited: tier.unlimited,
        status: "pending",
        provider: "mpesa_manual",
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const ConfirmPurchaseInput = z.object({
  purchaseId: z.string().uuid(),
  providerRef: z.string().min(1).max(120),
});

export const confirmPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { purchaseId: string; providerRef: string }) => ConfirmPurchaseInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: purchase, error: fetchError } = await context.supabase
      .from("download_purchases")
      .select("*")
      .eq("id", data.purchaseId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.status === "paid") return purchase;
    if (purchase.status !== "pending") throw new Error("This purchase can no longer be confirmed.");

    const tier = getTier(purchase.tier as TierId);
    const expiresAt = tier.expiresDays
      ? new Date(Date.now() + tier.expiresDays * 24 * 3600 * 1000).toISOString()
      : purchase.expires_at;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("download_purchases")
      .update({
        status: "paid",
        provider_ref: data.providerRef,
        expires_at: expiresAt,
      })
      .eq("id", data.purchaseId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

const RecordDownloadInput = z.object({
  tmdbId: z.number().int().optional(),
  mediaType: z.string().min(1).max(20),
  title: z.string().min(1).max(300),
  posterPath: z.string().nullable().optional(),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(0).max(2000).optional(),
  quality: z.string().min(1).max(20),
});

export const recordDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RecordDownloadInput.parse(d))
  .handler(async ({ context, data }) => {
    // Downloads are free for every signed-in account for now — no credit gate.


    const { data: row, error } = await context.supabase
      .from("download_events")
      .insert({
        user_id: context.userId,
        tmdb_id: data.tmdbId ?? null,
        media_type: data.mediaType,
        title: data.title,
        poster_path: data.posterPath ?? null,
        season: data.season ?? null,
        episode: data.episode ?? null,
        quality: data.quality,
        status: "handed_off",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export { DOWNLOAD_TIERS };
