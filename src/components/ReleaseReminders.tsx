import { useEffect } from "react";
import { toast } from "sonner";
import { takeDueReminders } from "@/lib/release-reminders";

/** Checks saved upcoming titles on load and every hour; alerts when one is released. */
export function ReleaseReminders() {
  useEffect(() => {
    const check = () => {
      for (const r of takeDueReminders()) {
        const msg = `${r.title} is out now on WuHubHD!`;
        toast.success(msg, {
          action: { label: "Watch", onClick: () => (window.location.href = `/watch/${r.type}/${r.id}`) },
        });
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Now available", { body: msg, icon: "/icon-192.png" });
          }
        } catch {}
      }
    };
    check();
    const t = window.setInterval(check, 60 * 60_000);
    return () => window.clearInterval(t);
  }, []);
  return null;
}
