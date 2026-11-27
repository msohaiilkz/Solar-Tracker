import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { Status } from "./ui.jsx";
import { AlertsBell } from "./Alerts.jsx";
import CommandPalette from "./CommandPalette.jsx";
import { PageCtx } from "../hooks/usePage.js";
import Tour from "./Tour.jsx";
import Assistant from "./Assistant.jsx";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";

export const NAV = [
  { id: "overview", label: "Overview", icon: "grid", group: "Monitor" },
  { id: "telemetry", label: "Telemetry", icon: "activity", group: "Monitor" },
  { id: "tracking", label: "Sun tracking", icon: "compass", group: "Monitor" },
  { id: "analytics", label: "Analytics", icon: "chart", group: "Monitor" },
  { id: "control", label: "Control", icon: "sliders", group: "Operate" },
  { id: "system", label: "System", icon: "server", group: "Operate" },
  { id: "about", label: "About", icon: "info", group: "Project" },
  { id: "home", label: "Intro", icon: "sun", group: "Project" }
];
const GROUPS = ["Monitor", "Operate", "Project"];
const WIDE = 244, NARROW = 64;

const readFlag = k => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const KEY = `${isMac ? "⌘" : "Ctrl"} B`;

function ago(age) {
  if (age == null) return "no data yet";
  if (age < 5) return "just now";
  if (age < 60) return `${Math.round(age)}s ago`;
  if (age < 3600) return `${Math.round(age / 60)} min ago`;
  return `${Math.round(age / 3600)} h ago`;
}

function useStatusInfo() {
  const { kind, live } = useTelemetry();
  const { status, age } = useDeviceStatus();
  return {
    status,
    tone: { demo: "warn", online: "good", offline: "crit", waiting: "idle" }[status],
    label: { demo: "Demo", online: "Live", offline: "Offline", waiting: "Waiting" }[status],
    long: { demo: "Simulator running", online: "Device connected", offline: "No signal", waiting: "Waiting for device" }[status],
    when: kind === "demo" ? (live ? `sim ${live.label}` : "") : ago(age),
    pulse: status === "online" || status === "demo"
  };
}

function Logo() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#141412] text-sun shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)]">
      <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
        <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" />
      </svg>
    </span>
  );
}

/* Text that fades out when the sidebar is narrow */
function Fade({ hidden, children, className = "" }) {
  return (
    <span className={`min-w-0 overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300 ease-out-soft ${hidden ? "max-w-0 opacity-0" : "max-w-[190px] opacity-100"} ${className}`}>
      {children}
    </span>
  );
}

function Tip({ show, children }) {
  if (!show) return null;
  return (
    <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[12px] font-medium text-on-primary opacity-0 shadow-lg transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100">
      {children}
    </span>
  );
}

function Sidebar({ route, narrow, onNavigate }) {
  const { cfg } = useTelemetry();
  const st = useStatusInfo();

  return (
    <div className="flex h-full flex-col pt-2">
      <div className="flex h-14 items-center px-4">
        <a href="#/overview" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5" aria-label={`${cfg.project.name} home`}>
          <Logo />
          <Fade hidden={narrow} className="leading-none">
            <span className="block text-[14.5px] font-semibold tracking-[-0.01em]">Sunflower</span>
            <span className="mt-[5px] block text-[11.5px] text-muted">Solar tracker · FYP</span>
          </Fade>
        </a>
      </div>

      <nav aria-label="Main" data-tour="nav" className="mt-3 flex-1 space-y-6 px-2.5">
        {GROUPS.map(g => (
          <div key={g}>
            <div className={`mb-1.5 px-[13px] text-[11px] font-medium uppercase tracking-[0.08em] text-muted transition-opacity duration-200 ${narrow ? "opacity-0" : ""}`}>{g}</div>
            <ul className="space-y-0.5">
              {NAV.filter(n => n.group === g).map(n => {
                const on = n.id === route;
                return (
                  <li key={n.id} className="group relative">
                    <a href={`#/${n.id}`} onClick={onNavigate} aria-current={on ? "page" : undefined} aria-label={narrow ? n.label : undefined}
                      className={`flex h-9 items-center gap-3 overflow-hidden rounded-[9px] px-[13px] text-[13.5px] transition-[background-color,color,box-shadow] duration-150 ${on
                        ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/.06),0_0_0_1px_var(--line)]"
                        : "text-ink-2 hover:bg-black/[.04] hover:text-ink dark:hover:bg-white/[.05]"}`}>
                      <Icon name={n.icon} className={`size-[18px] shrink-0 transition-colors ${on ? "text-ink" : "text-muted group-hover:text-ink-2"}`} />
                      <Fade hidden={narrow}>{n.label}</Fade>
                    </a>
                    <Tip show={narrow}>{n.label}</Tip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-2.5">
        <div className={`group relative rounded-xl transition-colors ${narrow ? "grid h-10 place-items-center" : "bg-surface p-3 shadow-[0_1px_2px_rgb(0_0_0/.05),0_0_0_1px_var(--line)]"}`}>
          {narrow ? <Status tone={st.tone} live={st.pulse} /> : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Status tone={st.tone} live={st.pulse}>{st.long}</Status>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-muted">
                <span className="truncate font-mono">{cfg.deviceId}</span>
                <span className="shrink-0 num">{st.when}</span>
              </div>
            </>
          )}
          <Tip show={narrow}>{st.long}</Tip>
        </div>
      </div>
    </div>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}
      className="btn btn-quiet size-8 rounded-lg px-0">
      <span className="relative size-[17px]">
        <Icon name="sun" className={`absolute inset-0 size-[17px] transition-all duration-500 ${dark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"}`} />
        <Icon name="moon" className={`absolute inset-0 size-[17px] transition-all duration-500 ${dark ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      </span>
    </button>
  );
}

function Account({ onLogin }) {
  const { kind, user, auth } = useTelemetry();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!e.target.closest?.("[data-account]")) setOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  if (kind !== "firebase" || user === undefined) return null;
  if (!user) return <button className="btn btn-primary h-8 rounded-lg px-3 text-[13px]" onClick={onLogin}>Sign in</button>;
  return (
    <div className="relative" data-account>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label="Account"
        className="grid size-8 place-items-center rounded-full bg-gradient-to-b from-[#3a3935] to-[#141412] text-[12.5px] font-semibold text-white ring-2 ring-page">
        {(user.email || "U")[0].toUpperCase()}
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-10 z-50 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/10">
          <div className="px-3 pb-2.5 pt-2">
            <div className="text-[12px] text-muted">Signed in as operator</div>
            <div className="truncate text-[13.5px] font-medium">{user.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <button onClick={() => { setOpen(false); auth.logout(); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-ink-2 hover:bg-hover hover:text-ink">
            <Icon name="logout" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function StatusPill() {
  const st = useStatusInfo();
  return (
    <span data-tour="status" className="hidden h-8 items-center gap-2.5 rounded-lg border border-line bg-surface pl-2.5 pr-3 text-[12.5px] sm:inline-flex">
      <Status tone={st.tone} live={st.pulse}>{st.label}</Status>
      {st.when && <span className="text-muted num">{st.when}</span>}
    </span>
  );
}

/* Switch between the real device and the built-in simulator (keeps the current page) */
function switchMode(demo) {
  const u = new URL(window.location.href);
  if (demo) { u.searchParams.set("demo", ""); u.searchParams.delete("live"); }
  else u.searchParams.delete("demo");
  window.location.href = u.toString().replace("demo=&", "demo&").replace(/demo=$/, "demo").replace("demo=#", "demo#");
}

export default function Shell({ route, onLogin, children }) {
  const { kind, configured } = useTelemetry();
  const st = useStatusInfo();
  const [drawer, setDrawer] = useState(false);
  const [narrow, setNarrow] = useState(() => readFlag("sidebar-collapsed"));
  const [demoNote, setDemoNote] = useState(true);
  const [palette, setPalette] = useState(false);
  const [tour, setTour] = useState(false);

  /* first visit: offer the guided tour */
  useEffect(() => {
    let done = false;
    try { done = localStorage.getItem("tour-done") === "1"; } catch { /* ignore */ }
    if (done) return;
    const t = setTimeout(() => setTour(true), 1600);
    return () => clearTimeout(t);
  }, []);
  const current = NAV.find(n => n.id === route) || NAV[0];

  /* move the soft light on the card under the pointer */
  const lastPanel = useRef(null);
  const spotlight = e => {
    const p = e.type === "pointerleave" ? null : e.target.closest?.(".panel");
    const prev = lastPanel.current;
    if (prev && prev !== p) { prev.style.removeProperty("--mx"); prev.style.removeProperty("--my"); }
    lastPanel.current = p;
    if (!p) return;
    const r = p.getBoundingClientRect();
    p.style.setProperty("--mx", `${e.clientX - r.left}px`);
    p.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const toggle = () => {
    if (window.innerWidth < 1024) { setDrawer(v => !v); return; }
    setNarrow(v => {
      try { localStorage.setItem("sidebar-collapsed", v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  };

  useEffect(() => { setDrawer(false); }, [route]);
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") setDrawer(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggle(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(v => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-shell transition-[padding] duration-300 ease-out-soft lg:pl-(--sb) print:!pl-0 print:bg-white" style={{ "--sb": `${narrow ? NARROW : WIDE}px` }}>
      {/* Desktop sidebar: sits on the shell colour, no border */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-(--sb) transition-[width] duration-300 ease-out-soft lg:block print:!hidden">
        <Sidebar route={route} narrow={narrow} />
      </aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden print:hidden ${drawer ? "" : "pointer-events-none"}`} aria-hidden={!drawer}>
        <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${drawer ? "opacity-100" : "opacity-0"}`} onClick={() => setDrawer(false)} />
        <aside className={`absolute inset-y-0 left-0 w-[272px] bg-shell shadow-2xl transition-transform duration-300 ease-out-soft ${drawer ? "translate-x-0" : "-translate-x-full"}`}>
          <Sidebar route={route} narrow={false} onNavigate={() => setDrawer(false)} />
        </aside>
      </div>

      {/* Content sheet */}
      <div className="lg:py-2 lg:pr-2 print:!p-0">
        <div id="scroller" onPointerMove={spotlight} onPointerLeave={spotlight} className="scroller relative h-dvh overflow-y-auto bg-page lg:h-[calc(100dvh-16px)] lg:rounded-[14px] lg:shadow-[0_0_0_1px_var(--line),0_1px_3px_rgb(0_0_0/.04)]">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-1.5 border-b border-line bg-page/80 px-3 backdrop-blur-md sm:px-4 print:hidden">
            <div className="group relative">
              <button className="btn btn-quiet size-8 rounded-lg px-0" onClick={toggle} aria-label="Toggle sidebar">
                <Icon name="sidebar" className="size-[17px]" />
              </button>
              <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[12px] text-on-primary opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                Toggle sidebar <span className="ml-1 opacity-60">{KEY}</span>
              </span>
            </div>
            <span className="mx-1.5 h-4 w-px bg-line-strong" />
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
              <span className="hidden text-muted sm:inline">Sunflower</span>
              <Icon name="chevronRight" className="hidden size-3.5 text-muted/70 sm:block" />
              <span key={current.id} className="fade-in truncate font-medium">{current.label}</span>
            </nav>
            <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
              <button data-tour="search" onClick={() => setPalette(true)} aria-label="Search and commands"
                className="mr-1 hidden h-8 items-center gap-2 rounded-lg border border-line bg-surface pl-2.5 pr-1.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-ink-2 md:inline-flex">
                <Icon name="search" className="size-3.5" />
                <span className="pr-6">Search…</span>
                <kbd className="rounded border border-line bg-subtle px-1.5 py-px font-mono text-[10.5px]">{isMac ? "⌘" : "Ctrl"} K</kbd>
              </button>
              <button onClick={() => setPalette(true)} aria-label="Search and commands" className="btn btn-quiet size-8 rounded-lg px-0 md:hidden">
                <Icon name="search" className="size-[17px]" />
              </button>
              <span className="sm:hidden"><Status tone={st.tone} live={st.pulse}>{st.label}</Status></span>
              <StatusPill />
              <button data-tour="guide" onClick={() => setTour(true)} aria-label="Open the guide: a short tour of the dashboard" title="How to use this dashboard"
                className="btn btn-secondary hidden h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] sm:inline-flex">
                <Icon name="book" className="size-4" /><span className="hidden lg:inline">Guide</span>
              </button>
              <span data-tour="bell"><AlertsBell /></span>
              <span data-tour="theme"><ThemeToggle /></span>
              <Account onLogin={onLogin} />
            </div>
          </header>

          <main id="main" className="mx-auto max-w-[1360px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10">
            {kind === "demo" && demoNote && route !== "about" && (
              <div className="fade-in mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-warn/25 bg-warn-bg py-2 pl-3.5 pr-1.5 text-[13px] text-warn-ink print:hidden">
                <span className="size-1.5 shrink-0 rounded-full bg-warn" />
                <span className="min-w-0 flex-1"><span className="font-medium">Demo mode</span> · readings come from a built-in simulator, not the hardware.</span>
                {configured && <button onClick={() => switchMode(false)} className="btn h-7 rounded-md bg-warn/20 px-2.5 text-[12.5px] text-warn-ink hover:bg-warn/30">Back to live</button>}
                <button onClick={() => setDemoNote(false)} aria-label="Dismiss" className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-warn/15"><Icon name="close" className="size-3.5" /></button>
              </div>
            )}
            {kind === "firebase" && (st.status === "offline" || st.status === "waiting") && route !== "about" && (
              <div className="fade-in mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-crit-line bg-crit-bg px-4 py-3 text-[13.5px] text-crit-ink print:hidden">
                <Icon name="wifi" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{st.status === "offline" ? "The tracker is offline." : "Waiting for the tracker."}</span>{" "}
                  {st.status === "offline"
                    ? `Last reading ${st.when}. The numbers below are the last ones received. The website is working; the device is not sending data.`
                    : "The website is connected, but no device has sent data yet."}
                </span>
                <button onClick={() => switchMode(true)} className="btn btn-primary h-8 rounded-lg px-3 text-[13px]">
                  <Icon name="sun" className="size-4" /> See live demo
                </button>
              </div>
            )}
            <PageCtx.Provider value={current}><div key={route}>{children}</div></PageCtx.Provider>
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} nav={NAV} onToggleSidebar={toggle} onLogin={onLogin} onTour={() => setTour(true)} />
      <Assistant onTour={() => setTour(true)} />
      <Tour open={tour} onClose={() => setTour(false)} />
    </div>
  );
}
