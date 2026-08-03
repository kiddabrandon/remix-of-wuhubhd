import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Server, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { useApp } from "@/lib/app-store";
import { useSiteConfig } from "@/lib/site-config";
import { orderedServers, type StreamServer } from "@/lib/servers";

type ProgressPayload = {
  position_seconds: number;
  duration_seconds: number;
};

export function Player({
  type,
  id,
  season,
  episode,
  resumeSeconds = 0,
  onProgress,
  poster,
  title,
  serverId,
  onServerChange,
  lockServer = false,
  reloadKey = 0,
  overlay,
  youtubeKey,
}: {
  type: "movie" | "tv";
  id: number | string;
  season?: number;
  episode?: number;
  resumeSeconds?: number;
  onProgress?: (p: ProgressPayload) => void;
  poster?: string | null;
  title?: string;
  /** When set, the active server is controlled from outside (watch party host). */
  serverId?: string | null;
  onServerChange?: (id: string) => void;
  /** Guests in a party can't change the server. */
  lockServer?: boolean;
  /** Bump to force the embed to reload (host "resync"). */
  reloadKey?: number;
  /** Rendered inside the player box so it survives fullscreen (party chat). */
  overlay?: ReactNode;
  /** YouTube video id — adds YouTube as a selectable, party-syncable source. */
  youtubeKey?: string | null;
}) {
  const { settings } = useApp();
  const site = useSiteConfig();
  // Admin-set global order takes precedence; user's local order is the fallback.
  const effectiveOrder = site.serverOrder?.length ? site.serverOrder : settings.serverOrder;
  const servers = useMemo(() => {
    const base = orderedServers(effectiveOrder);
    if (!youtubeKey) return base;
    const yt: StreamServer = {
      id: "youtube",
      name: "YouTube",
      kind: "general",
      color: "#FF0033",
      movie: () => "",
      tv: () => "",
    };
    return [...base, yt];
  }, [effectiveOrder, youtubeKey]);
  const [localId, setLocalId] = useState<string>(servers[0]?.id ?? "");
  const activeId = serverId || localId;

  const setActiveId = useCallback(
    (next: string) => {
      setLocalId(next);
      onServerChange?.(next);
    },
    [onServerChange],
  );
  const [errored, setErrored] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<number | null>(null);
  const lastResumeRef = useRef<number>(resumeSeconds);

  // Keep latest resume value available to iframe reloads when switching servers.
  useEffect(() => {
    lastResumeRef.current = resumeSeconds;
  }, [resumeSeconds]);

  useEffect(() => {
    if (!servers.find((s) => s.id === activeId)) setLocalId(servers[0]?.id ?? "");
  }, [servers, activeId]);

  // Host-triggered resync.
  useEffect(() => {
    setErrored(false);
    setNonce((n) => n + 1);
  }, [reloadKey]);

  const active: StreamServer | undefined = servers.find((s) => s.id === activeId) ?? servers[0];


  const src = useMemo(() => {
    if (!active) return "";
    const base =
      type === "tv" && season != null && episode != null
        ? active.tv(id, season, episode)
        : active.movie(id);
    const sep = base.includes("?") ? "&" : "?";
    const q = new URLSearchParams();
    q.set("autoplay", settings.autoplay ? "1" : "0");
    if (settings.subtitleLang) q.set("ds_lang", settings.subtitleLang);
    // Best-effort resume hints across providers (harmless when ignored).
    const t = Math.floor(lastResumeRef.current || 0);
    if (t > 5) {
      q.set("t", String(t));
      q.set("startTime", String(t));
      q.set("progress", String(t));
    }
    return `${base}${sep}${q.toString()}`;
  }, [active, type, id, season, episode, settings.autoplay, settings.subtitleLang, nonce]);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  // Focus mode: hide chrome after 4s inactivity.
  useEffect(() => {
    if (!settings.focusMode) {
      document.body.classList.remove("focus-mode");
      return;
    }
    const arm = () => {
      document.body.classList.remove("focus-mode");
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        document.body.classList.add("focus-mode");
      }, 4000);
    };
    const onMove = () => arm();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onMove);
    window.addEventListener("touchstart", onMove);
    arm();
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onMove);
      window.removeEventListener("touchstart", onMove);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      document.body.classList.remove("focus-mode");
    };
  }, [settings.focusMode]);

  // postMessage timeline persistence (Videasy, VidLink, and most iframe providers
  // broadcast currentTime/duration events). Debounced to ~5s.
  const lastSaveRef = useRef<number>(0);
  const handleProgress = useCallback(
    (p: ProgressPayload) => {
      if (!onProgress) return;
      const now = Date.now();
      if (now - lastSaveRef.current < 5000) return;
      lastSaveRef.current = now;
      onProgress(p);
    },
    [onProgress],
  );

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      try {
        const raw = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (!raw || typeof raw !== "object") return;
        const d = raw.data ?? raw;
        // Videasy: {type:"PLAYER_EVENT", data:{currentTime, duration, event}}
        // VidLink: {type:"MEDIA_DATA", data:{...}} + {type:"PLAYER_EVENT", data:{...}}
        const ct = Number(d.currentTime ?? d.position ?? d.progress ?? d.time);
        const du = Number(d.duration ?? d.total ?? d.runtime);
        if (isFinite(ct) && ct > 0 && isFinite(du) && du > 0) {
          lastResumeRef.current = ct;
          handleProgress({ position_seconds: ct, duration_seconds: du });
        }
      } catch {
        /* ignore non-JSON */
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [handleProgress]);

  // Fullscreen wrapper (works for iframes since cross-origin blocks in-iframe controls).
  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as any);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs as any);
    };
  }, []);

  const toggleFullscreen = async () => {
    const el = wrapRef.current as any;
    if (!el) return;
    const inFs = document.fullscreenElement || (document as any).webkitFullscreenElement;
    const orientation = (screen as any)?.orientation;
    try {
      if (inFs) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
        // App is portrait-locked; release the temporary landscape lock.
        try {
          orientation?.unlock?.();
        } catch {
          /* ignore */
        }
      } else {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
        else if (iframeRef.current && (iframeRef.current as any).webkitEnterFullscreen)
          (iframeRef.current as any).webkitEnterFullscreen();
        try {
          await orientation?.lock?.("landscape");
        } catch {
          /* device may refuse; harmless */
        }
      }
    } catch {

      /* ignore */
    }
  };

  const tryNext = () => {
    const idx = servers.findIndex((s) => s.id === activeId);
    const next = servers[idx + 1];
    if (next) {
      setActiveId(next.id);
      setErrored(false);
      setNonce((n) => n + 1);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/5"
    >
      <div className="relative aspect-video w-full">
        {!errored && active ? (
          <iframe
            ref={iframeRef}
            key={`${active.id}-${nonce}`}
            src={src}
            title={title ? `${title} · ${active.name}` : `Player · ${active.name}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            // Blocks the provider's pop-ups / redirect-to-ad tricks while keeping playback working.
            allowFullScreen
            referrerPolicy="no-referrer"
            loading="lazy"
            className="absolute inset-0 h-full w-full"
            onError={() => setErrored(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-400" />
            <p className="text-sm text-neutral-300">
              This stream failed to load{active ? ` on ${active.name}` : ""}.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => {
                  setErrored(false);
                  setNonce((n) => n + 1);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
              <button
                onClick={tryNext}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-black"
                style={{ background: "var(--accent)" }}
              >
                Try next server
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wrapper controls (server switch + fullscreen) */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 hide-in-focus">
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/70 text-neutral-100 backdrop-blur hover:bg-black/90"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        {lockServer ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-medium text-neutral-300 backdrop-blur">
            <Server className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            {active?.name ?? "Server"} · host
          </span>
        ) : (
          <div className="relative">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-medium text-neutral-100 backdrop-blur hover:bg-black/90"
            >
              <Server className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              {active?.name ?? "Server"}
              <ChevronDown className={`h-3.5 w-3.5 transition ${pickerOpen ? "rotate-180" : ""}`} />
            </button>
            {pickerOpen && (
              <div className="scrollbar-none absolute right-0 mt-2 max-h-80 w-56 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-neutral-950/95 p-1 shadow-2xl backdrop-blur">
                {servers.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveId(s.id);
                      setErrored(false);
                      setNonce((n) => n + 1);
                      setPickerOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                      s.id === active?.id ? "bg-white/5" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold"
                        style={{
                          background: `${s.color ?? "#00E5FF"}22`,
                          color: s.color ?? "#00E5FF",
                        }}
                      >
                        {i + 1}
                      </span>
                      {s.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                      {s.kind}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Party chat / countdown overlay — lives inside the fullscreen element. */}
      {overlay}

      {/* Poster overlay while loading */}
      {poster && (
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img src={poster} alt="" className="h-full w-full object-cover opacity-30" />
        </div>
      )}

    </div>
  );
}
