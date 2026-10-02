import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TMDB = "https://api.themoviedb.org/3";

async function discover(path: string, params: Record<string, string>) {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  const url = new URL(TMDB + path);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return ((await res.json()).results ?? []) as any[];
}

export const aiUpcomingPicks = createServerFn({ method: "POST" })
  .inputValidator((d: { genres: string[] }) =>
    z.object({ genres: z.array(z.string().max(40)).min(1).max(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const today = new Date().toISOString().slice(0, 10);
    const base = { language: "en-US", include_adult: "false", sort_by: "popularity.desc" };
    const [m1, m2, t1, t2] = await Promise.all([
      discover("/discover/movie", { ...base, page: "1", "primary_release_date.gte": today }),
      discover("/discover/movie", { ...base, page: "2", "primary_release_date.gte": today }),
      discover("/discover/tv", { ...base, page: "1", "first_air_date.gte": today }),
      discover("/discover/tv", { ...base, page: "2", "first_air_date.gte": today }),
    ]);
    const catalog = [
      ...[...m1, ...m2].map((r) => ({ ...r, media_type: "movie" })),
      ...[...t1, ...t2].map((r) => ({ ...r, media_type: "tv" })),
    ];
    const byKey = new Map(catalog.map((r) => [`${r.media_type}-${r.id}`, r]));
    const lines = catalog
      .map((r) => `${r.media_type}-${r.id} | ${r.title || r.name} | ${(r.overview || "").slice(0, 160)}`)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          'You recommend upcoming movies and shows. Only pick from the catalog. Reply with JSON only: {"picks":[{"key":"movie-123","reason":"short reason under 20 words"}]} with 8 to 10 picks.',
        input: `Favourite genres: ${data.genres.join(", ")}\n\nCatalog (key | title | overview):\n${lines}`,
      }),
    });
    if (!res.ok || !res.body) {
      const status = res.status;
      if (status === 429) throw new Error("Too many requests right now — please try again shortly.");
      if (status === 402) throw new Error("AI credits have run out for this workspace.");
      throw new Error(`AI request failed (${status})`);
    }

    // Consume the SSE stream and collect the output text.
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const line of parts) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        } catch {}
      }
    }

    const match = text.match(/\{[\s\S]*\}/);
    let picks: { key: string; reason: string }[] = [];
    try {
      picks = JSON.parse(match?.[0] ?? "{}").picks ?? [];
    } catch {}
    return {
      results: picks
        .map((p) => {
          const item = byKey.get(p.key);
          return item ? { ...item, reason: p.reason } : null;
        })
        .filter(Boolean) as any[],
    };
  });
