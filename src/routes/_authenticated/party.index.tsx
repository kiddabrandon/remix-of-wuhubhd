import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Users } from "lucide-react";
import { getParty } from "@/lib/party.functions";

export const Route = createFileRoute("/_authenticated/party/")({
  head: () => ({
    meta: [
      { title: "Join a Watch Party — WuHubHD" },
      { name: "description", content: "Enter a 6-character invite code to join a WuHubHD watch party." },
      { property: "og:title", content: "Join a Watch Party — WuHubHD" },
      { property: "og:description", content: "Type your invite code and watch together in sync." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinParty,
});

function JoinParty() {
  const navigate = useNavigate();
  const lookup = useServerFn(getParty);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    const value = code.trim().toUpperCase();
    if (value.length < 4) {
      setError("Invite codes are 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await lookup({ data: { code: value } });
      navigate({ to: "/party/$code", params: { code: value }, search: {} as never });
    } catch {
      setError("No party found with that code. Double-check it with the host.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-8 sm:py-20">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5">
        <Users className="h-5 w-5" style={{ color: "var(--accent)" }} />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">Join a watch party</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Ask the host for their 6-character invite code, then jump straight into the room — no links needed.
      </p>

      <form
        className="mt-8 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void join();
        }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          aria-label="Invite code"
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-4 text-center font-display text-2xl font-bold tracking-[0.4em] outline-none focus:border-white/30 sm:text-3xl"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-black transition disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy ? "Checking…" : "Join party"} <ArrowRight className="h-4 w-4" />
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </form>

      <p className="mt-6 text-xs text-neutral-500">
        Want to host instead? Open any movie or show and tap <b className="text-neutral-300">Start Watch Party</b>.
      </p>
    </div>
  );
}
