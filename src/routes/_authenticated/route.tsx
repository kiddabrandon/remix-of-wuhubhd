import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * QA/testing mode: append `?qa=1` to any protected URL (or set VITE_QA_MODE=1)
 * to preview authenticated pages without being bounced to /auth. Data reads that
 * need a session still return empty — this only skips the redirect.
 */
function qaModeEnabled() {
  if (import.meta.env['VITE_QA_MODE'] === "1") return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("qa") === "1";
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (qaModeEnabled()) return { user: null };
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
