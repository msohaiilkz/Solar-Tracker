/* Guided tour: highlights one part of the app at a time and explains it.
   Starts by itself on the first visit; can be restarted from the help button or Ctrl+K. */
import { useCallback, useEffect, useState } from "react";
import Icon from "./Icon.jsx";

export const TOUR_STEPS = [
  { route: "overview", target: null, title: "Welcome to Sunflower", text: "A quick tour of the dashboard. It takes about a minute. Use the arrow keys or the buttons below." },
  { route: "overview", target: "nav", title: "Pages", text: "Monitor pages show the readings. Operate pages let a signed-in operator move the panel. Project pages explain the work." },
  { route: "overview", target: "status", title: "Connection", text: "Live means fresh readings are arriving. Offline means nothing has come in for 60 seconds. Demo means the built-in simulator is running." },
  { route: "overview", target: "today", title: "Today's sun", text: "The yellow arc is the sun's path today. The blue panel tilts toward it in real time, so you can see the tracker doing its job." },
  { route: "overview", target: "power", title: "Power output", text: "What the panel is producing right now, in watts. The small line under it shows voltage × current." },
  { route: "overview", target: "gain", title: "Why tracking matters", text: "Energy collected compared with the same panel fixed at 25° facing south. This is the main result of the project." },
  { route: "control", target: "mode", title: "Automatic or manual", text: "Automatic lets the light sensors steer. Manual unlocks the arrow buttons. Only a signed-in operator can switch." },
  { route: "control", target: "estop", title: "Emergency stop", text: "Cuts power to both motors at once. Use it if anything looks wrong. Release it to resume tracking." },
  { route: "analytics", target: "export", title: "Export for your report", text: "Export downloads every reading for Excel (CSV), or as JSON for developers. The Report button prints a clean PDF page." },
  { route: "analytics", target: "guide", title: "Need this again?", text: "The Guide button replays this tour any time." },
  { route: "analytics", target: "search", title: "Search anything", text: "Press Ctrl + K to jump to any page, switch the theme, export data or restart this tour." },
  { route: "analytics", target: "assistant", title: "Ask the assistant", text: "Have a question about the project or the live readings? Ask here, in English or Roman Urdu." }
];

const visible = el => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

function findTarget(id) {
  if (!id) return null;
  const els = [...document.querySelectorAll(`[data-tour="${id}"]`)];
  return els.find(visible) || null;
}

export default function Tour({ open, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = TOUR_STEPS[i];

  const finish = useCallback(() => {
    try { localStorage.setItem("tour-done", "1"); } catch { /* ignore */ }
    onClose();
  }, [onClose]);

  /* move to the step's page, wait for its element, then measure it */
  useEffect(() => {
    if (!open) return;
    setRect(null);
    if (step.route && !window.location.hash.startsWith(`#/${step.route}`)) window.location.hash = `#/${step.route}`;
    let tries = 0, timer;
    const look = () => {
      const el = findTarget(step.target);
      if (step.target && !el && tries++ < 25) { timer = setTimeout(look, 120); return; }
      if (step.target && !el) { setRect("missing"); return; }
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => setRect(el.getBoundingClientRect()), 380);
      } else setRect("center");
    };
    timer = setTimeout(look, 150);
    return () => clearTimeout(timer);
  }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps

  /* skip steps whose element does not exist on this screen (e.g. sidebar on phones) */
  useEffect(() => {
    if (rect === "missing") setI(v => Math.min(TOUR_STEPS.length - 1, v + 1));
  }, [rect]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") setI(v => (v < TOUR_STEPS.length - 1 ? v + 1 : (finish(), v)));
      if (e.key === "ArrowLeft") setI(v => Math.max(0, v - 1));
    };
    const onResize = () => { const el = findTarget(step.target); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, [open, step, finish]);

  useEffect(() => { if (open) setI(0); }, [open]);

  if (!open) return null;

  const pad = 8;
  const box = rect && typeof rect === "object" ? {
    left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2
  } : null;

  /* place the card next to the highlighted box, inside the screen */
  const W = Math.min(360, window.innerWidth - 24);
  let card = { left: (window.innerWidth - W) / 2, top: window.innerHeight / 2 - 110 };
  if (box) {
    const below = box.top + box.height + 14, above = box.top - 14;
    const left = Math.min(Math.max(12, box.left), window.innerWidth - W - 12);
    card = window.innerHeight - below > 230 ? { left, top: below } : { left, top: Math.max(12, above - 220) };
    if (box.width < 200 && box.left > window.innerWidth / 2) card.left = Math.max(12, box.left + box.width - W);
  }
  const last = i === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[95] print:hidden" role="dialog" aria-modal="true" aria-label="Guided tour">
      {box ? (
        <div className="pointer-events-none absolute rounded-xl ring-2 ring-sun transition-all duration-500 ease-out-soft"
          style={{ ...box, boxShadow: "0 0 0 9999px rgb(0 0 0 / .55)" }} />
      ) : <div className="absolute inset-0 bg-black/55 fade-in" />}
      <div className="absolute inset-0" onClick={finish} />

      {rect && (
        <div key={i} className="pop-in absolute rounded-2xl border border-line bg-surface p-5 shadow-2xl shadow-black/30" style={{ ...card, width: W }}>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-sun-ink"><Icon name="sun" className="size-3.5" />Step {i + 1} of {TOUR_STEPS.length}</span>
            <button onClick={finish} className="text-[12.5px] text-muted hover:text-ink">Skip tour</button>
          </div>
          <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.01em]">{step.title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{step.text}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1" aria-hidden="true">
              {TOUR_STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-sun" : k < i ? "w-1.5 bg-ink-2" : "w-1.5 bg-line-strong"}`} />)}
            </div>
            <div className="flex gap-2">
              {i > 0 && <button onClick={() => setI(i - 1)} className="btn btn-secondary h-8 px-3">Back</button>}
              <button onClick={() => (last ? finish() : setI(i + 1))} className="btn btn-primary h-8 px-3.5">{last ? "Done" : "Next"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
