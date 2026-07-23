import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAdmin(supabase: SupabaseClient, userId: string) {
  const [{ data: admin }, { data: superAdmin }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!admin && !superAdmin) throw new Error("Forbidden");
}