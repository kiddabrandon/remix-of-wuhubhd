import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Copy, Send, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-store";

type Message = {
  id: string;
  room_code: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

type ChatUser = { id: string; email?: string | null; display_name?: string | null };

export function PartyPanel({ code, compact = false }: { code: string; compact?: boolean }) {
  const { session } = useApp();
  const [fallbackUser, setFallbackUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState(0);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The app store session can be empty right after a hard refresh on Netlify,
  // so resolve the signed-in user straight from the auth client as a fallback.
  useEffect(() => {
    if (session?.user) return;
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user) {
        setFallbackUser({
          id: data.user.id,
          email: data.user.email,
          display_name: (data.user.user_metadata?.display_name as string | undefined) ?? null,
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, [session?.user]);

  const user: ChatUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        display_name: (session.user.user_metadata?.display_name as string | undefined) ?? null,
      }
    : fallbackUser;

  const displayName = useMemo(
    () => user?.display_name || user?.email?.split("@")[0] || "Guest",
    [user],
  );


  // load history + realtime subscribe
  useEffect(() => {
    let mounted = true;
    supabase
      .from("party_messages")
      .select("*")
      .eq("room_code", code)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (mounted && data) setMessages(data as Message[]);
      });
    const chan = supabase
      .channel(`party-msg-${code}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "party_messages", filter: `room_code=eq.${code}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(chan);
    };
  }, [code]);

  // presence
  useEffect(() => {
    if (!user?.id) return;
    const chan = supabase.channel(`party-presence-${code}`, {
      config: { presence: { key: user.id } },
    });
    chan
      .on("presence", { event: "sync" }, () => {
        const state = chan.presenceState();
        setPresence(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await chan.track({ name: displayName });
        }
      });
    return () => {
      supabase.removeChannel(chan);
    };
  }, [code, user?.id, displayName]);

  // auto scroll
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !user) return;
    setSending(true);
    setError(null);
    const optimistic = text;
    setText("");
    try {
      // Direct insert (RLS-scoped to auth.uid()) — works on any host without
      // relying on the server-function bearer round trip.
      const { error: insertError } = await supabase.from("party_messages").insert({
        room_code: code,
        user_id: user.id,
        display_name: displayName,
        body,
      });
      if (insertError) throw new Error(insertError.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[party chat] send failed:", message);
      setError(message);
      setText(optimistic);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 backdrop-blur ${
        compact ? "h-[min(70vh,420px)]" : "h-[min(80vh,520px)]"
      }`}
      style={{ ["--accent-hex" as never]: "#00D8FF", ["--accent-rgb" as never]: "0 216 255" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Party</div>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-wider">{code}</span>
            <button
              onClick={copyCode}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/10"
              type="button"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-300">
          <Users className="h-3.5 w-3.5" />
          {presence || 1}
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-xs text-neutral-500">
            Say hi. Chat, presence, and host episode changes sync live.<br />
            Playback frames are not synced (cross-origin player).
          </div>
        )}
        {messages.map((m) => {
          const own = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                {!own && (
                  <div className="mb-0.5 text-[10px] uppercase tracking-widest text-neutral-500">
                    {m.display_name}
                  </div>
                )}
                <div
                  className="rounded-2xl px-3 py-2 text-sm break-words"
                  style={
                    own
                      ? { background: "var(--accent-hex, #00D8FF)", color: "#001018" }
                      : { background: "rgba(255,255,255,0.06)", color: "#F5F7FA" }
                  }
                >
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-white/10 p-2">
        {error && (
          <div className="mb-2 flex items-start gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11px] leading-relaxed text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">Chat error: {error}</span>
          </div>
        )}
        {!user ? (
          <div className="grid h-11 place-items-center px-2 text-center text-xs text-neutral-500">
            Sign in to chat
          </div>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message the party…"
              maxLength={500}
              enterKeyHint="send"
              autoComplete="off"
              aria-label="Chat message"
              // 16px min font-size stops iOS Safari from zooming on focus.
              className="min-w-0 flex-1 select-text rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-base outline-none focus:border-white/20 sm:text-sm"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-black transition disabled:opacity-40"
              style={{ background: "var(--accent-hex, #00D8FF)" }}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}