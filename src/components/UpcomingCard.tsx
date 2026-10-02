import { Link } from "@tanstack/react-router";
import { Bell, BellRing, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { poster, titleOf, yearOf, mediaTypeOf, type TmdbItem } from "@/lib/tmdb-utils";
import { useApp } from "@/lib/app-store";
import { clearReminder, countdownLabel, formatRelease, releaseDateOf, setReminder } from "@/lib/release-reminders";

export function UpcomingCard({ item }: { item: TmdbItem }) {
  const type = mediaTypeOf(item);
  const { inWatchlist, toggleWatch } = useApp();
  const saved = inWatchlist(item.id, type);
  const date = releaseDateOf(item);
  const src = poster(item.poster_path, "w342");

  const onSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWatch({ id: item.id, type, title: titleOf(item), poster: item.poster_path ?? null, year: yearOf(item) });
    if (saved) {
      clearReminder(type, item.id);
      toast("Removed from watchlist");
    } else {
      setReminder({ id: item.id, type, title: titleOf(item), date });
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
      toast.success(`Saved — we'll remind you on ${formatRelease(date)}`);
    }
  };

  return (
    <Link to="/watch/$type/$id" params={{ type, id: String(item.id) }} className="group w-40 shrink-0 snap-start">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-white/5">
        {src ? (
          <img loading="lazy" src={src} alt={titleOf(item)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-neutral-500">{titleOf(item)}</div>
        )}
        <div
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-black"
          style={{ background: "var(--accent)" }}
        >
          {countdownLabel(date)}
        </div>
        <button
          onClick={onSave}
          aria-label={saved ? "Remove reminder" : "Save and remind me"}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/70 backdrop-blur transition hover:bg-black/90"
        >
          {saved ? <BellRing className="h-4 w-4" style={{ color: "var(--accent)" }} /> : <Bell className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-2 truncate text-sm text-neutral-200 group-hover:text-white">{titleOf(item)}</div>
      <div className="flex items-center gap-1 text-xs text-neutral-500">
        <CalendarDays className="h-3 w-3" /> {formatRelease(date)}
      </div>
    </Link>
  );
}
