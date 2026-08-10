import { createFileRoute } from "@tanstack/react-router";
import { ALL_ADDONS } from "@/lib/addons";
import { ADDON_TIMEOUT_MS } from "@/lib/addon-types";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Only hosts belonging to bundled add-ons may be proxied. */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const a of ALL_ADDONS) {
    try {
      hosts.add(new URL(a.manifest).host);
    } catch {
      /* ignore malformed manifest urls */
    }
  }
  return hosts;
}

/**
 * Server-side fetch proxy for add-on manifests and stream endpoints.
 * Removes browser CORS restrictions and enforces a hard timeout so a dead
 * add-on can never stall the catalog UI.
 */
export const Route = createFileRoute("/api/addon-proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get("url");
        if (!target) return json({ error: "Missing `url` query parameter" }, 400);

        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return json({ error: "Invalid url" }, 400);
        }
        if (parsed.protocol !== "https:") return json({ error: "Only https is allowed" }, 400);
        if (!allowedHosts().has(parsed.host)) {
          return json({ error: `Host ${parsed.host} is not a bundled add-on host` }, 403);
        }

        try {
          const upstream = await fetch(parsed.toString(), {
            headers: { accept: "application/json,*/*" },
            signal: AbortSignal.timeout(ADDON_TIMEOUT_MS),
          });
          const body = await upstream.text();
          return new Response(body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("content-type") ?? "application/json",
              "Cache-Control": "public, max-age=300",
              ...CORS_HEADERS,
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Upstream request failed";
          return json(
            {
              error: /timeout|aborted/i.test(message)
                ? `Add-on did not respond within ${ADDON_TIMEOUT_MS / 1000}s`
                : message,
            },
            504,
          );
        }
      },
    },
  },
});
