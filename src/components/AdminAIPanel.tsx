import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Bot, Lightbulb, Loader2, Send, Sparkles, Stethoscope } from "lucide-react";
import { adminChat, adminDiagnose, adminInsights, adminSuggestUpdates } from "@/lib/admin-ai.functions";

type Msg = { role: "user" | "assistant"; content: string };

export function AdminAIPanel() {
  const chatFn = useServerFn(adminChat);
  const diagFn = useServerFn(adminDiagnose);
  const insightsFn = useServerFn(adminInsights);
  const suggestFn = useServerFn(adminSuggestUpdates);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your site engineer. I can diagnose recent errors, explain how the codebase works, and suggest updates. I won't change code unless you tell me to.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [diag, setDiag] = useState<{ report: string; errors24h: number; offlineProviders: number } | null>(null);
  const [insights, setInsights] = useState<{ brief: string; aggregates: any } | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [suggest, setSuggest] = useState<string | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (withDiagnostics = false) => {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await chatFn({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          includeDiagnostics: withDiagnostics,
        },
      });
      setMessages([...next, { role: "assistant", content: reply || "(empty response)" }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  const runDiagnose = async () => {
    setDiagBusy(true);
    setErr(null);
    try {
      const r = await diagFn();
      setDiag(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Diagnose failed");
    } finally {
      setDiagBusy(false);
    }
  };

  const runInsights = async () => {
    setInsightsBusy(true);
    setErr(null);
    try {
      setInsights(await insightsFn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Insights failed");
    } finally {
      setInsightsBusy(false);
    }
  };

  const runSuggest = async () => {
    setSuggestBusy(true);
    setErr(null);
    try {
      const { suggestions } = await suggestFn();
      setSuggest(suggestions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setSuggestBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/5 bg-[#0b0b0c] p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-400/10 ring-1 ring-cyan-400/30">
            <Bot className="h-4 w-4 text-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-semibold">Site AI assistant</div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">
              Diagnostics · Insights · Update ideas · Chat
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runDiagnose}
            disabled={diagBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] hover:bg-white/10 disabled:opacity-50"
          >
            {diagBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Stethoscope className="h-3 w-3" />}
            Diagnose
          </button>
          <button
            onClick={runInsights}
            disabled={insightsBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] hover:bg-white/10 disabled:opacity-50"
          >
            {insightsBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
            Insights
          </button>
          <button
            onClick={runSuggest}
            disabled={suggestBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] hover:bg-white/10 disabled:opacity-50"
          >
            {suggestBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
            Suggest updates
          </button>
        </div>
      </div>

      {diag && (
        <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-neutral-200">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-cyan-300">
            <Sparkles className="h-3 w-3" /> Latest report
            <span className="text-neutral-500">
              · {diag.errors24h} errors 24h · {diag.offlineProviders} providers offline
            </span>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">{diag.report}</div>
        </div>
      )}

      {insights && (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-neutral-200">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-300">
            <BarChart3 className="h-3 w-3" /> Anonymous insights (7d)
            <span className="text-neutral-500">
              · {insights.aggregates?.progress7d?.uniqueUsers ?? 0} active · {insights.aggregates?.progress7d?.finished ?? 0} finishes · {insights.aggregates?.partyRooms7d ?? 0} party rooms
            </span>
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">{insights.brief}</div>
        </div>
      )}

      {suggest && (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-neutral-200">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-amber-300">
            <Lightbulb className="h-3 w-3" /> Suggested updates
          </div>
          <div className="whitespace-pre-wrap leading-relaxed">{suggest}</div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="mt-4 max-h-[400px] min-h-[220px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-400 px-3 py-2 text-xs text-black"
                  : "max-w-[92%] whitespace-pre-wrap text-xs leading-relaxed text-neutral-200"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {err && (
        <div className="mt-2 rounded border border-amber-400/30 bg-amber-400/10 p-2 text-[11px] text-amber-200">
          {err}. Make sure you're signed in as an admin.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(false);
        }}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about errors, code, or improvements…"
          className="flex-1 rounded-full border border-white/10 bg-black px-3 py-2 text-xs outline-none focus:border-cyan-400/50"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => send(true)}
            disabled={busy || !input.trim()}
            title="Send with live error/health context"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] hover:bg-white/10 disabled:opacity-50"
          >
            <Stethoscope className="h-3 w-3" /> +Ctx
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
          >
            <Send className="h-3 w-3" /> Send
          </button>
        </div>
      </form>
    </section>
  );
}
