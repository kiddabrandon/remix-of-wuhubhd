import { useEffect, useMemo, useRef, useState } from "react";
import { Users, Copy, Send, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-store";
import { useServerFn } from "@tanstack/react-start";
import { postPartyMessage } from "@/lib/party.functions";

type Message = {
  id: string;
  room_code: string;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

export function PartyPanel({ code }: { code: string }) {
  const { session } = useApp();
  const user = session?.user ?? null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [presence, setPresence] = useState(0);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const post = useServerFn(postPartyMessage);
  const displayName = useMemo(
    () => user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest",
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
    const optimistic = text;
    setText("");
    try {
      await post({ data: { code, body, display_name: displayName } });
    } catch (err) {
      console.error(err);
      setText(optimistic);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="flex h-[520px] flex-col rounded-2xl border border-white/10 bg-neutral-950/80 backdrop-blur"
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

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
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
                  className="rounded-2xl px-3 py-2 text-sm"
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

      <div className="border-t border-white/10 p-2">
        {!user ? (
          <div className="grid h-11 place-items-center text-xs text-neutral-500">
            Sign in to chat
          </div>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message the party…"
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm outline-none focus:border-white/20"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="grid h-9 w-9 place-items-center rounded-full text-black transition disabled:opacity-40"
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