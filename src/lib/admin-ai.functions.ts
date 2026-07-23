// Admin AI diagnostics + chat. Uses the Lovable AI Gateway (LOVABLE_API_KEY).
// All functions require an authenticated admin (checked via has_role).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdmin } from "@/lib/admin-helpers.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the on-call site engineer for "CinehubHD", a streaming aggregator
built with TanStack Start + Supabase (Lovable Cloud). You help the site admin:
- Diagnose failures visible in error_logs and server_health (name likely causes and next steps).
- Explain how features of the codebase work and how to change them (movies, TV, anime, watchlist,
  continue-watching, party rooms, admin panel).
- Suggest improvements and recent-industry updates (frameworks, security, UX), but never
  apply changes yourself — always end suggestions with "Ask the admin to confirm before I change code."
- When summarizing anonymized user patterns, never reveal individual identifiers, only aggregates.
Answer concisely (Markdown). Prefer bulleted, actionable output.`;

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(6000),
      }),
    )
    .min(1)
    .max(40),
  includeDiagnostics: z.boolean().optional(),
});

export const adminChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ context, data }) => {
    await ensureAdmin(context.supabase, context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    let context_block = "";
    if (data.includeDiagnostics) {
      const [errors, health] = await Promise.all([
        context.supabase
          .from("error_logs")
          .select("message,url,created_at")
          .order("created_at", { ascending: false })
          .limit(15),
        context.supabase.from("server_health").select("server_name,is_online,latency_ms,last_checked"),
      ]);
      context_block = `\n\n<diagnostics>\nRecent errors (max 15):\n${JSON.stringify(errors.data ?? [], null, 2)}\n\nProvider health:\n${JSON.stringify(health.data ?? [], null, 2)}\n</diagnostics>`;
    }

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + context_block },
          ...data.messages,
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Top up in workspace billing.");
      throw new Error(`Gateway ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { reply };
  });

export const adminDiagnose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [errors, health] = await Promise.all([
      context.supabase
        .from("error_logs")
        .select("message,url,created_at")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase.from("server_health").select("server_name,is_online,latency_ms,last_checked"),
    ]);

    const errCount = errors.data?.length ?? 0;
    const offline = (health.data ?? []).filter((s: any) => !s.is_online);

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a site diagnostics assistant. Given recent error logs and provider health, produce a very short Markdown report: (1) overall status verdict on one line, (2) top 3 recurring issues with likely causes, (3) recommended admin actions. Be terse.",
          },
          {
            role: "user",
            content: `Errors last 24h (${errCount}):\n${JSON.stringify(errors.data ?? [], null, 2)}\n\nProvider health (${offline.length} offline):\n${JSON.stringify(health.data ?? [], null, 2)}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return {
      report: json.choices?.[0]?.message?.content?.trim() ?? "No report available.",
      errors24h: errCount,
      offlineProviders: offline.length,
    };
  });

// ------- Anonymous user-pattern insights -------
export const adminInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    // Aggregate across ALL users → use the service-role client (bypasses RLS).
    // The caller has already been verified as an admin above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [wl, prog, party] = await Promise.all([
      admin.from("user_watchlists").select("media_type,tmdb_id,user_id,created_at"),
      admin
        .from("user_progress")
        .select("media_type,tmdb_id,user_id,fully_watched,updated_at,position_seconds,duration_seconds")
        .gte("updated_at", weekAgo),
      admin.from("party_rooms").select("id,created_at").gte("created_at", weekAgo),
    ]);

    const wlRows = (wl.data ?? []) as any[];
    const progRows = (prog.data ?? []) as any[];

    const uniqUsers = (rows: { user_id?: string | null }[]) =>
      new Set(rows.map((r) => r.user_id).filter(Boolean)).size;

    const topBy = (rows: { media_type: string; tmdb_id: number | string }[], n = 10) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = `${r.media_type}:${r.tmdb_id}`;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => ({ item: k, count: v }));
    };

    const finishedCount = progRows.filter((r: any) => r.fully_watched).length;
    const avgCompletion = (() => {
      const withDur = progRows.filter((r: any) => r.duration_seconds > 0);
      if (!withDur.length) return 0;
      const sum = withDur.reduce(
        (a: number, r: any) => a + Math.min(1, (r.position_seconds ?? 0) / r.duration_seconds),
        0,
      );
      return +(sum / withDur.length).toFixed(3);
    })();

    const aggregates = {
      watchlist: {
        total: wlRows.length,
        uniqueUsers: uniqUsers(wlRows),
        top: topBy(wlRows as any),
      },
      progress7d: {
        events: progRows.length,
        uniqueUsers: uniqUsers(progRows),
        finished: finishedCount,
        avgCompletion,
        top: topBy(progRows as any),
      },
      partyRooms7d: (party.data ?? []).length,
    };

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You analyse fully-anonymized aggregate metrics (no user IDs) for a streaming site admin. Produce a short Markdown brief: (1) 2-3 sentence overview, (2) behaviour patterns worth noting, (3) 3 concrete product actions. Never mention individual users. Be terse.",
          },
          { role: "user", content: JSON.stringify(aggregates, null, 2) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return {
      brief: json.choices?.[0]?.message?.content?.trim() ?? "No insights available.",
      aggregates,
    };
  });

// ------- AI-suggested updates (industry trends) -------
export const adminSuggestUpdates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a senior web engineer briefing the admin of a TanStack Start + Supabase streaming site (React 19, Tailwind v4, hls.js, Consumet, TMDB). Suggest 4-6 concrete, current improvements from recent web-dev best practices (perf, a11y, security, streaming, SEO, AI UX). For each: **Title** — 1-line why + 1-line how. End with: '_Ask the admin to confirm before I change code._'",
          },
          {
            role: "user",
            content:
              "What updates should I consider this month? Focus on high-impact, low-risk items I can approve one at a time.",
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { suggestions: json.choices?.[0]?.message?.content?.trim() ?? "No suggestions." };
  });
