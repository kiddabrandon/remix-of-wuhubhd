import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const CreateSchema = z.object({
  content_id: z.number().int().positive(),
  content_type: z.enum(["movie", "tv", "anime", "cartoon"]),
  title: z.string().min(1).max(200),
  season_number: z.number().int().positive().nullable().optional(),
  episode_number: z.number().int().positive().nullable().optional(),
});

export const createParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const { error } = await context.supabase
        .from("party_rooms")
        .insert({
          code,
          host_id: context.userId,
          content_id: data.content_id,
          content_type: data.content_type,
          title: data.title,
          season_number: data.season_number ?? null,
          episode_number: data.episode_number ?? null,
        });
      if (!error) return { code };
      if (!/duplicate/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not allocate a party code, try again");
  });

export const getParty = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(4).max(12) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(process.env.SUPABASE_URL!, key, {
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
    const { data: row } = await client
      .from("party_rooms")
      .select("*")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!row) throw new Error("Party not found");
    return row;
  });

export const updatePartyState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string(),
        season_number: z.number().int().positive().optional(),
        episode_number: z.number().int().positive().optional(),
        server_id: z.string().max(60).optional(),
        /** Seconds from now that everyone should press play. */
        start_in: z.number().int().min(0).max(120).optional(),
        resync: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      updated_at: string;
      season_number?: number;
      episode_number?: number;
      server_id?: string;
      start_at?: string;
      sync_nonce?: number;
    } = { updated_at: new Date().toISOString() };
    if (data.season_number != null) patch.season_number = data.season_number;
    if (data.episode_number != null) patch.episode_number = data.episode_number;
    if (data.server_id) patch.server_id = data.server_id;
    if (data.start_in != null) patch.start_at = new Date(Date.now() + data.start_in * 1000).toISOString();


    // Read the current nonce so a resync (or any state change) reloads guests.
    const { data: current } = await context.supabase
      .from("party_rooms")
      .select("sync_nonce")
      .eq("code", data.code)
      .maybeSingle();
    patch.sync_nonce = Number(current?.sync_nonce ?? 0) + 1;

    const { error } = await context.supabase
      .from("party_rooms")
      .update(patch)
      .eq("code", data.code)
      .eq("host_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const postPartyMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      code: z.string(),
      body: z.string().min(1).max(500),
      display_name: z.string().min(1).max(60),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("party_messages").insert({
      room_code: data.code,
      user_id: context.userId,
      display_name: data.display_name,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });