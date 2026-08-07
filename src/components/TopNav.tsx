import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Settings2, Bookmark, LogOut, Clock, Download } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { Notifications } from "./Notifications";
import { useApp } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";

export function TopNav() {
  const [open, setOpen] = useState(false);
  const { session } = useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const links = [
    { to: "/", label: "Discover" },
    { to: "/movies", label: "Movies" },
    { to: "/tv", label: "TV Shows" },
    { to: "/anime", label: "Anime" },
    { to: "/search", label: "Search" },
    { to: "/history", label: "History" },
    { to: "/watchlist", label: "Watchlist" },
  ] as const;


  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <header className="glass sticky top-0 z-40 hide-in-focus">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-black"
              style={{ background: "var(--accent)" }}
            >
              ◐
            </span>
            <span>WuHubHD</span>
          </Link>

          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full px-3 py-1.5 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white"
                activeProps={{ className: "rounded-full px-3 py-1.5 text-sm text-white bg-white/5" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-white/10 bg-black/50 px-1 py-0.5 text-[10px] sm:inline">
                ⌘K
              </kbd>
            </button>
            <Notifications />

            <Link
              to="/history"
              className="hidden rounded-full border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white md:inline-flex"
              aria-label="Continue Watching"
            >
              <Clock className="h-4 w-4" />
            </Link>
            <Link
              to="/watchlist"
              className="hidden rounded-full border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white md:inline-flex"
              aria-label="Watchlist"
            >
              <Bookmark className="h-4 w-4" />
            </Link>
            <Link
              to="/downloads"
              className="hidden rounded-full border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white md:inline-flex"
              aria-label="Downloads"
            >
              <Download className="h-4 w-4" />
            </Link>
            <Link
              to="/settings"
              className="rounded-full border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Settings"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
            {session && (
              <button
                onClick={signOut}
                className="hidden rounded-full border border-white/10 bg-white/5 p-2 text-neutral-300 transition hover:bg-red-500/20 hover:text-red-200 md:inline-flex"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
