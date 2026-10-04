import { useEffect, useRef, useId } from "react";

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

/**
 * YouTube embed with YouTube's own default controls. All playback UI
 * (play/pause, seek, volume, quality, captions, fullscreen) is provided
 * natively by the embed itself.
 */
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
  const hostRef = useRef<HTMLDivElement>(null);
  const readyProbeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<any>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    let cancelled = false;
    void loadYoutubeApi().then(() => {
      const host = hostRef.current;
      if (cancelled || !window.YT?.Player || !host) return;
      const player = new window.YT.Player(host, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          rel: 0,
          controls: 1, // YouTube's native controls
          disablekb: 0,
          fs: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: origin || undefined,
        },
        events: {
          onReady: (e: any) => {
            if (cancelled) return;
            if (autoplay) e.target.playVideo?.();
          },
          onStateChange: (e: any) => {
            if (cancelled) return;
            const YT = window.YT;
            if (e.data === YT.PlayerState.ENDED) onEnded?.();
          },
        },
      });
      playerRef.current = player;

      // Safety net: keep the component in sync even if `onReady` never fires.
      let tries = 0;
      const probe = setInterval(() => {
        tries += 1;
        const p = playerRef.current;
        if (cancelled || tries > 40) return clearInterval(probe);
        if (typeof p?.getPlayerState === "function") clearInterval(probe);
      }, 250);
      readyProbeRef.current = probe;
    });
    return () => {
      cancelled = true;
      if (readyProbeRef.current) clearInterval(readyProbeRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className={`relative overflow-hidden bg-black ${className} [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:h-full [&_iframe]:w-full`}>
      <img
        src={`https://i.ytimg.com/vi/${videoId}/${vertical ? "oardefault" : "hqdefault"}.jpg`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-60"
      />
      <div ref={hostRef} id={containerId} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
