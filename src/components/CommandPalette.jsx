import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { useTelemetry } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";
import { exportCsv, exportJson } from "../lib/exporters.js";
import { printReport } from "../lib/print.js";

export default function CommandPalette({ open, onClose, nav, onToggleSidebar, onLogin, onTour }) {
  const { cfg, history, kind, user, auth } = useTelemetry();
  const theme = useTheme();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const actions = useMemo(() => {
    const go = id => () => { window.location.hash = `#/${id}`; };
    const list = [
      ...nav.map(n => ({ group: "Go to", label: n.label, icon: n.icon, run: go(n.id), keys: n.id })),
      { group: "Actions", label: theme.theme === "dark" ? "Switch to light theme" : "Switch to dark theme", icon: theme.theme === "dark" ? "sun" : "moon", run: () => theme.toggle(), keys: "theme dark light mode" },
      { group: "Actions", label: "Toggle sidebar", icon: "sidebar", run: onToggleSidebar, keys: "collapse expand menu" },
      { group: "Help", label: "Start the guided tour", icon: "info", run: onTour, keys: "help guide tour how to use" },
      { group: "Help", label: "Ask the assistant", icon: "sun", run: () => window.dispatchEvent(new Event("open-assistant")), keys: "chat ai question help ask" },
      { group: "Actions", label: "Download readings as CSV", icon: "download", run: () => exportCsv(history, cfg.deviceId), keys: "export excel csv", disabled: !history.length },
      { group: "Actions", label: "Download readings as JSON", icon: "download", run: () => exportJson(history, cfg.deviceId), keys: "export json", disabled: !history.length },
      { group: "Actions", label: "Print report", icon: "printer", run: () => { window.location.hash = "#/analytics"; setTimeout(() => printReport(theme), 500); }, keys: "pdf print report" }
    ];
    if (kind === "firebase") {
      list.push(user
        ? { group: "Account", label: "Sign out", icon: "logout", run: () => auth.logout(), keys: "logout" }
        : { group: "Account", label: "Sign in as operator", icon: "lock", run: onLogin, keys: "login" });
    }
    return list.filter(a => !a.disabled);
  }, [nav, theme, onToggleSidebar, history, cfg.deviceId, kind, user, auth, onLogin, onTour]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return actions;
    return actions.filter(a => `${a.label} ${a.keys}`.toLowerCase().includes(s));
  }, [q, actions]);

  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  if (!open) return null;

  const run = a => { onClose(); setTimeout(a.run, 10); };
  const onKey = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(i => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && shown[sel]) { e.preventDefault(); run(shown[sel]); }
    else if (e.key === "Escape") onClose();
  };

  let lastGroup = null;
  return (
    <div className="fade-in fixed inset-0 z-[70] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="pop-in w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/25">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" className="size-[18px] text-muted" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Type a command or page…" aria-label="Search commands"
            className="h-13 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" />
          <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10.5px] text-muted">Esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-[340px] overflow-y-auto p-2" role="listbox">
          {shown.length === 0 && <li className="px-3 py-8 text-center text-[13.5px] text-muted">Nothing matches “{q}”.</li>}
          {shown.map((a, i) => {
            const head = a.group !== lastGroup ? a.group : null;
            lastGroup = a.group;
            return (
              <li key={a.label}>
                {head && <div className="px-3 pb-1 pt-2.5 text-[11.5px] font-medium text-muted">{head}</div>}
                <button data-i={i} role="option" aria-selected={i === sel} onMouseMove={() => setSel(i)} onClick={() => run(a)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] ${i === sel ? "bg-hover text-ink" : "text-ink-2"}`}>
                  <Icon name={a.icon} className="size-[17px] text-muted" />
                  <span className="flex-1">{a.label}</span>
                  {i === sel && <Icon name="enter" className="size-4 text-muted" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-4 border-t border-line bg-subtle/50 px-4 py-2 text-[11.5px] text-muted">
          <span><kbd className="font-mono">↑↓</kbd> move</span>
          <span><kbd className="font-mono">Enter</kbd> run</span>
          <span className="ml-auto">Sunflower</span>
        </div>
      </div>
    </div>
  );
}
