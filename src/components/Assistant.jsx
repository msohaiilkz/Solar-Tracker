import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { answer, SUGGESTIONS } from "../lib/assistant.js";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";
import { derive } from "../lib/derived.js";
import { modelDayGain, trackerVsFixed } from "../lib/energy.js";
import { siteNow } from "../lib/sun.js";
import { insights } from "../lib/insights.js";
import { panelHealth } from "../lib/health.js";

/* **bold** → <b> */
function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? <b key={i} className="font-semibold text-ink">{part.slice(2, -2)}</b> : <span key={i}>{part}</span>);
}

function Typed({ text, onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(text.length); onDone?.(); return; }
    let k = 0;
    const t = setInterval(() => {
      k = Math.min(text.length, k + 3);
      setN(k);
      if (k >= text.length) { clearInterval(t); onDone?.(); }
    }, 16);
    return () => clearInterval(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Rich text={text.slice(0, n)} />;
}

export default function Assistant({ onTour }) {
  const { cfg, live, history, control, kind } = useTelemetry();
  const { status, age } = useDeviceStatus();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [thinking, setThinking] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const ctx = useMemo(() => {
    const d = derive(live, cfg);
    const doy = live?.doy ?? siteNow(cfg.site, new Date()).doy;
    const cmp = trackerVsFixed(history, cfg);
    return {
      cfg, live, d, control, kind, status, age, t: live?.t || {},
      peak: history.reduce((m, r) => Math.max(m, (r.t.power_mw ?? 0) / 1000), 0),
      gain: modelDayGain(cfg, doy), sessionGain: cmp.gain,
      insights: insights(history, cfg), health: panelHealth(history).pct
    };
  }, [cfg, live, history, control, kind, status, age]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, thinking]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120); }, [open]);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("open-assistant", on);
    return () => window.removeEventListener("open-assistant", on);
  }, []);

  const ask = q => {
    const text = q.trim();
    if (!text || thinking) return;
    setInput("");
    setMsgs(m => [...m, { from: "me", text }]);
    setThinking(true);
    setTimeout(() => {
      const r = answer(text, ctx);
      setMsgs(m => [...m, { from: "bot", ...r, typing: true }]);
      setThinking(false);
    }, 450 + Math.random() * 350);
  };

  const go = target => {
    if (target === "#tour") { setOpen(false); onTour?.(); return; }
    window.location.hash = `#/${target}`;
    if (window.innerWidth < 640) setOpen(false);
  };

  return (
    <>
      {/* launcher */}
      <button data-tour="assistant" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Ask the Sunflower assistant"
        className="group fixed bottom-4 right-4 z-[75] flex h-12 items-center gap-2 rounded-full bg-primary pl-3.5 pr-4 text-[13.5px] font-medium text-on-primary shadow-xl shadow-black/20 transition-transform duration-300 hover:-translate-y-0.5 active:scale-95 print:hidden">
        <span className="relative grid size-6 place-items-center">
          {!open && <span className="ping absolute inset-0 rounded-full bg-sun/60" />}
          <span className="relative grid size-6 place-items-center rounded-full bg-sun text-[#141412]"><Icon name={open ? "close" : "sun"} className="size-3.5" strokeWidth={2.4} /></span>
        </span>
        <span className="hidden sm:inline">{open ? "Close" : "Ask Sunflower"}</span>
      </button>

      {open && (
        <section role="dialog" aria-label="Sunflower assistant"
          className="pop-in fixed bottom-20 right-4 z-[75] flex h-[min(560px,calc(100dvh-110px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/25 print:hidden">
          <header className="relative flex items-center gap-3 overflow-hidden border-b border-line px-4 py-3.5">
            <div className="hdr-glow pointer-events-none absolute -right-16 -top-20 size-48 rounded-full" aria-hidden="true" />
            <span className="relative grid size-9 place-items-center rounded-xl bg-[#141412] text-sun"><Icon name="sun" className="size-[18px]" strokeWidth={2.2} /></span>
            <div className="relative min-w-0">
              <div className="text-[14.5px] font-semibold">Sunflower Assistant</div>
              <div className="text-[11.5px] text-muted">Answers from project data and live readings</div>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="fade-in">
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                  Salam! Ask me anything about the tracker, in English or Roman Urdu. For example:
                </p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`fade-in flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.from === "me" ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md border border-line bg-subtle/70 text-ink-2"}`}>
                  {m.from === "bot" && m.typing
                    ? <Typed text={m.text} onDone={() => setMsgs(all => all.map((x, k) => (k === i ? { ...x, typing: false } : x)))} />
                    : <Rich text={m.text} />}
                  {m.from === "bot" && !m.typing && m.action && (
                    <button onClick={() => go(m.action[1])} className="mt-2.5 flex items-center gap-1 text-[12.5px] font-medium text-s1 hover:underline">
                      {m.action[0]} <Icon name="chevronRight" className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start" aria-label="Assistant is typing">
                <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line bg-subtle/70 px-3.5 py-3">
                  {[0, 1, 2].map(k => <span key={k} className="typing-dot size-1.5 rounded-full bg-muted" style={{ animationDelay: `${k * 0.15}s` }} />)}
                </div>
              </div>
            )}
            {(msgs.length === 0 || msgs[msgs.length - 1]?.suggest) && !thinking && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => ask(s)}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-sun/60 hover:text-ink">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-line p-3">
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about the tracker…"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-s1 focus:ring-3 focus:ring-s1/15" />
            <button type="submit" disabled={!input.trim() || thinking} aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun text-[#141412] transition-transform active:scale-95 disabled:opacity-40">
              <Icon name="arrowUpRight" className="size-[18px] rotate-45" strokeWidth={2.2} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
