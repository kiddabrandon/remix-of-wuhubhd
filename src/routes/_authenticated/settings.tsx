import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { ACCENTS, AVATAR_PRESETS, useApp } from "@/lib/app-store";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WuHubHD" },
      { name: "description", content: "Customize your WuHubHD experience." },
    ],
  }),
  component: Settings,
});

const SUB_LANGS = [
  { v: "en", l: "English" },
  { v: "es", l: "Spanish" },
  { v: "fr", l: "French" },
  { v: "de", l: "German" },
  { v: "it", l: "Italian" },
  { v: "pt", l: "Portuguese" },
  { v: "ja", l: "Japanese" },
  { v: "ko", l: "Korean" },
  { v: "zh", l: "Chinese" },
  { v: "ar", l: "Arabic" },
  { v: "hi", l: "Hindi" },
];

function Settings() {
  const { settings, setSettings } = useApp();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-400">Personalize the vibe and the player.</p>

      <section className="mt-10 rounded-2xl border border-white/5 bg-[#0b0b0c] p-4 sm:p-6">
        <h2 className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">Avatar</h2>
        <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
          {AVATAR_PRESETS.map((a) => {
            const active = settings.avatarPreset === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSettings({ avatarPreset: a.id })}
                className={`relative flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition ${active ? "border-transparent" : "border-white/10 hover:bg-white/5"}`}
                style={active ? { boxShadow: "0 0 0 2px var(--accent)" } : undefined}
              >
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full" style={{ background: a.gradient }}>
                  <img src={a.image} alt={a.label} loading="lazy" className="h-full w-full object-contain p-0.5" />
                </div>
                <div className="w-full truncate text-[11px] font-medium">{a.label}</div>
                {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5" style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>
      </section>


      <section className="mt-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-6">
        <h2 className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">Accent color</h2>
        <p className="mt-1 text-xs text-neutral-500">Applies to buttons, highlights, and the active tab.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ACCENTS.map((a) => {
            const active = settings.accent === a.name;
            return (
              <button
                key={a.name}
                onClick={() => setSettings({ accent: a.name })}
                className={`group relative overflow-hidden rounded-xl border p-4 text-left transition ${
                  active ? "border-transparent ring-2" : "border-white/10 hover:bg-white/5"
                }`}
                style={active ? { boxShadow: `0 0 0 2px ${a.value}` } : undefined}
              >
                <div className="mb-3 h-10 w-10 rounded-full" style={{ background: a.value, boxShadow: `0 0 20px ${a.value}55` }} />
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-[11px] text-neutral-500">{a.value}</div>
                {active && (
                  <Check className="absolute top-3 right-3 h-4 w-4" style={{ color: a.value }} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-6">
        <h2 className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">Player</h2>
        <div className="mt-5 space-y-5">
          <label className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Autoplay</div>
              <div className="text-xs text-neutral-500">Start playing as soon as the player loads.</div>
            </div>
            <button
              role="switch"
              aria-checked={settings.autoplay}
              onClick={() => setSettings({ autoplay: !settings.autoplay })}
              className={`relative h-6 w-11 rounded-full transition ${settings.autoplay ? "" : "bg-white/10"}`}
              style={settings.autoplay ? { background: "var(--accent)" } : undefined}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition ${
                  settings.autoplay ? "left-5" : "left-0.5 bg-white"
                }`}
              />
            </button>
          </label>

          <label className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Subtitle language</div>
              <div className="text-xs text-neutral-500">Preferred subtitles for the player when available.</div>
            </div>
            <select
              value={settings.subtitleLang}
              onChange={(e) => setSettings({ subtitleLang: e.target.value })}
              className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {SUB_LANGS.map((l) => (
                <option key={l.v} value={l.v}>
                  {l.l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}

