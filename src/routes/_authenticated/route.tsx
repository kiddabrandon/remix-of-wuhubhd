import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Open access: browsing WuHubHD never requires an account. Guests get the full
 * catalogue; account-only features (watchlist, history sync, party hosting)
 * prompt them to create an account from Settings when they try to use them.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { user: data?.user ?? null };
  },
  component: () => <Outlet />,
});

