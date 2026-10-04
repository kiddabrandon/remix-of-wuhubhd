import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BellRing, Check, Play, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { poster } from "@/lib/tmdb-utils";
import {
  REMINDERS_EVENT,
  clearReminder,
  countdownLabel,
  formatRelease,
  listReminders,
  type Reminder,
} from "@/lib/release-reminders";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "My Reminders — WuHubHD" },
      { name: "description", content: "Upcoming movies, series, anime and cartoons you're waiting for, with release countdowns." },
      { property: "og:title", content: "My Reminders — WuHubHD" },
      { property: "og:description", content: "Keep track of upcoming releases you set reminders for on WuHubHD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RemindersPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function RemindersPage() {
  const { progressFor, hydrated } = useApp();
  const [items, setItems] = useState<Reminder[]>([]);

  useEffect(() => {
    const sync = () => setItems(listReminders());
    sync();
    window.addEventListener(REMINDERS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REMINDERS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Auto-clear titles the user has started watching after release.
  useEffect(() => {
    if (!hydrated) return;
    for (const r of items) {
      if (!r.date || r.date > today()) continue;
      const p = progressFor(r.id, r.type);
      if (p && (p.fully_watched || p.progress_pct >= 5 || (p.watched_episodes?.length ?? 0) > 0)) {
        clearReminder(r.type, r.id);
      }
    }
  }, [items, hydrated, progressFor]);

  const out = items.filter((r) => r.date && r.date <= today());
  const soon = items.filter((r) => !r.date || r.date > today());

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-28 sm:px-8">
      <header className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <BellRing className="h-5 w-5" style={{ color: "var(--accent)" }} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold sm:text-3xl">My Reminders</h1>
          <p className="truncate text-xs text-neutral-400">Titles clear automatically once you watch them.</p>
        </div>
      </header>

      {items.length === 0 && (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-neutral-400">
          No reminders yet. Tap the bell on any upcoming movie, series, anime or cartoon on the{" "}
          <Link to="/" className="underline hover:text-white">home page</Link>.
        </div>
      )}

      {out.length > 0 && <Section title="Out now — ready to watch" items={out} released />}
      {soon.length > 0 && <Section title="Coming soon" items={soon} />}
    </div>
  );
}

function Section({ title, items, released }: { title: string; items: Reminder[]; released?: boolean }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {title} · {items.length}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((r) => (
          <div key={`${r.type}-${r.id}`} className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
              {r.poster && <img src={poster(r.poster, "w185") ?? undefined} alt={r.title} loading="lazy" className="h-full w-full object-cover" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate text-sm font-semibold">{r.title}</div>
              <div className="text-[11px] text-neutral-500">
                {r.type === "movie" ? "Movie" : "Series"} · {formatRelease(r.date)}
              </div>
              <span
                className="mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-bold text-black"
                style={{ background: released ? "var(--accent)" : "rgba(255,255,255,.7)" }}
              >
                {countdownLabel(r.date)}
              </span>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                {released && (
                  <Link
                    to="/watch/$type/$id"
                    params={{ type: r.type, id: String(r.id) }}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-black"
                    style={{ background: "var(--accent)" }}
                  >
                    <Play className="h-3 w-3" /> Watch
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => clearReminder(r.type, r.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] hover:bg-white/10"
                >
                  {released ? <><Check className="h-3 w-3" /> Mark watched</> : <><Trash2 className="h-3 w-3" /> Remove</>}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
