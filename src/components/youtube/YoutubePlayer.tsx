import { useEffect, useRef, useState, useCallback, useId } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Captions,
  Gauge,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Repeat,
} from "lucide-react";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYoutubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return apiPromise;
}

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, "0")}` : `${mm}:${String(sec).padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function YoutubePlayer({
  videoId,
  autoplay = true,
  vertical = false,
  onEnded,
  className = "",
}: {
  videoId: string;
  autoplay?: boolean;
  vertical?: boolean;
  onEnded?: () => void;
  className?: string;
}) {
  const containerId = `yt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [qualities, setQualities] = useState<string[]>([]);
  const [quality, setQuality] = useState("auto");
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menu, setMenu] = useState<"speed" | "quality" | "settings" | null>(null);
  const [loop, setLoop] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const loopRef = useRef(false);
  const autoNextRef = useRef(true);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);
  useEffect(() => {
    autoNextRef.current = autoNext;
  }, [autoNext]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    let cancelled = false;
    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      const player = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          controls: 0, // our own control bar owns playback UI
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: origin || undefined,
        },
        events: {
          onReady: (e: any) => {
            if (cancelled) return;
            setReady(true);
            setDuration(e.target.getDuration?.() ?? 0);
            setVolume(e.target.getVolume?.() ?? 100);
            try {
              setQualities(e.target.getAvailableQualityLevels?.() ?? []);
            } catch {
              /* ignore */
            }
            if (autoplay) e.target.playVideo?.();
          },
          onStateChange: (e: any) => {
            if (cancelled) return;
            const YT = window.YT;
            if (e.data === YT.PlayerState.PLAYING) setPlaying(true);
            else if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
            else if (e.data === YT.PlayerState.ENDED) {
              setPlaying(false);
              if (loopRef.current) {
                e.target.seekTo?.(0, true);
                e.target.playVideo?.();
              } else if (autoNextRef.current) {
                onEnded?.();
              }
            }
          },
        },
      });
      playerRef.current = player;
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // Poll progress
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        setCurrent(p.getCurrentTime() ?? 0);
        setDuration(p.getDuration?.() ?? 0);
        try {
          const frac = p.getVideoLoadedFraction?.() ?? 0;
          setBuffered(frac * (p.getDuration?.() ?? 0));
        } catch {
          /* ignore */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready]);

  const resetHideTimer = useCallback(() => {
    setShowBar(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowBar(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Fullscreen change + orientation lock
  useEffect(() => {
    const onFs = () => {
      const fs = document.fullscreenElement === wrapRef.current;
      setIsFullscreen(fs);
      const orientation = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void>; unlock?: () => void } })
        ?.orientation;
      try {
        if (fs && !vertical) {
          void orientation?.lock?.("landscape").catch(() => {});
        } else {
          orientation?.unlock?.();
          void orientation?.lock?.("portrait").catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [vertical]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo?.();
    else p.playVideo?.();
  }, [playing]);

  const seekBy = useCallback((delta: number) => {
    const p = playerRef.current;
    if (!p) return;
    const t = Math.max(0, Math.min((p.getDuration?.() ?? 0), (p.getCurrentTime?.() ?? 0) + delta));
    p.seekTo?.(t, true);
    setCurrent(t);
  }, []);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted || p.isMuted?.()) {
      p.unMute?.();
      setMuted(false);
    } else {
      p.mute?.();
      setMuted(true);
    }
  }, [muted]);

  const toggleFullscreen = useCallback(async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  const togglePip = useCallback(async () => {
    try {
      const iframe = wrapRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
      const video = iframe?.contentWindow?.document?.querySelector("video") as HTMLVideoElement | undefined;
      if (video && (document as any).pictureInPictureEnabled) {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        else await video.requestPictureInPicture();
      }
    } catch {
      /* cross-origin iframes usually block this; fail silently */
    }
  }, []);

  const toggleCaptions = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (captionsOn) {
        p.unloadModule?.("captions");
        setCaptionsOn(false);
      } else {
        p.loadModule?.("captions");
        p.setOption?.("captions", "track", { languageCode: "en" });
        setCaptionsOn(true);
      }
    } catch {
      /* ignore */
    }
  }, [captionsOn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") seekBy(10);
      else if (e.key === "ArrowLeft") seekBy(-10);
      else if (e.key === "m") toggleMute();
      else if (e.key === "f") void toggleFullscreen();
      resetHideTimer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleMute, toggleFullscreen, resetHideTimer]);

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div
      ref={wrapRef}
      className={`group relative overflow-hidden bg-black ${className}`}
      onMouseMove={resetHideTimer}
      onPointerDown={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      <div id={containerId} className="absolute inset-0 h-full w-full" />
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full cursor-pointer"
        style={{ background: "transparent" }}
      />

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2.5 pb-2 pt-8 transition-opacity duration-300 sm:px-4 sm:pb-3 ${
          showBar ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={(e) => {
              const t = Number(e.target.value);
              playerRef.current?.seekTo?.(t, true);
              setCurrent(t);
            }}
            aria-label="Seek"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--accent)]"
            style={{
              background: `linear-gradient(to right, var(--accent) ${(current / (duration || 1)) * 100}%, rgba(255,255,255,0.35) ${
                (current / (duration || 1)) * 100
              }%, rgba(255,255,255,0.35) ${(buffered / (duration || 1)) * 100}%, rgba(255,255,255,0.15) ${
                (buffered / (duration || 1)) * 100
              }%)`,
            }}
          />
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay} className="rounded-full p-1.5 text-white hover:bg-white/10">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" aria-label="Back 10 seconds" onClick={() => seekBy(-10)} className="rounded-full p-1.5 text-white hover:bg-white/10">
            <SkipBack className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Forward 10 seconds" onClick={() => seekBy(10)} className="rounded-full p-1.5 text-white hover:bg-white/10">
            <SkipForward className="h-4 w-4" />
          </button>

          <button type="button" aria-label={muted ? "Unmute" : "Mute"} onClick={toggleMute} className="rounded-full p-1.5 text-white hover:bg-white/10">
            <VolIcon className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              setMuted(v === 0);
              playerRef.current?.setVolume?.(v);
              if (v > 0) playerRef.current?.unMute?.();
            }}
            aria-label="Volume"
            className="hidden h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-[var(--accent)] sm:block"
          />

          <span className="ml-0.5 whitespace-nowrap text-[11px] tabular-nums text-neutral-300">
            {fmtTime(current)} / {fmtTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Captions"
              onClick={toggleCaptions}
              className={`rounded-full p-1.5 hover:bg-white/10 ${captionsOn ? "text-[var(--accent)]" : "text-white"}`}
            >
              <Captions className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                aria-label="Playback speed"
                onClick={() => setMenu((m) => (m === "speed" ? null : "speed"))}
                className="rounded-full p-1.5 text-white hover:bg-white/10"
              >
                <Gauge className="h-4 w-4" />
              </button>
              {menu === "speed" && (
                <div className="absolute bottom-9 right-0 z-10 w-24 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/95 py-1 text-xs shadow-xl">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        playerRef.current?.setPlaybackRate?.(s);
                        setSpeed(s);
                        setMenu(null);
                      }}
                      className={`block w-full px-3 py-1.5 text-left hover:bg-white/10 ${speed === s ? "text-[var(--accent)]" : "text-neutral-200"}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {qualities.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Quality"
                  onClick={() => setMenu((m) => (m === "quality" ? null : "quality"))}
                  className="rounded-full p-1.5 text-white hover:bg-white/10"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                {menu === "quality" && (
                  <div className="absolute bottom-9 right-0 z-10 w-28 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/95 py-1 text-xs shadow-xl">
                    {["auto", ...qualities].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          playerRef.current?.setPlaybackQuality?.(q);
                          setQuality(q);
                          setMenu(null);
                        }}
                        className={`block w-full px-3 py-1.5 text-left capitalize hover:bg-white/10 ${quality === q ? "text-[var(--accent)]" : "text-neutral-200"}`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                aria-label="Player settings"
                onClick={() => setMenu((m) => (m === "settings" ? null : "settings"))}
                className="rounded-full p-1.5 text-white hover:bg-white/10"
              >
                <Repeat className="h-4 w-4" />
              </button>
              {menu === "settings" && (
                <div className="absolute bottom-9 right-0 z-10 w-40 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/95 py-1 text-xs shadow-xl">
                  <button
                    type="button"
                    onClick={() => setLoop((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-neutral-200 hover:bg-white/10"
                  >
                    Loop video
                    <span className={loop ? "text-[var(--accent)]" : "text-neutral-500"}>{loop ? "On" : "Off"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoNext((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-neutral-200 hover:bg-white/10"
                  >
                    Autoplay next
                    <span className={autoNext ? "text-[var(--accent)]" : "text-neutral-500"}>{autoNext ? "On" : "Off"}</span>
                  </button>
                </div>
              )}
            </div>

            <button type="button" aria-label="Picture in picture" onClick={togglePip} className="hidden rounded-full p-1.5 text-white hover:bg-white/10 sm:inline-flex">

              <PictureInPicture2 className="h-4 w-4" />
            </button>

            <button type="button" aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen} className="rounded-full p-1.5 text-white hover:bg-white/10">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
