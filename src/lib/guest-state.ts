// Local, anonymous state for signed-out visitors.
//
// Guests get a real experience (settings, watchlist, continue watching) stored
// in this browser only. When they later create an account, `takeGuestState()`
// hands the data over so it can be migrated into the account and cleared.

const KEY = "wuhubhd.guest-state";

export type GuestWatchlistItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string | null;
  year: string;
};

export type GuestProgressItem = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  season?: number;
  episode?: number;
  progress_pct?: number;
  position_seconds?: number;
  duration_seconds?: number;
  fully_watched?: boolean;
};

export type GuestState = {
  settings: Record<string, unknown>;
  watchlist: GuestWatchlistItem[];
  progress: GuestProgressItem[];
};

const EMPTY: GuestState = { settings: {}, watchlist: [], progress: [] };

export function readGuestState(): GuestState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<GuestState>;
    return {
      settings: parsed.settings ?? {},
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
      progress: Array.isArray(parsed.progress) ? parsed.progress : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(state: GuestState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — guest state is best-effort */
  }
}

export function saveGuestSettings(settings: Record<string, unknown>) {
  write({ ...readGuestState(), settings });
}

export function toggleGuestWatchlist(item: GuestWatchlistItem) {
  const state = readGuestState();
  const exists = state.watchlist.some((x) => x.id === item.id && x.type === item.type);
  const watchlist = exists
    ? state.watchlist.filter((x) => !(x.id === item.id && x.type === item.type))
    : [item, ...state.watchlist].slice(0, 200);
  write({ ...state, watchlist });
  return watchlist;
}

export function saveGuestProgress(item: GuestProgressItem) {
  const state = readGuestState();
  const rest = state.progress.filter(
    (p) => !(p.tmdb_id === item.tmdb_id && p.media_type === item.media_type),
  );
  const prev = state.progress.find((p) => p.tmdb_id === item.tmdb_id && p.media_type === item.media_type);
  const progress = [{ ...prev, ...item }, ...rest].slice(0, 100);
  write({ ...state, progress });
  return progress;
}

export function removeGuestProgress(tmdb_id: number, media_type: "movie" | "tv") {
  const state = readGuestState();
  const progress = state.progress.filter((p) => !(p.tmdb_id === tmdb_id && p.media_type === media_type));
  write({ ...state, progress });
  return progress;
}

/** Returns the stored guest state once and clears it (used right after sign-in). */
export function takeGuestState(): GuestState | null {
  if (typeof window === "undefined") return null;
  const state = readGuestState();
  const empty =
    Object.keys(state.settings).length === 0 && state.watchlist.length === 0 && state.progress.length === 0;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return empty ? null : state;
}
