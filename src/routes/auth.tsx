import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { motion } from "motion/react";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const schema = z.object({
  next: fallback(z.string(), "/").default("/"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: zodValidator(schema),
  head: () => ({
    meta: [
      { title: "Sign in — CinehubHD" },
      { name: "description", content: "Sign in to CinehubHD to sync your watchlist and continue watching." },
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safeNext(next), replace: true });
    });
  }, [next, navigate]);

  const onGoogle = async () => {
    setErr(null);
    setLoading(true);
    try {
      // remember the intended path — OAuth redirects to app origin (public)
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cinehub.next", safeNext(next));
      }
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth/callback",
      });
      if (result.error) {
        setErr(result.error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // popup succeeded — session set
      navigate({ to: safeNext(next), replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
      setLoading(false);
    }
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
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
          <span className="font-display tracking-tight">CinehubHD</span>
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {mode === "signin" ? "Sign in to continue." : "Join to sync your watchlist across devices."}
        </p>

        <button
          onClick={onGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5l-6-4.9c-2 1.4-4.5 2.3-6.9 2.3-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.6l6 4.9C41.2 35.4 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-[11px] tracking-widest text-neutral-500 uppercase">
          <div className="h-px flex-1 bg-white/10" />
          or
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onEmail} className="space-y-3">
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
