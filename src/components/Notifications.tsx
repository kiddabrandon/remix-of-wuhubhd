import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  critical: "border-red-400/30 bg-red-400/10 text-red-100",
  danger: "border-red-400/30 bg-red-400/10 text-red-100",
};


/** Global announcements published from the backend panel. */
export function Notifications() {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

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

  // Read receipts persist per account in the profile preferences.
  const { data: profile } = useQuery({
    queryKey: ["announcement-reads"],
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return [];
      const { data: row } = await supabase.from("profiles").select("preferences").eq("id", uid).maybeSingle();
      const prefs = (row?.preferences ?? {}) as { readAnnouncements?: string[] };
      return prefs.readAnnouncements ?? [];
    },
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (profile) setReadIds((prev) => Array.from(new Set([...prev, ...profile])));
  }, [profile]);

  const items = data ?? [];
  const unread = useMemo(() => items.filter((a) => !readIds.includes(a.id)).length, [items, readIds]);

  const markAllRead = async () => {
    const ids = Array.from(new Set([...readIds, ...items.map((a) => a.id)]));
    setReadIds(ids);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { data: row } = await supabase.from("profiles").select("preferences").eq("id", uid).maybeSingle();
    const prefs = { ...((row?.preferences ?? {}) as object), readAnnouncements: ids.slice(-200) };
    await supabase.from("profiles").update({ preferences: prefs }).eq("id", uid);
    void qc.invalidateQueries({ queryKey: ["announcement-reads"] });
  };

  // Live updates when an admin posts or retires an announcement.
  useEffect(() => {
    const channel = supabase
      .channel("announcements-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        void qc.invalidateQueries({ queryKey: ["announcements", "active"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) void markAllRead();
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

      {/* Centred modal so the panel never clips on small screens. */}
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <button
            type="button"
            aria-label="Close announcements"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <Megaphone className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Announcements
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="scrollbar-none max-h-[60vh] space-y-2 overflow-y-auto p-3">
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
                  <p className="break-words">{a.message}</p>
                  <p className="mt-1 text-[10px] opacity-60">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

