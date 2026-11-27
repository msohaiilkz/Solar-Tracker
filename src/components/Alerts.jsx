import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { Status } from "./ui.jsx";
import { useAlerts } from "../hooks/useAlerts.jsx";
import { useNow } from "../hooks/useTelemetry.jsx";

const ICON = { good: "check", warn: "alert", crit: "alert", info: "info" };
const TINT = {
  good: "bg-good/12 text-good-ink",
  warn: "bg-warn/15 text-warn-ink",
  crit: "bg-crit/12 text-crit-ink",
  info: "bg-s1/12 text-s1"
};

function since(at, now) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AlertsBell() {
  const a = useAlerts();
  const now = useNow(15000);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!e.target.closest?.("[data-bell]")) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = () => { setOpen(v => !v); if (!open) setTimeout(a.markAllRead, 1200); };

  return (
    <div className="relative" data-bell>
      <button onClick={toggle} aria-expanded={open} aria-label={`Alerts${a.unread ? `, ${a.unread} new` : ""}`}
        className="btn btn-quiet relative size-8 rounded-lg px-0">
        <Icon name="bell" className="size-[17px]" />
        {a.unread > 0 && (
          <span className="pop-in absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full bg-crit px-1 text-[9.5px] font-semibold leading-[15px] text-white ring-2 ring-page">
            {a.unread > 9 ? "9+" : a.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="pop-in fixed inset-x-3 top-[60px] z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/15 sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-[340px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold">Alerts</span>
            <span className="flex items-center gap-3">
              <button onClick={a.toggleSound} aria-pressed={a.sound} title={a.sound ? "Sound on" : "Sound off"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] transition-colors ${a.sound ? "border-sun/40 bg-sun/10 text-sun-ink" : "border-line text-muted hover:text-ink"}`}>
                <Icon name={a.sound ? "volume" : "volumeOff"} className="size-3.5" />{a.sound ? "Sound on" : "Muted"}
              </button>
              {a.items.length > 0 && <button onClick={a.clear} className="text-[12.5px] text-muted hover:text-ink">Clear all</button>}
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {a.items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-subtle text-muted"><Icon name="bell" className="size-[18px]" /></span>
                <p className="mt-3 text-[13.5px] font-medium">All quiet</p>
                <p className="mt-0.5 text-[12.5px] text-muted">Offline device, emergency stop and a hot panel show up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {a.items.map(i => (
                  <li key={i.id} className={`flex gap-3 px-4 py-3 ${i.read ? "" : "bg-subtle/60"}`}>
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${TINT[i.tone]}`}><Icon name={ICON[i.tone]} className="size-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13.5px] font-medium">{i.title}</span>
                        <span className="shrink-0 text-[11.5px] text-muted">{since(i.at, now)}</span>
                      </div>
                      {i.body && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{i.body}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line bg-subtle/50 px-4 py-2.5">
            {a.permission === "default" && <button onClick={a.requestPermission} className="text-[12.5px] font-medium text-s1 hover:underline">Turn on phone / desktop notifications</button>}
            {a.permission === "granted" && <Status tone="good" className="text-[12.5px]">System notifications on</Status>}
            {a.permission === "denied" && <span className="text-[12px] text-muted">Notifications are blocked in browser settings</span>}
            {a.permission === "unsupported" && <span className="text-[12px] text-muted">This browser cannot show notifications</span>}
            <button onClick={a.test} className="ml-auto text-[12.5px] text-muted hover:text-ink">Test</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useAlerts();
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[80] flex w-[340px] max-w-[calc(100vw-32px)] flex-col gap-2 print:hidden" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="pop-in pointer-events-auto flex gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-xl shadow-black/10">
          <span className={`grid size-7 shrink-0 place-items-center rounded-full ${TINT[t.tone]}`}><Icon name={ICON[t.tone]} className="size-3.5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-medium">{t.title}</div>
            {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{t.body}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-hover hover:text-ink">
            <Icon name="close" className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
