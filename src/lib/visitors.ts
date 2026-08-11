import { supabase } from "@/integrations/supabase/client";

const KEY = "wuhubhd.visitor";

/** Stable, anonymous, per-browser id. Contains no personal data. */
function visitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Records a visit so the admin panel can see how many people browse without an
 * account. Fire-and-forget: never blocks or breaks the page.
 */
export async function trackGuestVisit() {
  const id = visitorId();
  if (!id) return;
  const session = sessionStorage.getItem("wuhubhd.visit-tracked");
  if (session) return;
  sessionStorage.setItem("wuhubhd.visit-tracked", "1");
  try {
    await (supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
    }).rpc("track_guest_visit", {
      _visitor_id: id,
      _user_agent: navigator.userAgent.slice(0, 300),
    });
  } catch {
    /* analytics must never break the app */
  }
}
