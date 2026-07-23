export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const isPreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const inIframe = window.self !== window.top;
  if (isPreview || inIframe || new URL(window.location.href).searchParams.get("sw") === "off") {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
    });
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
