import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, X } from "lucide-react";

let installDismissed = false;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstall() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (installDismissed) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari heuristic (no beforeinstallprompt)
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isIos && !isStandalone) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    installDismissed = true;
    setVisible(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted") dismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          className="fixed inset-x-0 top-2 z-[60] flex justify-center px-3 hide-in-focus"
        >
          <div className="flex max-w-md items-center gap-3 rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs backdrop-blur-lg">
            <Download className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            {iosHint ? (
              <span className="text-neutral-300">
                Install WuHubHD: tap Share, then <b>Add to Home Screen</b>.
              </span>
            ) : (
              <>
                <span className="text-neutral-300">Install WuHubHD as an app</span>
                <button
                  onClick={install}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold text-black"
                  style={{ background: "var(--accent)" }}
                >
                  Install
                </button>
              </>
            )}
            <button onClick={dismiss} className="rounded-full p-1 text-neutral-400 hover:text-white" aria-label="Dismiss">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
