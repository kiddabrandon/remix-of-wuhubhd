import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { motion } from "motion/react";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  next: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Sign in — WuHubHD" },
      { name: "description", content: "Sign in to WuHubHD to sync your watchlist and continue watching." },
    ],
  }),
  component: AuthPage,
});

function safeNext(next: string | undefined): string {
  if (!next) return "/";
  try {
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    const u = new URL(next, window.location.origin);
    if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
  } catch {}
  return "/";
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeNext(next), replace: true });
    });
  }, [next, navigate]);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Account created. Check your email to confirm it, then come back and sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: safeNext(next), replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(600px 400px at 20% 20%, var(--accent) 0%, transparent 60%), radial-gradient(500px 500px at 80% 80%, #A855F7 0%, transparent 60%)",
          filter: "blur(80px)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950/80 p-8 shadow-2xl backdrop-blur-xl"
      >
        <Link to="/" className="mb-8 flex items-center gap-2 text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-black" style={{ background: "var(--accent)" }}>
            ◐
          </span>
          <span className="font-display tracking-tight">WuHubHD</span>
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {mode === "signin" ? "Sign in to continue." : "Join to sync your watchlist across devices."}
        </p>

        <form onSubmit={onEmail} className="mt-6 space-y-3">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-400">Display name</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3">
                <User className="h-4 w-4 text-neutral-500" />
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-transparent py-3 text-sm outline-none"
                  placeholder="Your name"
                />
              </div>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-400">Email</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3">
              <Mail className="h-4 w-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent py-3 text-sm outline-none"
                placeholder="you@domain.com"
                autoComplete="email"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-neutral-400">Password</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3">
              <Lock className="h-4 w-4 text-neutral-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent py-3 text-sm outline-none"
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
          </label>

          {err && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {err}
            </div>
          )}

          {notice && (
            <div className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-accent">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-black disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-neutral-400">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button className="text-white underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="text-white underline-offset-4 hover:underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
