import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, Loader2 } from "lucide-react";

export function HlsPlayer({
  src,
  poster,
  onError,
}: {
  src: string;
  poster?: string | null;
  onError?: (msg: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    setStatus("loading");
    setMsg("");
    let hls: Hls | null = null;

    const fail = (m: string) => {
      setStatus("error");
      setMsg(m);
      onError?.(m);
    };
    // Give the stream a bounded window to become playable; a hung host should
    // surface as an error (triggering any fallback) instead of spinning forever.
    const readyTimer = window.setTimeout(() => {
      setStatus((s) => {
        if (s === "ready") return s;
        fail("Stream took too long to load.");
        return "error";
      });
    }, 20_000);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari, iOS)
      video.src = src;
      const onCanPlay = () => {
        window.clearTimeout(readyTimer);
        setStatus("ready");
      };
      const onNativeError = () => fail("The stream refused to load.");
      video.addEventListener("canplay", onCanPlay);
      video.addEventListener("error", onNativeError);
      return () => {
        window.clearTimeout(readyTimer);
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("error", onNativeError);
      };
    }

    if (!Hls.isSupported()) {
      window.clearTimeout(readyTimer);
      fail("This browser cannot play HLS streams.");
      return;
    }

    hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      window.clearTimeout(readyTimer);
      setStatus("ready");
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        window.clearTimeout(readyTimer);
        fail(data.details || "Playback error");
      }
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      window.clearTimeout(readyTimer);
      hls?.destroy();
    };
  }, [src, onError]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
      <video
        ref={ref}
        poster={poster ?? undefined}
        controls
        playsInline
        className="h-full w-full bg-black"
      />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-neutral-300">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading stream…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-center text-sm text-neutral-300">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <div>Couldn't play this source.</div>
          {msg && <div className="max-w-xs text-xs text-neutral-500">{msg}</div>}
        </div>
      )}
    </div>
  );
}
