/**
 * Android TV / large-screen support.
 *
 * TVs are driven by a D-pad remote: there is no pointer, so every interactive
 * element must be reachable with arrow keys and activated with Enter. Browsers on
 * Android TV expose plain keyboard events for the remote, so spatial navigation is
 * implemented on top of the normal focus order.
 */

const TV_HINTS = [/android\s*tv/i, /googletv/i, /smart-?tv/i, /aft[bmst]/i, /bravia/i, /webos/i, /tizen/i, /crkey/i];

/** True when the app is running on a TV-class device. */
export function isTvDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (TV_HINTS.some((re) => re.test(ua))) return true;
  // Big screen + no pointer is a reliable TV signal for browsers with a generic UA.
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse) and (min-width: 1280px)").matches === true &&
    !("ontouchstart" in window)
  );
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function visibleFocusables() {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  });
}

/** Picks the nearest focusable in the requested direction, weighted along that axis. */
function nextInDirection(from: HTMLElement, dir: "up" | "down" | "left" | "right") {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const el of visibleFocusables()) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const dx = bx - ax;
    const dy = by - ay;

    const forward =
      dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    if (forward <= 4) continue;
    const drift = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);
    const score = forward + drift * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Enables D-pad navigation. Returns a cleanup function.
 * Text inputs keep native arrow-key behaviour so typing still works.
 */
export function enableTvNavigation() {
  document.documentElement.dataset['tv'] = "1";

  const onKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement as HTMLElement | null;
    const typing =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active?.isContentEditable === true;

    const dir =
      e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : null;

    if (dir && !typing) {
      const from = active && active !== document.body ? active : visibleFocusables()[0];
      if (!from) return;
      const target = active && active !== document.body ? nextInDirection(from, dir) : from;
      if (target) {
        e.preventDefault();
        target.focus();
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
      return;
    }

    if ((e.key === "Enter" || e.key === " ") && active && !typing && active !== document.body) {
      // Remote OK button: browsers already click buttons/links, but role-based
      // elements need the synthetic click.
      if (!(active instanceof HTMLButtonElement) && !(active instanceof HTMLAnchorElement)) {
        e.preventDefault();
        active.click();
      }
      return;
    }

    // Remote Back / Escape steps back through history instead of exiting the app.
    if (e.key === "GoBack" || e.key === "BrowserBack") {
      e.preventDefault();
      history.back();
    }
  };

  window.addEventListener("keydown", onKeyDown);
  // Give the remote something to land on straight away.
  window.setTimeout(() => visibleFocusables()[0]?.focus(), 300);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    delete document.documentElement.dataset['tv'];
  };
}
