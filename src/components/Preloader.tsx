import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const LOTTIE_SRC = "https://lottie.host/3805e52f-1de0-4688-b1df-d0fb66df5918/sZBZNJNyYZ.json";
const SCRIPT_SRC = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.14/dist/dotlottie-wc.js";

let shownOnce = false;

export function Preloader() {
  const [visible, setVisible] = useState(!shownOnce);

  useEffect(() => {
    if (!visible) return;
    shownOnce = true;

    // Load the dotLottie web component once.
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = SCRIPT_SRC;
      document.head.appendChild(s);
    }

    const hide = () => setVisible(false);
    const t = window.setTimeout(hide, 1600);
    if (document.readyState === "complete") {
      window.setTimeout(hide, 700);
    } else {
      window.addEventListener("load", () => window.setTimeout(hide, 500), { once: true });
    }
    return () => window.clearTimeout(t);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="fixed inset-0 z-[200] grid place-items-center bg-black"
        >
          {/* @ts-expect-error custom element */}
          <dotlottie-wc src={LOTTIE_SRC} style={{ width: "220px", height: "220px" }} autoplay loop />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
