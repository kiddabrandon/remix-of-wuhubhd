import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  useEffect(() => {
    const go = () => {
      const dest = (typeof window !== "undefined" && sessionStorage.getItem("cinehub.next")) || "/";
      sessionStorage.removeItem("cinehub.next");
      navigate({ to: dest.startsWith("/") ? dest : "/", replace: true });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return go();
      const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
        if (session) {
          sub.subscription.unsubscribe();
          go();
        }
      });
      // safety timeout
      setTimeout(() => {
        sub.subscription.unsubscribe();
        navigate({ to: "/auth", replace: true });
      }, 8000);
    });
  }, [navigate]);
  return (
    <div className="grid min-h-screen place-items-center bg-black">
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Finishing sign-in…
      </div>
    </div>
  );
}
