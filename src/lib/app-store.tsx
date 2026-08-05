import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  addWatchlist,
  getMyProfile,
  listProgress,
  listWatchlist,
  removeProgress as removeProgressFn,
  removeWatchlist,
  saveMyPreferences,
  upsertProgress,
} from "@/lib/user-data.functions";
import { DEFAULT_SERVER_ORDER } from "@/lib/servers";
import mickeyAvatar from "@/assets/avatars/mickey.png.asset.json";
import minnieAvatar from "@/assets/avatars/minnie.png.asset.json";
import daisyAvatar from "@/assets/avatars/daisy.png.asset.json";
import goofyAvatar from "@/assets/avatars/goofy.png.asset.json";
import bugsAvatar from "@/assets/avatars/bugs.png.asset.json";
import woodyAvatar from "@/assets/avatars/woody.png.asset.json";
import mickeyClassicAvatar from "@/assets/avatars/mickey-classic.png.asset.json";
import donaldAvatar from "@/assets/avatars/donald.png.asset.json";
import minnieRedAvatar from "@/assets/avatars/minnie-red.png.asset.json";

export type AccentName = "cyan" | "royal" | "crimson" | "forest" | "purple";

export const ACCENTS: { name: AccentName; label: string; value: string }[] = [
  { name: "cyan", label: "Electric Cyan", value: "#00E5FF" },
  { name: "royal", label: "Royal Blue", value: "#3B5BFF" },
  { name: "crimson", label: "Crimson Red", value: "#FF3B57" },
  { name: "forest", label: "Forest Green", value: "#22C55E" },
  { name: "purple", label: "Neon Purple", value: "#A855F7" },
];

export const AVATAR_PRESETS = [
  { id: "mickey", label: "Mickey", image: mickeyAvatar.url, gradient: "linear-gradient(135deg,#f87171,#111827)" },
  { id: "minnie", label: "Minnie", image: minnieAvatar.url, gradient: "linear-gradient(135deg,#c084fc,#f472b6)" },
  { id: "daisy", label: "Daisy", image: daisyAvatar.url, gradient: "linear-gradient(135deg,#f472b6,#fbbf24)" },
  { id: "goofy", label: "Goofy", image: goofyAvatar.url, gradient: "linear-gradient(135deg,#4ade80,#0ea5e9)" },
  { id: "bugs", label: "Bugs Bunny", image: bugsAvatar.url, gradient: "linear-gradient(135deg,#94a3b8,#e2e8f0)" },
  { id: "woody", label: "Woody Woodpecker", image: woodyAvatar.url, gradient: "linear-gradient(135deg,#ef4444,#facc15)" },
  { id: "mickey-classic", label: "Mickey Classic", image: mickeyClassicAvatar.url, gradient: "linear-gradient(135deg,#111827,#6b7280)" },
  { id: "donald", label: "Donald", image: donaldAvatar.url, gradient: "linear-gradient(135deg,#2563eb,#fb923c)" },
  { id: "minnie-red", label: "Minnie Red", image: minnieRedAvatar.url, gradient: "linear-gradient(135deg,#ef4444,#fda4af)" },
] as const;

export function avatarPreset(id?: string) {
  return AVATAR_PRESETS.find((a) => a.id === id) ?? AVATAR_PRESETS[0];
}


export type Settings = {
  accent: AccentName;
  autoplay: boolean;
  subtitleLang: string;
  focusMode: boolean;
  serverOrder: string[];
  avatarPreset: string;
};

export type WatchlistItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster: string | null;
  year: string;
};

export type ProgressItem = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  season: number | null;
  episode: number | null;
  progress_pct: number;
  position_seconds: number;
  duration_seconds: number;
  fully_watched: boolean;
  watched_episodes: string[];
  episode_positions: Record<string, { p: number; d: number }>;
  updated_at: string;
};

type AppState = {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  session: Session | null;
  watchlist: WatchlistItem[];
  toggleWatch: (i: WatchlistItem) => Promise<void>;
  inWatchlist: (id: number, type: "movie" | "tv") => boolean;
  progress: ProgressItem[];
  progressFor: (id: number, type: "movie" | "tv") => ProgressItem | undefined;
  saveProgress: (p: {
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
    mark_episode?: { s: number; e: number };
  }) => Promise<void>;
  removeProgress: (p: { tmdb_id: number; media_type: "movie" | "tv" }) => Promise<void>;
  hydrated: boolean;
};

const AppCtx = createContext<AppState | null>(null);

const DEFAULT_SETTINGS: Settings = {
  accent: "cyan",
  autoplay: true,
  subtitleLang: "en",
  focusMode: true,
  serverOrder: DEFAULT_SERVER_ORDER,
  avatarPreset: "mickey",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    setHydrated(true);
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSession(s);
        if (event !== "SIGNED_OUT") qc.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const { data: profileData } = useQuery({
    queryKey: ["profile", session?.user.id],
    queryFn: async () => getMyProfile(),
    enabled: !!session,
    staleTime: 60_000,
  });

  useEffect(() => {
    const prefs = (profileData?.preferences ?? {}) as Partial<Settings>;
    setSettingsState({ ...DEFAULT_SETTINGS, ...prefs });
  }, [profileData]);

  useEffect(() => {
    const a = ACCENTS.find((x) => x.name === settings.accent) ?? ACCENTS[0];
    document.documentElement.style.setProperty("--accent", a.value);
  }, [settings.accent]);

  const setSettings = useCallback((s: Partial<Settings>) => {
    setSettingsState((prev) => ({ ...prev, ...s }));
    if (session) {
      const next = { ...settings, ...s };
      void saveMyPreferences({ data: { preferences: next } }).then(() => {
        qc.invalidateQueries({ queryKey: ["profile", session.user.id] });
      });
    }
  }, [session, settings, qc]);

  const { data: watchlistData = [] } = useQuery({
    queryKey: ["watchlist", session?.user.id],
    queryFn: async () => listWatchlist(),
    enabled: !!session,
    staleTime: 60_000,
  });

  const { data: progressData = [] } = useQuery({
    queryKey: ["progress", session?.user.id],
    queryFn: async () => listProgress(),
    enabled: !!session,
    staleTime: 30_000,
  });

  const watchlist: WatchlistItem[] = useMemo(
    () =>
      (watchlistData as any[]).map((r) => ({
        id: r.tmdb_id,
        type: r.media_type,
        title: r.title,
        poster: r.poster_path ?? null,
        year: r.year ?? "",
      })),
    [watchlistData],
  );

  const progress: ProgressItem[] = useMemo(
    () =>
      (progressData as any[]).map((r) => ({
        tmdb_id: r.tmdb_id,
        media_type: r.media_type,
        title: r.title,
        poster_path: r.poster_path,
        backdrop_path: r.backdrop_path,
        season: r.season,
        episode: r.episode,
        progress_pct: Number(r.progress_pct ?? 0),
        position_seconds: Number(r.position_seconds ?? 0),
        duration_seconds: Number(r.duration_seconds ?? 0),
        fully_watched: Boolean(r.fully_watched),
        watched_episodes: Array.isArray(r.watched_episodes) ? r.watched_episodes : [],
        episode_positions:
          r.episode_positions && typeof r.episode_positions === "object" ? r.episode_positions : {},
        updated_at: r.updated_at,
      })),
    [progressData],
  );

  const inWatchlist = useCallback(
    (id: number, type: "movie" | "tv") => watchlist.some((x) => x.id === id && x.type === type),
    [watchlist],
  );

  const toggleWatch = useCallback(
    async (i: WatchlistItem) => {
      if (!session) return;
      const exists = watchlist.some((x) => x.id === i.id && x.type === i.type);
      if (exists) {
        await removeWatchlist({ data: { tmdb_id: i.id, media_type: i.type } });
      } else {
        await addWatchlist({
          data: {
            tmdb_id: i.id,
            media_type: i.type,
            title: i.title,
            poster_path: i.poster,
            year: i.year,
          },
        });
      }
      qc.invalidateQueries({ queryKey: ["watchlist"] });
    },
    [session, watchlist, qc],
  );

  const progressFor = useCallback(
    (id: number, type: "movie" | "tv") => progress.find((p) => p.tmdb_id === id && p.media_type === type),
    [progress],
  );

  const saveProgress = useCallback<AppState["saveProgress"]>(
    async (p) => {
      if (!session) return;
      await upsertProgress({ data: p as any });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
    [session, qc],
  );

  const removeProgress = useCallback<AppState["removeProgress"]>(
    async (p) => {
      if (!session) return;
      await removeProgressFn({ data: p });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
    [session, qc],
  );

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      session,
      watchlist,
      toggleWatch,
      inWatchlist,
      progress,
      progressFor,
      saveProgress,
      removeProgress,
      hydrated,
    }),
    [settings, setSettings, session, watchlist, toggleWatch, inWatchlist, progress, progressFor, saveProgress, removeProgress, hydrated],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
