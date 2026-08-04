import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  message: string;
  variant: string;
  created_at: string;
};

const VARIANT_STYLES: Record<string, string> = {
  info: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  danger: "border-red-400/30 bg-red-400/10 text-red-100",
};

/** Global announcements published from the backend panel. */
export function Notifications() {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, message, variant, created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as Announcement[];
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const items = data ?? [];
  const unread = useMemo(() => items.filter((a) => !seen.includes(a.id)).length, [items, seen]);

  // Live updates when an admin posts or retires an announcement.
  useEffect(() => {
    const channel = supabase
      .channel("announcements-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        void supabase
          .from("announcements")
          .select("id")
          .limit(1)
          .then(() => undefined);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) setSeen(items.map((a) => a.id));
      return next;
    });
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `${unread} new announcements` : "Announcements"}
        className="relative rounded-full border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-black"
            style={{ background: "var(--accent)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
            <Megaphone className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Announcements
            </span>
          </div>
          <div className="scrollbar-none max-h-80 space-y-2 overflow-y-auto p-3">
            {items.length === 0 && (
              <p className="px-1 py-6 text-center text-xs text-neutral-500">Nothing new right now.</p>
            )}
            {items.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${
                  VARIANT_STYLES[a.variant] ?? VARIANT_STYLES.info
                }`}
              >
                <p>{a.message}</p>
                <p className="mt-1 text-[10px] opacity-60">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
