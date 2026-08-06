import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Circle, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/youtube-test")({
  head: () => ({
    meta: [
      { title: "YouTube & Party QA Checklist — WuHubHD" },
      {
        name: "description",
        content:
          "Step-by-step checks for YouTube trailers, party server-selection sync and the chat overlay in WuHubHD.",
      },
      { property: "og:title", content: "YouTube & Party QA Checklist — WuHubHD" },
      {
        property: "og:description",
        content: "Verify trailers, party sync and chat behaviour before every release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChecklistPage,
});

const GROUPS: { title: string; steps: string[] }[] = [
  {
    title: "1 · YouTube trailers",
    steps: [
      "Open a movie page and tap the trailer button — the trailer must play without an error code.",
      "If a red 'Video player configuration error 153' appears, the embed lost its referrer: reload once and report it.",
      "Open the YouTube tab, search 'official trailer 2026', then tap a result — it must open its own video page.",
      "On the video page, playback starts (autoplay follows your Settings toggle) and 'More like this' lists related videos.",
      "Tap a related video — the page swaps to that video without a full reload.",
      "Rotate to landscape on a phone: the player fills the width and nothing overflows horizontally.",
    ],
  },
  {
    title: "2 · Party server-selection sync",
    steps: [
      "Host: open any movie/show and tap Start Watch Party. Note the 6-character invite code.",
      "Guest: open the Party tab, key in the code, and join.",
      "Host: change the server in the dropdown above the player — the guest's player switches within a few seconds.",
      "Host: pick YouTube as the source — the guest also switches to the YouTube source.",
      "Guest: confirm the dropdown is read-only and reads 'Host controls the server'.",
      "Host: for a series, change the season/episode — the guest's player follows.",
      "Host: run a countdown (Start in 5s) — both players reload together at the end of the countdown.",
    ],
  },
  {
    title: "3 · Chat overlay",
    steps: [
      "Mobile: tap 'Show chat' — a bottom sheet opens with the message field visible above the keyboard.",
      "Type a message and send — it appears instantly for both host and guest.",
      "If sending fails, a red 'Chat error: …' line shows the exact reason (screenshot it).",
      "Tap outside the sheet — it closes and playback keeps running.",
      "Desktop: the chat panel sits beside the player and scrolls independently.",
      "Fullscreen: the chat overlay stays inside the player and the invite code stays below the host controls.",
    ],
  },
];

function ChecklistPage() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const total = GROUPS.reduce((n, g) => n + g.steps.length, 0);
  const passed = Object.values(done).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
            <ClipboardList className="h-5 w-5" style={{ color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">QA checklist</h1>
            <p className="text-xs text-neutral-400">
              {passed}/{total} checks passed
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 font-display text-base font-semibold">{g.title}</h2>
            <ul className="space-y-2">
              {g.steps.map((s) => {
                const key = `${g.title}|${s}`;
                const checked = !!done[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setDone((d) => ({ ...d, [key]: !checked }))}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left text-sm hover:bg-white/5"
                    >
                      {checked ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />
                      )}
                      <span className={checked ? "text-neutral-500 line-through" : "text-neutral-200"}>{s}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
