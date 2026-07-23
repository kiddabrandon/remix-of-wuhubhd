import { useEffect, useState, type ReactNode } from "react";

/**
 * Sample dominant colors from a backdrop/poster URL by drawing it to a canvas
 * and averaging pixel quadrants. Falls back to accent color when the image
 * can't be sampled (CORS or missing).
 */
function useDominantColors(imageUrl: string | null): string[] {
  const [colors, setColors] = useState<string[]>([]);
  useEffect(() => {
    if (!imageUrl) {
      setColors([]);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        const w = (canvas.width = 32);
        const h = (canvas.height = 32);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const buckets = [
          [0, 0, w / 2, h / 2],
          [w / 2, 0, w / 2, h / 2],
          [0, h / 2, w / 2, h / 2],
          [w / 2, h / 2, w / 2, h / 2],
        ];
        const out: string[] = [];
        for (const [x, y, bw, bh] of buckets) {
          const { data } = ctx.getImageData(x, y, bw, bh);
          let r = 0, g = 0, b = 0, n = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          }
          r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
          // Boost saturation a touch for a richer glow
          out.push(`rgb(${r}, ${g}, ${b})`);
        }
        setColors(out);
      } catch {
        setColors([]);
      }
    };
    img.onerror = () => setColors([]);
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);
  return colors;
}

export function Ambilight({ image, children }: { image: string | null; children: ReactNode }) {
  const colors = useDominantColors(image);
  const c0 = colors[0] ?? "var(--accent)";
  const c1 = colors[1] ?? "var(--accent)";
  const c2 = colors[2] ?? "#A855F7";
  const c3 = colors[3] ?? "#3B5BFF";

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 opacity-70 blur-3xl animate-ambilight"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${c0} 0%, transparent 55%),
                       radial-gradient(circle at 80% 20%, ${c1} 0%, transparent 55%),
                       radial-gradient(circle at 30% 80%, ${c2} 0%, transparent 55%),
                       radial-gradient(circle at 80% 80%, ${c3} 0%, transparent 55%)`,
        }}
      />
      {children}
    </div>
  );
}
