import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Icon from "./Icon.jsx";
import Forecast from "./Forecast.jsx";
import { Panel, Num, Status, Sparkline } from "./ui.jsx";
import { fmt } from "../lib/params.js";
import { derive } from "../lib/derived.js";
import { sunPosition, fmtClock } from "../lib/sun.js";
import { lineOptions } from "../lib/chart.js";
import { trackerVsFixed, modelDayGain } from "../lib/energy.js";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";
import { useTween } from "../hooks/useTween.js";

gsap.registerPlugin(SplitText, useGSAP);

function useSmall() {
  const q = "(max-width: 640px)";
  const [small, setSmall] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q), on = () => setSmall(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return small;
}

const hm = min => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h} h ${m} m` : `${m} m`;
};

/* ---- The day at a glance: sky, sun's path today and the panel's tilt ---- */
function DayScene({ cfg, live, d, c, dark }) {
  const small = useSmall();
  const W = small ? 400 : 620, H = 270, G = 214, TOP = 26, L = 28, R = W - 28;
  const doy = live?.doy;
  const day = d?.day;
  const peakEl = day ? sunPosition(cfg.site, doy, day.noon).el : 90;
  const top = Math.min(90, peakEl + 6);
  const x = m => L + ((m - day.sunrise) / (day.sunset - day.sunrise)) * (R - L);
  const y = el => G - (Math.max(0, el) / top) * (G - TOP);

  const pts = useMemo(() => {
    if (!day) return [];
    const out = [];
    for (let m = day.sunrise; m <= day.sunset + 0.1; m += 6) out.push([x(m), y(sunPosition(cfg.site, doy, m).el)]);
    return out;
  }, [doy, day?.sunrise, cfg.site, W]); // eslint-disable-line react-hooks/exhaustive-deps
  const path = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)},${b.toFixed(1)}`).join(" ");

  if (!d) return <div className="grid h-[270px] place-items-center text-sm text-muted">Waiting for the first reading…</div>;

  const now = Math.min(Math.max(live.minutes, day.sunrise), day.sunset);
  const sx = x(now), sy = d.isDay ? y(d.sun.el) : G;
  const tilt = live.el ?? 0;
  const lean = (live.az ?? 180) < 180 ? -tilt : tilt;
  const px = W / 2, py = G - 40;
  /* sky colour follows the sun: warm near the horizon, clear at midday */
  const warm = d.isDay ? Math.max(0, 1 - d.sun.el / 25) : 1;
  const skyTop = dark ? (d.isDay ? "#18202b" : "#0d0f14") : (d.isDay ? "#eaf1fa" : "#e6e6ee");
  const skyBot = d.isDay ? c.sun : (dark ? "#1b1a2a" : "#d9d7e6");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Sun elevation ${fmt(d.sun.el, 0)} degrees. Panel tilted ${fmt(tilt, 0)} degrees toward the ${lean < 0 ? "east" : "west"}.`}>
      <defs>
        <linearGradient id="ov-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} stopOpacity={dark ? 0.9 : 0.85} />
          <stop offset="1" stopColor={skyBot} stopOpacity={0.08 + warm * 0.22} />
        </linearGradient>
        <linearGradient id="ov-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sun} stopOpacity=".35" />
          <stop offset="1" stopColor={c.sun} stopOpacity="0" />
        </linearGradient>
        <clipPath id="ov-past"><rect x="0" y="0" width={W} height={H} className="smooth" style={{ transform: `translateX(${sx - W}px)` }} /></clipPath>
        <radialGradient id="ov-halo"><stop offset="0" stopColor={c.sun} stopOpacity=".45" /><stop offset="1" stopColor={c.sun} stopOpacity="0" /></radialGradient>
      </defs>

      <rect x="0" y="0" width={W} height={G} rx="12" fill="url(#ov-sky)" className="transition-all duration-1000" />
      {[15, 30, 45, 60, 75].filter(el => el < top).map(el => (
        <g key={el}>
          <line x1={L} x2={R} y1={y(el)} y2={y(el)} stroke={c.grid} strokeDasharray="0" />
          <text x={L} y={y(el) - 5} fill={c.muted} fontSize="10.5">{el}°</text>
        </g>
      ))}

      {/* travelled part of the day: filled and solid */}
      {path && <path d={`${path} L${R},${G} L${L},${G} Z`} fill="url(#ov-fill)" clipPath="url(#ov-past)" />}
      <path d={path} fill="none" stroke={c.axis} strokeWidth="1.5" strokeDasharray="3 4" pathLength="1" />
      <path d={path} fill="none" stroke={c.sun} strokeWidth="2.5" strokeLinecap="round" clipPath="url(#ov-past)" />

      <line x1="0" x2={W} y1={G} y2={G} stroke={c.axis} />
      {[[day.sunrise, "Sunrise", "start"], [day.noon, "Solar noon", "middle"], [day.sunset, "Sunset", "end"]].map(([m, t, a]) => (
        <g key={t}>
          <line x1={x(m)} x2={x(m)} y1={G} y2={G + 5} stroke={c.axis} />
          <text x={x(m)} y={G + 22} textAnchor={a} fill={c.muted} fontSize="11">{t} <tspan fill={c.ink2} fontWeight="500">{fmtClock(m)}</tspan></text>
        </g>
      ))}

      {d.isDay && <line x1={sx} y1={sy} x2={px} y2={py} stroke={c.sun} strokeOpacity=".75" strokeWidth="1.25" className="flow" />}

      <line x1={px} x2={px} y1={py} y2={G} stroke={c.ink2} strokeWidth="3" strokeLinecap="round" />
      <path d={`M${px - 14} ${G}h28`} stroke={c.ink2} strokeWidth="3" strokeLinecap="round" />
      <g className="smooth" style={{ transform: `translate(${px}px, ${py}px) rotate(${lean}deg)` }}>
        <line x1="0" y1="0" x2="0" y2="-24" stroke={c.s1} strokeOpacity=".55" strokeDasharray="2 3" />
        <rect x="-34" y="-3.5" width="68" height="7" rx="2" fill={c.s1} />
        <path d="M-17 -3.5v7M0 -3.5v7M17 -3.5v7" stroke={c.surface} strokeOpacity=".5" />
      </g>
      <circle cx={px} cy={py} r="3.5" fill={c.surface} stroke={c.ink2} strokeWidth="1.5" />

      <g className="smooth" style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        {d.isDay ? (
          <>
            <circle r="36" fill="url(#ov-halo)" />
            <g className="spin-slow" stroke={c.sun} strokeWidth="1.6" strokeLinecap="round">
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * Math.PI) / 4;
                return <line key={i} x1={Math.cos(a) * 14} y1={Math.sin(a) * 14} x2={Math.cos(a) * 19} y2={Math.sin(a) * 19} />;
              })}
            </g>
            <circle r="9" fill={c.sun} />
          </>
        ) : <circle r="8" fill={c.muted} />}
      </g>
    </svg>
  );
}

function Gauge({ value, c }) {
  const v = useTween(value ?? 0);
  const r = 26, len = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke={c.grid} strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={c.good} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(100, v)) / 100)} />
    </svg>
  );
}

const TINT = {
  sun: "bg-sun/14 text-sun-ink", blue: "bg-s1/12 text-s1", good: "bg-good/12 text-good-ink", orange: "bg-s2/12 text-s2"
};

function KpiCard({ icon, tint, label, children, sub, values, color, delta, tour, i }) {
  return (
    <div data-tour={tour} className="panel reveal group flex min-w-0 flex-col p-5" style={{ "--i": i }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-ink-2">{label}</span>
        <span className={`grid size-8 place-items-center rounded-lg transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 ${TINT[tint]}`}><Icon name={icon} className="size-4" /></span>
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.03em]">{children}</div>
      <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
        {delta != null && Math.abs(delta) > 0.004 && <span className={delta > 0 ? "text-good-ink" : "text-crit-ink"}>{delta > 0 ? "↑" : "↓"} {fmt(Math.abs(delta), 1)}</span>}
        <span className="truncate">{sub}</span>
      </div>
      <div className="mt-auto pt-3">{values && <Sparkline values={values} color={color} height={30} />}</div>
    </div>
  );
}

function condition(t) {
  const hi = t.heat_index_c ?? t.ambient_temp_c, h = t.humidity_pct;
  if (hi == null) return "--";
  const feel = hi >= 41 ? "Very hot" : hi >= 32 ? "Hot" : hi >= 27 ? "Warm" : hi >= 18 ? "Pleasant" : "Cool";
  const wet = h == null ? "" : h >= 70 ? " and humid" : h <= 30 ? " and dry" : "";
  return feel + wet;
}

export default function Overview() {
  const { cfg, live, history, control } = useTelemetry();
  const { status } = useDeviceStatus();
  const stale = status === "offline" || status === "waiting";
  const { c, theme } = useTheme();
  const hero = useRef(null);
  const d = derive(live, cfg);
  const t = live?.t || {};
  const rows = history.slice(-120);
  const prev = history.length > 1 ? history[history.length - 2].t : {};
  const recent = history.slice(-40);
  const spark = k => recent.map(r => r.t[k]);

  /* gradient-filled power chart */
  const chart = useMemo(() => ({
    labels: rows.map(r => r.label),
    datasets: [{
      label: "Power", data: rows.map(r => (r.t.power_mw != null ? r.t.power_mw / 1000 : null)),
      borderColor: c.s1, pointBackgroundColor: c.s1, borderWidth: 2.25, tension: 0.35, spanGaps: true, fill: "origin",
      backgroundColor: ctx => {
        const a = ctx.chart.chartArea;
        if (!a) return c.s1 + "22";
        const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
        g.addColorStop(0, c.s1 + "55"); g.addColorStop(1, c.s1 + "00");
        return g;
      }
    }]
  }), [rows, c]);
  const opts = useMemo(() => lineOptions(c, { unit: "W" }), [c]);
  const watts = rows.map(r => (r.t.power_mw != null ? r.t.power_mw / 1000 : null)).filter(v => v != null);
  const peak = watts.length ? Math.max(...watts) : 0;
  const avg = watts.length ? watts.reduce((a, b) => a + b, 0) / watts.length : null;
  const cmp = useMemo(() => trackerVsFixed(history, cfg), [history, cfg]);
  const model = useMemo(() => (live ? modelDayGain(cfg, live.doy) : null), [cfg, live?.doy]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = live?.minutes ?? 0;
  const greet = minutes < 12 * 60 ? "Good morning" : minutes < 17 * 60 ? "Good afternoon" : "Good evening";
  const headline = status === "offline" ? "The tracker is offline"
    : status === "waiting" ? "Waiting for the tracker"
    : !d ? "Connecting to the tracker"
    : control.estop ? "Emergency stop is active"
      : !d.isDay ? "The sun has set for today"
        : control.mode === "manual" ? "The panel is under manual control"
          : "The panel is following the sun";
  const dayP = d ? Math.min(1, Math.max(0, (minutes - d.day.sunrise) / (d.day.sunset - d.day.sunrise))) : 0;
  const left = d ? Math.max(0, d.day.sunset - minutes) : 0;
  const mode = stale
    ? <Status tone={status === "offline" ? "crit" : "idle"}>{status === "offline" ? `No data · last seen ${live?.label ?? "--"}` : "No data yet"}</Status>
    : control.estop
    ? <Status tone="crit">Emergency stop</Status>
    : control.mode !== "auto" ? <Status tone="sun">Manual control</Status>
      : d && !d.isDay ? <Status tone="idle">Automatic · waiting for sunrise</Status>
        : <Status tone="good" live>Automatic · following the sun</Status>;
  const date = new Date((live?.ts ?? Date.now() / 1000) * 1000).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.fonts.ready.then(() => {
      if (!hero.current) return;
      SplitText.create(hero.current.querySelector("h1"), {
        type: "words,chars", mask: "words", autoSplit: true,
        onSplit: self => gsap.from(self.chars, { yPercent: 110, duration: 0.8, ease: "expo.out", stagger: 0.02 })
      });
    });
    gsap.from(hero.current.querySelectorAll("[data-hfade]"), { y: 14, autoAlpha: 0, duration: 0.7, ease: "power3.out", stagger: 0.08, delay: 0.2 });
  }, { scope: hero });

  return (
    <div className="space-y-5">
      {/* hero band */}
      <section ref={hero} className="panel reveal relative grid grid-cols-1 gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end" style={{ "--i": 0 }}>
        <div className="hdr-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="hdr-glow pointer-events-none absolute -right-20 -top-32 size-[420px] rounded-full" aria-hidden="true" />
        <div className="relative">
          <div data-hfade className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle/80 px-2.5 py-1 backdrop-blur"><Icon name="compass" className="size-3.5" />{cfg.site.name}</span>
            <span className="inline-flex items-center rounded-full border border-line bg-subtle/80 px-2.5 py-1 backdrop-blur">{date}</span>
          </div>
          <p data-hfade className="mt-5 text-[15px] text-muted">{greet}</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[40px]">{headline}</h1>
          <div data-hfade className="mt-4 text-[13.5px]">{mode}</div>
        </div>

        <div data-hfade className="relative rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium text-ink-2">Daylight</span>
            <span className="text-muted">{d ? (d.isDay ? `${hm(left)} of sunlight left` : "Night") : "--"}</span>
          </div>
          <div className="relative mt-5 h-2 rounded-full bg-subtle ring-1 ring-line ring-inset">
            <div className="h-full rounded-full bg-gradient-to-r from-[#eb6834] via-sun to-sun transition-[width] duration-1000 ease-out-soft" style={{ width: `${dayP * 100}%` }} />
            <span className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-sun text-[#141412] shadow-[0_0_0_4px_var(--surface),0_0_24px_var(--sun)] transition-[left] duration-1000 ease-out-soft"
              style={{ left: `${dayP * 100}%` }}>
              <Icon name="sun" className="size-3.5" strokeWidth={2.4} />
            </span>
          </div>
          <div className="mt-3 flex justify-between text-[12px] text-muted num">
            <span><Icon name="sunrise" className="mr-1 inline size-3.5" />{d ? fmtClock(d.day.sunrise) : "--"}</span>
            <span>{live ? `${live.simulated ? "sim " : ""}${live.label}` : ""}</span>
            <span>{d ? fmtClock(d.day.sunset) : "--"}<Icon name="sunset" className="ml-1 inline size-3.5" /></span>
          </div>
        </div>
      </section>

      {/* today scene + power column */}
      <section className="panel reveal grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]" style={{ "--i": 1 }}>
        <div data-tour="today" className="flex flex-col border-b border-line px-3 pb-2 pt-4 sm:px-5 lg:border-b-0 lg:border-r">
          <div className="flex items-baseline justify-between px-2">
            <h2 className="text-[14px] font-semibold">Today</h2>
            <span className="flex items-center gap-3 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sun" />Sun</span>
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-sm bg-s1" />Panel</span>
            </span>
          </div>
          <div className="flex flex-1 items-center"><DayScene cfg={cfg} live={live} d={d} c={c} dark={theme === "dark"} /></div>
        </div>

        <div className="flex flex-col divide-y divide-line">
          <div data-tour="power" className="relative overflow-hidden px-6 py-5">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-ink-2">Power output</span>
              {stale ? <Status tone="idle" className="text-[11.5px] text-muted">last reading</Status> : <Status tone="good" live className="text-[11.5px] text-muted">live</Status>}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <Num value={t.power_mw != null ? t.power_mw / 1000 : null} className="text-[48px] font-semibold leading-none tracking-[-0.045em]" />
              <span className="text-[18px] font-medium text-muted">W</span>
            </div>
            <div className="mt-2 text-[12.5px] text-muted num">{fmt(t.load_voltage_v)} V × {fmt(t.current_ma, 0)} mA</div>
            <div className="mt-3"><Sparkline values={recent.map(r => (r.t.power_mw != null ? r.t.power_mw / 1000 : null))} color={c.s1} height={36} /></div>
          </div>
          <div className="flex items-center gap-4 px-6 py-5">
            <Gauge value={d?.cosFactor} c={c} />
            <div>
              <div className="text-[12.5px] text-ink-2">Sun alignment</div>
              <div className="flex items-baseline gap-1">
                <Num value={d?.cosFactor} digits={1} className="text-[26px] font-semibold tracking-[-0.02em]" />
                <span className="text-[14px] text-muted">%</span>
              </div>
              <div className="text-[12.5px] text-muted">{d?.theta != null ? `Off by ${fmt(d.theta, 1)}° from the sun` : "Sun below the horizon"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full border border-line bg-subtle">
                <span className="smooth grid place-items-center" style={{ transform: `rotate(${live?.az ?? 0}deg)` }}><Icon name="up" className="size-4 text-s1" strokeWidth={2.2} /></span>
              </span>
              <div>
                <div className="text-[12px] text-ink-2">Azimuth</div>
                <div className="text-[18px] font-semibold"><Num value={live?.az} digits={1} />°</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full border border-line bg-subtle">
                <span className="smooth block h-0.5 w-4 rounded-full bg-s1" style={{ transform: `rotate(${-(live?.el ?? 0)}deg)` }} />
              </span>
              <div>
                <div className="text-[12px] text-ink-2">Tilt</div>
                <div className="text-[18px] font-semibold"><Num value={live?.el} digits={1} />°</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard i={2} icon="thermo" tint="orange" label="Panel temperature" sub={`air ${fmt(t.ambient_temp_c, 1)} °C`}
          values={spark("panel_temp_c")} color={c.s2} delta={t.panel_temp_c != null && prev.panel_temp_c != null ? t.panel_temp_c - prev.panel_temp_c : null}>
          <Num value={t.panel_temp_c} digits={1} /><span className="ml-1 text-[15px] font-medium text-muted">°C</span>
        </KpiCard>
        <KpiCard i={3} icon="sun" tint="sun" label="Sunlight" sub="BH1750"
          values={spark("light_intensity_lux")} color={c.sun} delta={t.light_intensity_lux != null && prev.light_intensity_lux != null ? (t.light_intensity_lux - prev.light_intensity_lux) / 1000 : null}>
          <Num value={t.light_intensity_lux != null ? t.light_intensity_lux / 1000 : null} digits={1} /><span className="ml-1 text-[15px] font-medium text-muted">klux</span>
        </KpiCard>
        <KpiCard i={4} icon="battery" tint="blue" label="Charge today" sub="since sunrise"
          values={spark("capacity_mah")} color={c.s1}>
          <Num value={t.capacity_mah} digits={0} /><span className="ml-1 text-[15px] font-medium text-muted">mAh</span>
        </KpiCard>
        <KpiCard i={5} tour="gain" icon="trendUp" tint="good" label="Gain over a fixed panel"
          sub={cmp.gain != null ? `measured so far +${fmt(cmp.gain, 1)} %` : "today, clear-sky model"}>
          <span className="text-good-ink">{model != null ? <>+<Num value={model} digits={0} /></> : "--"}</span><span className="ml-1 text-[15px] font-medium text-muted">%</span>
        </KpiCard>
      </div>

      <Forecast i={6} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel i={7} className="lg:col-span-2" title="Power output" meta={`Last ${rows.length} readings`}
          actions={<a href="#/analytics" className="btn btn-quiet h-8 px-2.5">Analytics <Icon name="chevronRight" className="size-3.5" /></a>}>
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[["Peak", fmt(peak), "W"], ["Average", fmt(avg), "W"], ["Energy", fmt(cmp.whTracker, 1), "Wh"]].map(([l, v, u]) => (
              <div key={l} className="rounded-xl border border-line bg-subtle/50 px-3.5 py-2.5">
                <div className="text-[11.5px] text-muted">{l}</div>
                <div className="text-[17px] font-semibold tracking-[-0.02em] num">{v}<span className="ml-1 text-[12px] font-medium text-muted">{u}</span></div>
              </div>
            ))}
          </div>
          <div className="h-[220px]">{rows.length > 1 ? <Line data={chart} options={opts} /> : <div className="grid h-full place-items-center text-sm text-muted">Collecting readings…</div>}</div>
        </Panel>

        <Panel i={8} title="Weather" meta="DHT22 near the panel"
          actions={<a href="#/telemetry" className="btn btn-quiet h-8 px-2.5">All 16 <Icon name="chevronRight" className="size-3.5" /></a>}>
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-sun/25 to-[#eb6834]/20 text-sun-ink">
              <Icon name={d?.isDay ? "sun" : "moon"} className="size-7" />
            </span>
            <div>
              <div className="text-[36px] font-semibold leading-none tracking-[-0.04em]"><Num value={t.ambient_temp_c} digits={1} /><span className="text-[18px] text-muted">°C</span></div>
              <div className="mt-1 text-[13px] text-ink-2">{condition(t)}</div>
            </div>
          </div>
          <ul className="mt-5 space-y-2.5">
            {[
              ["drop", "Humidity", `${fmt(t.humidity_pct, 1)} %`, t.humidity_pct],
              ["flame", "Feels like", `${fmt(t.heat_index_c, 1)} °C`, null],
              ["dew", "Dew point", `${fmt(t.dew_point_c, 1)} °C`, null],
              ["thermo", "In °F", `${fmt(t.ambient_temp_f, 1)} °F`, null]
            ].map(([icon, l, v, bar]) => (
              <li key={l} className="flex items-center gap-3 text-[13.5px]">
                <span className="grid size-7 place-items-center rounded-lg bg-subtle text-muted ring-1 ring-line"><Icon name={icon} className="size-3.5" /></span>
                <span className="flex-1 text-ink-2">{l}</span>
                {bar != null && <span className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-s1 transition-[width] duration-700" style={{ width: `${bar}%` }} /></span>}
                <span className="w-20 text-right font-medium num">{v}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
