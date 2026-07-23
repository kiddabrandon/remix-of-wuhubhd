import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Home, LayoutGrid, Search, User, Film, Tv, Clock, Bookmark, Sun, LogOut, Sparkles } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { avatarPreset } from "@/lib/app-store";

export function BottomDock() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState(false);
  const [profile, setProfile] = useState(false);
  const { settings, setSettings, session } = useApp();
  const qc = useQueryClient();
  const avatar = avatarPreset(settings.avatarPreset);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      } else if (e.key === "Escape") {
        setBrowse(false);
        setProfile(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (p: string) => (p === "/" ? loc.pathname === "/" : loc.pathname.startsWith(p));

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setProfile(false);
    navigate({ to: "/auth", replace: true });
  };

  // Hide the dock on the auth pages
  if (loc.pathname.startsWith("/auth")) return null;

  const dockHidden = browse || profile || search;

  return (
    <>
      <AnimatePresence>
        {!dockHidden && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[70] flex justify-center px-4 [transform:translateZ(0)]">
            <motion.nav
              key="dock"
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-neutral-900/60 p-1.5 shadow-2xl backdrop-blur-lg"
              style={{ boxShadow: "0 10px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02)" }}
            >
              <DockLink to="/" label="Home" active={isActive("/")}>
                <Home className="h-4 w-4" />
              </DockLink>
              <DockButton onClick={() => setBrowse(true)} label="Browse">
                <LayoutGrid className="h-4 w-4" />
              </DockButton>
              <DockButton onClick={() => setSearch(true)} label="Search">
                <Search className="h-4 w-4" />
              </DockButton>
              <DockButton onClick={() => setProfile(true)} label="Profile" active={profile}>
                <User className="h-4 w-4" />
              </DockButton>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette open={search} onClose={() => setSearch(false)} />

      {/* Browse sheet */}
      <AnimatePresence>
        {browse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBrowse(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="no-scrollbar max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-neutral-950/90 p-5 backdrop-blur-xl sm:p-6"
            >
              <SheetTitle>Content</SheetTitle>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SheetTile
                  onClick={() => {
                    setBrowse(false);
                    navigate({ to: "/movies" });
                  }}
                  icon={<Film className="h-5 w-5" />}
                  label="Movies"
                  hint="Browse the film catalog"
                  accent="#00E5FF"
                />
                <SheetTile
                  onClick={() => {
                    setBrowse(false);
                    navigate({ to: "/tv" });
                  }}
                  icon={<Tv className="h-5 w-5" />}
                  label="TV Shows"
                  hint="Series & mini-series"
                  accent="#A855F7"
                />
                <SheetTile
                  onClick={() => {
                    setBrowse(false);
                    navigate({ to: "/anime" });
                  }}
                  icon={<Sparkles className="h-5 w-5" />}
                  label="Anime"
                  hint="Trending & seasonal"
                  accent="#F472B6"
                />
              </div>

              <SheetTitle className="mt-6">Personal</SheetTitle>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SheetTile
                  onClick={() => {
                    setBrowse(false);
                    navigate({ to: "/history" });
                  }}
                  icon={<Clock className="h-5 w-5" />}
                  label="History"
                  hint="Continue watching"
                  accent="#22C55E"
                />
                <SheetTile
                  onClick={() => {
                    setBrowse(false);
                    navigate({ to: "/watchlist" });
                  }}
                  icon={<Bookmark className="h-5 w-5" />}
                  label="Watchlist"
                  hint="Saved titles"
                  accent="#FF3B57"
                />
              </div>

              <SheetTitle className="mt-6">Preferences</SheetTitle>
              <div className="mt-3 space-y-3">
                <Toggle
                  label="Autoplay"
                  value={settings.autoplay}
                  onChange={(v) => setSettings({ autoplay: v })}
                />
                <Toggle
                  label="Focus Mode"
                  hint="Hide chrome while watching"
                  value={settings.focusMode}
                  onChange={(v) => setSettings({ focusMode: v })}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile menu */}
      <AnimatePresence>
        {profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfile(false)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-24 backdrop-blur-md"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 p-4 backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center gap-3 p-2">
                <div className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-white" style={{ background: avatar.gradient }}>
                  {avatar.emoji}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{session?.user.user_metadata?.display_name ?? session?.user.email}</div>
                  <div className="truncate text-xs text-neutral-400">{session?.user.email}</div>
                </div>
              </div>
              <Link
                to="/settings"
                onClick={() => setProfile(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-white/5"
              >
                <Sun className="h-4 w-4" /> Settings
              </Link>
              <button
                onClick={signOut}
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DockLink({
  to,
  label,
  active,
  children,
}: {
  to: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition ${active ? "text-black" : "hover:bg-white/10"}`}
      style={active ? { background: "var(--accent)", boxShadow: "0 0 20px color-mix(in oklab, var(--accent) 40%, transparent)" } : undefined}
    >
      {children}
    </Link>
  );
}

function DockButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition ${active ? "text-black" : "hover:bg-white/10"}`}
      style={active ? { background: "var(--accent)" } : undefined}
    >
      {children}
    </button>
  );
}

function SheetTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] font-semibold tracking-widest text-neutral-500 uppercase ${className}`}>
      {children}
    </div>
  );
}

function SheetTile({
  onClick,
  icon,
  label,
  hint,
  accent,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-lg transition"
        style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
      >
        {icon}
      </span>
      <div className="text-sm font-semibold">{label}</div>
      <div className="text-xs text-neutral-500">{hint}</div>
    </button>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-neutral-500">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "" : "bg-white/10"}`}
        style={value ? { background: "var(--accent)" } : undefined}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full transition ${value ? "left-5 bg-black" : "left-0.5 bg-white"}`}
        />
      </button>
    </div>
  );
}
