// Client-side release reminders for saved upcoming titles (works for guests and accounts).
const KEY = "wuhub:release-reminders";

export type Reminder = { id: number; type: "movie" | "tv"; title: string; date: string; poster?: string | null; notified?: boolean };

export const REMINDERS_EVENT = "wuhub:reminders-changed";

export function listReminders(): Reminder[] {
  return Object.values(read()).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
}

function read(): Record<string, Reminder> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function write(v: Record<string, Reminder>) {
  localStorage.setItem(KEY, JSON.stringify(v));
  window.dispatchEvent(new Event(REMINDERS_EVENT));
}

export function setReminder(r: Reminder) {
  const all = read();
  all[`${r.type}-${r.id}`] = { ...r, notified: false };
  write(all);
}
export function clearReminder(type: string, id: number) {
  const all = read();
  delete all[`${type}-${id}`];
  write(all);
}

/** Returns reminders whose release date has arrived and marks them notified. */
export function takeDueReminders(): Reminder[] {
  const all = read();
  const today = new Date().toISOString().slice(0, 10);
  const due: Reminder[] = [];
  for (const k of Object.keys(all)) {
    const r = all[k];
    if (!r.notified && r.date && r.date <= today) {
      due.push(r);
      all[k] = { ...r, notified: true };
    }
  }
  if (due.length) write(all);
  return due;
}

export function releaseDateOf(x: { release_date?: string; first_air_date?: string }) {
  return x.release_date || x.first_air_date || "";
}

export function countdownLabel(date: string) {
  if (!date) return "Date TBA";
  const ms = new Date(date + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime();
  const days = Math.round(ms / 86_400_000);
  if (days <= 0) return "Out now";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} wk${days >= 11 ? "s" : ""}`;
  return `In ${Math.round(days / 30)} months`;
}

export function formatRelease(date: string) {
  if (!date) return "TBA";
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
