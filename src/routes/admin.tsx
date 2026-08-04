import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Lock,
  LogOut,
  RotateCcw,
  Save,
  Search,
  Activity,
  Users as UsersIcon,
  Bookmark as BookmarkIcon,
  AlertTriangle,
  Trash2,
  Plus,
  RefreshCw,
  Flag,
  Megaphone,
  Image as ImageIcon,
} from "lucide-react";
import { ANIME_API_PROVIDERS, DEFAULT_ANIME_PROVIDERS, DEFAULT_SERVER_ORDER, orderedServers } from "@/lib/servers";
import {
  DEFAULT_HOME_SECTIONS,
  loadSiteConfigLocal,
  saveSiteConfigLocal,
  type SiteConfig,
} from "@/lib/site-config";
import { saveSiteConfig as saveSiteConfigServer } from "@/lib/site-config.functions";
import {
  getAdminStats,
  listServerHealth,
  probeAllProviders,
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  listHeroOverrides,
  createHeroOverride,
  deleteHeroOverride,
  listFlags,
  upsertFlag,
  deleteFlag,
  listErrorLogs,
  clearErrorLogs,
} from "@/lib/admin.functions";
import { AdminAIPanel } from "@/components/AdminAIPanel";

import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";
import { Link } from "@tanstack/react-router";

// Admin access is gated by Supabase auth AND the `admin` role in user_roles.
// The `admin` role is granted automatically to the designated email via a
// database trigger on auth.users.

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — WuHubHD" },
      { name: "description", content: "WuHubHD administrator panel." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminGate,
});

function AdminGate() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const checkAdmin = useServerFn(isAdminFn);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAdmin(null);
      return;
    }
    let cancelled = false;
    checkAdmin()
      .then((r) => {
        if (!cancelled) setAdmin(Boolean(r?.admin));
      })
      .catch(() => {
        if (!cancelled) setAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, checkAdmin]);

  if (!ready) return null;
  if (!session) return <SignInPrompt />;
  if (admin === null) return <LoadingCard />;
  if (!admin) return <DeniedCard email={session.user.email ?? ""} />;
  return <Panel onSignOut={async () => { await supabase.auth.signOut(); }} />;
}

function LoadingCard() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-black px-4 py-10 text-sm text-neutral-400">
      Verifying access…
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-black px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0c] p-6 text-center sm:p-8">
        <div
          className="mx-auto grid h-12 w-12 place-items-center rounded-full"
          style={{ background: "var(--accent)" }}
        >
          <Lock className="h-5 w-5 text-black" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">Admin access</h1>
        <p className="mt-1 text-xs text-neutral-500">Sign in with the authorized account to continue.</p>
        <Link
          to="/auth"
          search={{ next: "/admin" }}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full py-2.5 text-sm font-semibold text-black"
          style={{ background: "var(--accent)" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

function DeniedCard({ email }: { email: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-black px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0c] p-6 text-center sm:p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/20">
          <Lock className="h-5 w-5 text-red-400" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="mt-1 text-xs text-neutral-500">
          {email} is not authorized for the admin panel.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 py-2.5 text-sm hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}




function Panel({ onSignOut }: { onSignOut: () => void }) {
  const initial = useMemo<SiteConfig>(() => loadSiteConfigLocal(), []);
  const [cfg, setCfg] = useState<SiteConfig>({
    serverOrder: initial.serverOrder?.length ? initial.serverOrder : DEFAULT_SERVER_ORDER,
    animeProviders: initial.animeProviders ?? DEFAULT_ANIME_PROVIDERS,
    homeSections: initial.homeSections?.length ? initial.homeSections : [...DEFAULT_HOME_SECTIONS],
    tmdbRegion: initial.tmdbRegion ?? "US",
    featuredCollection: initial.featuredCollection ?? "",
    ...initial,
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveConfigFn = useServerFn(saveSiteConfigServer);

  const save = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      await saveConfigFn({ data: { json: JSON.stringify(cfg) } });
      saveSiteConfigLocal(cfg);
      setSavedAt(Date.now());
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const signOut = () => {
    onSignOut();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.schema.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] bg-black">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{ background: "var(--accent)" }}
            >
              <Lock className="h-4 w-4 text-black" />
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-none">Admin</div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                WuHubHD control panel
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saveErr && <span className="text-[11px] text-red-400">{saveErr}</span>}
            {!saveErr && savedAt && (
              <span className="text-[11px] text-emerald-400">
                Saved {new Date(savedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={exportJson}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              Export JSON
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-black disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <Dashboard />
        <AdminAIPanel />


        <section className="rounded-2xl border border-white/5 bg-[#0b0b0c] p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Global settings
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="TMDB region">
              <input
                value={cfg.tmdbRegion ?? ""}
                onChange={(e) => setCfg({ ...cfg, tmdbRegion: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </Field>
            <Field label="Featured collection ID">
              <input
                value={cfg.featuredCollection ?? ""}
                onChange={(e) => setCfg({ ...cfg, featuredCollection: e.target.value })}
                placeholder="e.g. 10"
                className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </Field>
          </div>
        </section>

        <ServerManager
          order={cfg.serverOrder ?? DEFAULT_SERVER_ORDER}
          onChange={(next) => setCfg((c) => ({ ...c, serverOrder: next }))}
          onReset={() => setCfg((c) => ({ ...c, serverOrder: DEFAULT_SERVER_ORDER }))}
        />

        <HomeSectionsManager
          sections={cfg.homeSections?.length ? cfg.homeSections : [...DEFAULT_HOME_SECTIONS]}
          onChange={(homeSections) => setCfg((c) => ({ ...c, homeSections }))}
        />

        <AnimeProviderManager
          providers={cfg.animeProviders ?? DEFAULT_ANIME_PROVIDERS}
          onChange={(animeProviders) => setCfg((c) => ({ ...c, animeProviders }))}
        />

        <p className="mt-6 text-center text-[11px] text-neutral-600">
          Changes are stored in the backend and apply to every account.
        </p>
      </main>
    </div>
  );
}

function HomeSectionsManager({ sections, onChange }: { sections: any[]; onChange: (next: any[]) => void }) {
  const move = (idx: number, delta: number) => {
    const next = sections.slice();
    const to = Math.max(0, Math.min(next.length - 1, idx + delta));
    if (idx === to) return;
    next.splice(to, 0, next.splice(idx, 1)[0]);
    onChange(next);
  };
  return (
    <section className="mt-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Home sections</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {sections.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-white/10 text-[10px]">{i + 1}</span>
            <div className="min-w-0 flex-1 truncate text-sm">{s.label ?? DEFAULT_HOME_SECTIONS.find((x) => x.id === s.id)?.label ?? s.id}</div>
            <button onClick={() => onChange(sections.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x))} className={`rounded-full px-2.5 py-1 text-[11px] ${s.enabled ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-neutral-400"}`}>{s.enabled ? "On" : "Off"}</button>
            <button onClick={() => move(i, -1)} className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5"><ArrowUp className="h-3 w-3" /></button>
            <button onClick={() => move(i, 1)} className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5"><ArrowDown className="h-3 w-3" /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnimeProviderManager({ providers, onChange }: { providers: string[]; onChange: (next: string[]) => void }) {
  const enabled = new Set(providers);
  const toggle = (id: string) => onChange(enabled.has(id) ? providers.filter((p) => p !== id) : [...providers, id]);
  const move = (id: string, delta: number) => {
    const next = providers.slice();
    const idx = next.indexOf(id);
    if (idx < 0) return;
    const to = Math.max(0, Math.min(next.length - 1, idx + delta));
    next.splice(to, 0, next.splice(idx, 1)[0]);
    onChange(next);
  };
  return (
    <section className="mt-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-5 sm:p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Anime providers</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {ANIME_API_PROVIDERS.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="min-w-0 flex-1"><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-neutral-500">{p.description}</div></div>
            <button onClick={() => toggle(p.id)} className={`rounded-full px-2.5 py-1 text-[11px] ${enabled.has(p.id) ? "bg-emerald-400/20 text-emerald-200" : "bg-white/10 text-neutral-400"}`}>{enabled.has(p.id) ? "On" : "Off"}</button>
            {enabled.has(p.id) && <><button onClick={() => move(p.id, -1)} className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5"><ArrowUp className="h-3 w-3" /></button><button onClick={() => move(p.id, 1)} className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5"><ArrowDown className="h-3 w-3" /></button></>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] uppercase tracking-widest text-neutral-500">{label}</div>
      {children}
    </label>
  );
}

function ServerManager({
  order,
  onChange,
  onReset,
}: {
  order: string[];
  onChange: (next: string[]) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"general" | "anime">("general");
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const all = useMemo(() => orderedServers(order), [order]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((s) => s.kind === tab)
      .filter((s) =>
        q ? s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) : true,
      );
  }, [all, tab, query]);

  const move = (id: string, delta: number) => {
    const ids = order.slice();
    const i = ids.indexOf(id);
    if (i < 0) return;
    const j = Math.max(0, Math.min(ids.length - 1, i + delta));
    if (i === j) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    onChange(ids);
  };

  const reorderById = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = order.slice();
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onChange(ids);
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Player servers
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Drag or use the arrows to set the global default playback order.
          </p>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs">
          {(["general", "anime"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1.5 capitalize transition ${
                tab === k ? "bg-white/15 text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${tab} servers…`}
            className="w-full rounded-full border border-white/10 bg-black/60 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {filtered.map((s) => {
          const globalIdx = order.indexOf(s.id);
          return (
            <li
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) reorderById(dragId, s.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5 transition ${
                dragId === s.id ? "opacity-60" : "hover:border-white/25"
              }`}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-neutral-500" />
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold"
                style={{
                  background: `${s.color ?? "#00E5FF"}22`,
                  color: s.color ?? "#00E5FF",
                  border: `1px solid ${s.color ?? "#00E5FF"}44`,
                }}
              >
                {globalIdx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.name}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => move(s.id, -1)}
                  className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => move(s.id, 1)}
                  className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-neutral-500">
            No servers match "{query}".
          </li>
        )}
      </ul>
    </section>
  );
}

// ============================================================
// Dashboard — cloud stats, provider health, announcements, hero
// overrides, feature flags, and error logs. Server functions
// enforce the admin role; this UI needs a signed-in admin user.
// ============================================================
function Dashboard() {
  return (
    <section
      className="mb-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-5 sm:p-6"
      style={{ boxShadow: "0 0 50px rgba(0, 216, 255, 0.05)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Dashboard
        </h2>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-cyan-300">
          Live
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Requires a signed-in admin account. Server functions enforce the role.
      </p>
      <StatsGrid />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <HealthCard />
        <AnnouncementsCard />
        <HeroOverridesCard />
        <FlagsCard />
        <AddonsInfoCard />

      </div>
      <ErrorLogsCard />
    </section>
  );
}

/** Streaming add-ons are bundled server-side; this card documents what ships. */
function AddonsInfoCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="h-4 w-4 text-cyan-300" /> Built-in streaming add-ons
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Stremio add-ons and Nuvio provider packs are bundled with the app and enabled by default for
        every account. They are intentionally hidden from the frontend UI — users never install
        anything manually.
      </p>
      <ul className="mt-3 space-y-1 text-xs text-neutral-300">
        {STREMIO_ADDONS.map((a) => (
          <li key={a.id}>
            <span className="text-neutral-500">Stremio ·</span> {a.name}
          </li>
        ))}
        {NUVIO_PLUGINS.map((a) => (
          <li key={a.id}>
            <span className="text-neutral-500">Nuvio ·</span> {a.name}
          </li>
        ))}
      </ul>
    </div>
  );
}


function StatsGrid() {
  const fn = useServerFn(getAdminStats);
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: () => fn(), refetchInterval: 60_000, retry: false });
  const stats = q.data;
  const items = [
    { label: "Users", value: stats?.users ?? "—", icon: UsersIcon },
    { label: "Plays 24h", value: stats?.plays24h ?? "—", icon: Activity },
    { label: "Plays 7d", value: stats?.plays7d ?? "—", icon: Activity },
    { label: "Watchlist rows", value: stats?.watchlist ?? "—", icon: BookmarkIcon },
    { label: "Errors 24h", value: stats?.errors24h ?? "—", icon: AlertTriangle },
  ];
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-neutral-500">
              <it.icon className="h-3 w-3" /> {it.label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold text-white">{String(it.value)}</div>
          </div>
        ))}
      </div>
      {q.isError && <ErrHint error={q.error} />}
      {stats?.top && stats.top.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Top titles (7d)</div>
          <ol className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            {stats.top.map((t, i) => (
              <li key={`${t.media_type}-${t.tmdb_id}`} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  <span className="mr-2 text-neutral-500">{i + 1}.</span>
                  {t.title}
                  <span className="ml-1 text-neutral-500">({t.media_type})</span>
                </span>
                <span className="tabular-nums text-cyan-300">{t.plays}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

function HealthCard() {
  const list = useServerFn(listServerHealth);
  const probe = useServerFn(probeAllProviders);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "health"], queryFn: () => list(), refetchInterval: 60_000, retry: false });
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await probe();
      await qc.invalidateQueries({ queryKey: ["admin", "health"] });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Provider health</div>
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> Probe now
        </button>
      </div>
      <ul className="mt-3 grid gap-2 text-xs">
        {(q.data ?? []).map((s) => (
          <li key={s.server_name} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${s.is_online ? "bg-emerald-400" : "bg-red-500"}`}
                style={{ boxShadow: s.is_online ? "0 0 8px rgba(16,185,129,0.7)" : "0 0 8px rgba(239,68,68,0.7)" }}
              />
              <span className="font-medium">{s.server_name}</span>
              <span className="text-neutral-500">{s.category}</span>
            </div>
            <div className="tabular-nums text-neutral-400">{s.latency_ms == null ? "—" : `${s.latency_ms}ms`}</div>
          </li>
        ))}
        {q.data?.length === 0 && <li className="rounded-lg border border-dashed border-white/10 p-4 text-center text-neutral-500">Run a probe to populate.</li>}
      </ul>
      {q.isError && <ErrHint error={q.error} />}
    </div>
  );
}

function AnnouncementsCard() {
  const list = useServerFn(listAnnouncements);
  const create = useServerFn(createAnnouncement);
  const del = useServerFn(deleteAnnouncement);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => list(), retry: false });
  const [msg, setMsg] = useState("");
  const [variant, setVariant] = useState<"info" | "warn" | "critical">("info");
  const submit = async () => {
    if (!msg.trim()) return;
    await create({ data: { message: msg.trim(), variant } });
    setMsg("");
    qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Megaphone className="h-4 w-4 text-cyan-300" /> Announcements
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="New announcement"
          className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
        />
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as never)}
          className="rounded-lg border border-white/10 bg-black px-2 py-2 text-xs"
        >
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="critical">critical</option>
        </select>
        <button onClick={submit} className="inline-flex items-center gap-1 rounded-full bg-cyan-400 px-3 py-2 text-xs font-semibold text-black">
          <Plus className="h-3 w-3" /> Post
        </button>
      </div>
      <ul className="mt-3 grid gap-2 text-xs">
        {(q.data ?? []).map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2">
            <div>
              <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest">{a.variant}</span>
              {a.message}
            </div>
            <button
              onClick={async () => { await del({ data: { id: a.id } }); qc.invalidateQueries({ queryKey: ["admin", "announcements"] }); }}
              className="rounded-full p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      {q.isError && <ErrHint error={q.error} />}
    </div>
  );
}

function HeroOverridesCard() {
  const list = useServerFn(listHeroOverrides);
  const create = useServerFn(createHeroOverride);
  const del = useServerFn(deleteHeroOverride);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "heroes"], queryFn: () => list(), retry: false });
  const [id, setId] = useState("");
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const submit = async () => {
    const n = Number(id);
    if (!n || !title.trim()) return;
    await create({ data: { content_id: n, content_type: type, title: title.trim(), tagline: tag.trim() || null, backdrop_path: null, sort_order: 0 } });
    setId(""); setTitle(""); setTag("");
    qc.invalidateQueries({ queryKey: ["admin", "heroes"] });
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ImageIcon className="h-4 w-4 text-cyan-300" /> Hero overrides
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="TMDB id" className="rounded-lg border border-white/10 bg-black px-2 py-2 text-xs" />
        <select value={type} onChange={(e) => setType(e.target.value as never)} className="rounded-lg border border-white/10 bg-black px-2 py-2 text-xs">
          <option value="movie">movie</option>
          <option value="tv">tv</option>
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="col-span-2 rounded-lg border border-white/10 bg-black px-2 py-2 text-xs" />
        <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tagline" className="col-span-3 rounded-lg border border-white/10 bg-black px-2 py-2 text-xs" />
        <button onClick={submit} className="rounded-full bg-cyan-400 px-3 py-2 text-xs font-semibold text-black">Add</button>
      </div>
      <ul className="mt-3 grid gap-2 text-xs">
        {(q.data ?? []).map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2">
            <div className="truncate">
              <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest">{h.content_type}</span>
              {h.title} <span className="text-neutral-500">#{h.content_id}</span>
            </div>
            <button onClick={async () => { await del({ data: { id: h.id } }); qc.invalidateQueries({ queryKey: ["admin", "heroes"] }); }} className="rounded-full p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-300">
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      {q.isError && <ErrHint error={q.error} />}
    </div>
  );
}

function FlagsCard() {
  const list = useServerFn(listFlags);
  const upsert = useServerFn(upsertFlag);
  const del = useServerFn(deleteFlag);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "flags"], queryFn: () => list(), retry: false });
  const [key, setKey] = useState("");
  const [val, setVal] = useState('{"enabled":true}');
  const submit = async () => {
    let value: Record<string, unknown> = {};
    try { value = JSON.parse(val); } catch { alert("Invalid JSON"); return; }
    await upsert({ data: { key: key.trim(), value } });
    setKey(""); setVal('{"enabled":true}');
    qc.invalidateQueries({ queryKey: ["admin", "flags"] });
  };
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Flag className="h-4 w-4 text-cyan-300" /> Feature flags
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="flag_key" className="rounded-lg border border-white/10 bg-black px-2 py-2 text-xs" />
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder='{"enabled":true}' className="rounded-lg border border-white/10 bg-black px-2 py-2 font-mono text-xs" />
        <button onClick={submit} className="rounded-full bg-cyan-400 px-3 py-2 text-xs font-semibold text-black">Save</button>
      </div>
      <ul className="mt-3 grid gap-2 text-xs">
        {(q.data ?? []).map((f) => (
          <li key={f.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2">
            <div className="min-w-0 truncate">
              <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest">{f.key}</span>
              <code className="text-neutral-400">{JSON.stringify(f.value)}</code>
            </div>
            <button onClick={async () => { await del({ data: { key: f.key } }); qc.invalidateQueries({ queryKey: ["admin", "flags"] }); }} className="rounded-full p-1 text-neutral-400 hover:bg-red-500/20 hover:text-red-300">
              <Trash2 className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ul>
      {q.isError && <ErrHint error={q.error} />}
    </div>
  );
}

function ErrorLogsCard() {
  const list = useServerFn(listErrorLogs);
  const clear = useServerFn(clearErrorLogs);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "errors"], queryFn: () => list(), retry: false });
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-300" /> Recent errors
        </div>
        <button
          onClick={async () => { await clear(); qc.invalidateQueries({ queryKey: ["admin", "errors"] }); }}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] hover:bg-white/10"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>
      <ul className="mt-3 grid max-h-72 gap-1 overflow-y-auto text-[11px]">
        {(q.data ?? []).map((e) => (
          <li key={e.id} className="rounded border border-white/5 bg-black/50 px-2 py-1.5">
            <div className="flex justify-between text-neutral-500">
              <span>{e.url ?? "app"}</span>
              <span>{new Date(e.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-0.5 truncate text-neutral-200">{e.message}</div>
          </li>
        ))}
        {q.data?.length === 0 && <li className="rounded border border-dashed border-white/10 p-3 text-center text-neutral-500">No errors logged.</li>}
      </ul>
      {q.isError && <ErrHint error={q.error} />}
    </div>
  );
}

function ErrHint({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 p-2 text-[11px] text-amber-200">
      {msg}. Make sure you're signed in as an admin.
    </div>
  );
}
