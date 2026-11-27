/* Shared building blocks */
import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Icon from "./Icon.jsx";
import { usePage } from "../hooks/usePage.js";
import { fmt } from "../lib/params.js";
import { useTween } from "../hooks/useTween.js";
import { useDeviceStatus } from "../hooks/useTelemetry.jsx";

gsap.registerPlugin(SplitText, useGSAP);

/* Animated number */
export function Num({ value, digits = 2, className = "" }) {
  const v = useTween(value);
  return <span className={className}>{fmt(v, digits)}</span>;
}

export function PageHeader({ title, desc, actions }) {
  const page = usePage();
  const ref = useRef(null);
  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    gsap.from(el.querySelectorAll("[data-hfade]"), { y: 14, autoAlpha: 0, duration: 0.7, ease: "power3.out", stagger: 0.07, delay: 0.15 });
    document.fonts.ready.then(() => {
      if (!el.isConnected) return;
      SplitText.create(el.querySelector("h1"), {
        type: "words,chars", mask: "words", autoSplit: true,
        onSplit: self => gsap.from(self.chars, { yPercent: 110, duration: 0.8, ease: "expo.out", stagger: 0.016 })
      });
    });
  }, { scope: ref });

  return (
    <div ref={ref} className="page-hero reveal relative z-10 mb-7 rounded-2xl border border-line bg-surface print:border-0" style={{ "--i": 0 }}>
      {/* decoration is clipped on its own layer, so menus in the header can overflow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl print:hidden" aria-hidden="true">
        <div className="hdr-grid absolute inset-0" />
        <div className="hdr-glow absolute -right-24 -top-28 size-[380px] rounded-full" />
        {page?.icon && <Icon name={page.icon} className="hdr-icon absolute -bottom-16 -right-6 size-[190px] text-line opacity-60" strokeWidth={0.6} />}
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-5 px-6 py-7 sm:px-8 sm:py-9">
        <div className="max-w-2xl">
          {page && (
            <div data-hfade className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle/80 px-2.5 py-1 text-[12px] font-medium text-ink-2 backdrop-blur">
              <Icon name={page.icon} className="size-3.5" />{page.group}<span className="text-muted">/</span><span className="text-ink">{page.label}</span>
            </div>
          )}
          <h1 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[36px]">{title}</h1>
          {desc && <p data-hfade className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{desc}</p>}
        </div>
        {actions && <div data-hfade className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, meta, actions, children, className = "", bodyClass = "p-5", i = 1, tour }) {
  return (
    <section data-tour={tour} className={`panel reveal min-w-0 ${className}`} style={{ "--i": i }}>
      {(title || actions) && (
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold">{title}</h2>
            {meta && <p className="text-[12.5px] text-muted">{meta}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

const TONES = {
  good: "bg-good", warn: "bg-warn", crit: "bg-crit", sun: "bg-sun", info: "bg-s1", idle: "bg-muted"
};

/* Coloured dot + text label (colour never carries the meaning alone) */
export function Status({ tone = "idle", live, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${className}`}>
      <span className="relative flex size-2">
        {live && <span className={`ping absolute inset-0 rounded-full ${TONES[tone]}`} />}
        <span className={`relative size-2 rounded-full ${TONES[tone]}`} />
      </span>
      {children}
    </span>
  );
}

export function DeviceStatus({ compact }) {
  const { status } = useDeviceStatus();
  const map = {
    demo: ["warn", "Demo data", true],
    online: ["good", "Live", true],
    offline: ["crit", "Offline", false],
    waiting: ["idle", "Waiting for device", true]
  };
  const [tone, label, live] = map[status];
  return (
    <span className={`inline-flex items-center rounded-full border border-line bg-surface ${compact ? "h-7 px-2.5" : "h-8 px-3"}`}>
      <Status tone={tone} live={live}>{label}</Status>
    </span>
  );
}

/* Segmented control */
export function Segmented({ options, value, onChange, label, size = "md", disabled }) {
  const h = size === "sm" ? "h-7 text-[12.5px]" : "h-8 text-[13px]";
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-subtle p-0.5 ring-1 ring-line ring-inset">
      {options.map(o => {
        const [v, text, icon] = Array.isArray(o) ? o : [o, String(o)];
        const on = v === value;
        return (
          <button key={String(v)} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(v)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 font-medium transition-colors duration-150 ${h} ${on ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/.08)] ring-1 ring-line" : "text-muted hover:text-ink"}`}>
            {icon && <Icon name={icon} className="size-3.5" />}{text}
          </button>
        );
      })}
    </div>
  );
}

/* Key / value rows */
export function KV({ rows }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v, sub]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="shrink-0 text-[13px] text-ink-2">{k}</dt>
          <dd className="min-w-0 truncate text-right text-[13.5px] font-medium num">
            {v}{sub && <span className="ml-1.5 font-normal text-muted">{sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* Small trend line */
export function Sparkline({ values, color, height = 32 }) {
  const pts = values.filter(v => v != null && Number.isFinite(v));
  if (pts.length < 2) return <div style={{ height }} />;
  const w = 120, min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const step = w / (pts.length - 1);
  const xy = pts.map((v, i) => [i * step, height - 4 - ((v - min) / span) * (height - 8)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }} aria-hidden="true">
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={color} fillOpacity=".07" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.2" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Notice({ tone = "warn", icon = "info", children, action }) {
  const cls = tone === "crit" ? "border-crit-line bg-crit-bg text-crit-ink" : "border-warn/30 bg-warn-bg text-warn-ink";
  return (
    <div className={`fade-in flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-2.5 text-[13.5px] ${cls}`} role="status">
      <Icon name={icon} className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
