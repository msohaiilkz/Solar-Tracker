import { Suspense, lazy, useMemo, useRef } from "react";
import { PageHeader, Panel, KV, Status } from "./ui.jsx";
import { fmt } from "../lib/params.js";
import { derive, ldrDecision } from "../lib/derived.js";
import { sunPosition, fmtClock, rad } from "../lib/sun.js";
import { useTelemetry } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";

const TrackerScene = lazy(() => import("./three/TrackerScene.jsx"));

/* ---------- Sky map: looking straight up, sun path + sun + panel aim ---------- */
function SkyMap({ cfg, live, d, c }) {
  const C = 170, R = 136;
  const project = (az, el) => {
    const r = R * (90 - Math.max(0, el)) / 90;
    return [C + r * Math.sin(rad(az)), C - r * Math.cos(rad(az))];
  };
  const path = useMemo(() => {
    if (!d) return "";
    const pts = [];
    for (let m = d.day.sunrise; m <= d.day.sunset; m += 8) {
      const s = sunPosition(cfg.site, live.doy, m);
      pts.push(project(s.az, s.el));
    }
    return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.doy, cfg.site]);

  const sun = d ? project(d.sun.az, d.sun.el) : null;
  const aim = live?.az != null ? project(live.az, 90 - live.el) : null;

  return (
    <svg viewBox="0 0 340 340" className="mx-auto w-full max-w-[360px]" role="img"
      aria-label={d ? `Sky map. Sun at azimuth ${fmt(d.sun.az, 0)}°, elevation ${fmt(d.sun.el, 0)}°. Panel aimed at azimuth ${fmt(live?.az, 0)}°.` : "Sky map"}>
      <circle cx={C} cy={C} r={R} fill={c.subtle} stroke={c.axis} />
      {[30, 60].map(el => <circle key={el} cx={C} cy={C} r={R * (90 - el) / 90} fill="none" stroke={c.line} />)}
      <path d={`M${C} ${C - R}V${C + R}M${C - R} ${C}H${C + R}`} stroke={c.line} />
      {[["N", C, C - R - 10], ["S", C, C + R + 20], ["E", C + R + 13, C + 4], ["W", C - R - 13, C + 4]].map(([t, x, y]) => (
        <text key={t} x={x} y={y} textAnchor="middle" fill={c.ink2} fontSize="12" fontWeight="600">{t}</text>
      ))}
      <text x={C + 5} y={C - R * 60 / 90 + 13} fill={c.muted} fontSize="10">30°</text>
      <text x={C + 5} y={C - R * 30 / 90 + 13} fill={c.muted} fontSize="10">60°</text>

      {path && <path d={path} fill="none" stroke={c.sun} strokeOpacity=".55" strokeWidth="1.75" pathLength="1" className="draw" />}
      {sun && aim && d.isDay && <line x1={aim[0]} y1={aim[1]} x2={sun[0]} y2={sun[1]} stroke={c.muted} strokeDasharray="2 3" />}

      {aim && (
        <g className="smooth" style={{ transform: `translate(${aim[0]}px, ${aim[1]}px)` }}>
          <circle r="12" fill={c.s1} fillOpacity=".14" stroke={c.s1} strokeWidth="1.5" />
          <circle r="3.5" fill={c.s1} />
        </g>
      )}
      {sun && d.isDay && (
        <g className="smooth" style={{ transform: `translate(${sun[0]}px, ${sun[1]}px)` }}>
          <circle r="9" fill={c.sun} stroke={c.surface} strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

/* ---------- Side view: panel tilt against the sun's height ---------- */
function SideView({ live, d, c }) {
  const px = 170, py = 118, GY = py + 46;
  const tilt = live?.el ?? 0;
  const se = d ? Math.max(-4, d.sun.el) : 30;
  const sx = px - 122 * Math.cos(rad(se)), sy = py - 104 * Math.sin(rad(se));
  return (
    <svg viewBox="0 0 340 180" className="w-full" role="img" aria-label={`Side view. Panel tilt ${fmt(tilt, 0)}°, sun elevation ${fmt(d?.sun.el, 0)}°.`}>
      <line x1="10" x2="330" y1={GY} y2={GY} stroke={c.axis} />
      <line x1={px} x2={px} y1={py} y2={GY} stroke={c.ink2} strokeWidth="3" strokeLinecap="round" />
      <path d={`M${px - 14} ${GY}h28`} stroke={c.ink2} strokeWidth="3" strokeLinecap="round" />
      <path d={`M${px - 44} ${py}A44 44 0 0 1 ${px - 44 * Math.cos(rad(se))} ${py - 44 * Math.sin(rad(se))}`} fill="none" stroke={c.sun} strokeOpacity=".6" />
      {d?.isDay && <line x1={sx} y1={sy} x2={px} y2={py} stroke={c.sun} strokeOpacity=".7" className="flow" />}
      <g className="smooth" style={{ transform: `translate(${px}px, ${py}px) rotate(${-tilt}deg)` }}>
        <line x1="0" y1="0" x2="0" y2="-34" stroke={c.s1} strokeOpacity=".55" strokeDasharray="2 3" />
        <rect x="-40" y="-3.5" width="80" height="7" rx="2" fill={c.s1} />
      </g>
      <circle cx={px} cy={py} r="4" fill={c.surface} stroke={c.ink2} strokeWidth="1.5" />
      <circle cx={sx} cy={sy} r="9" fill={d?.isDay ? c.sun : c.muted} />
      <text x={px + 22} y={GY - 8} fill={c.ink2} fontSize="11.5">tilt {fmt(tilt, 1)}°</text>
      <text x={Math.max(sx - 10, 14)} y={Math.max(sy - 16, 14)} fill={c.ink2} fontSize="11.5">sun {fmt(d?.sun.el, 1)}°</text>
    </svg>
  );
}

/* ---------- Four LDRs ---------- */
function Ldr({ live, cfg, c }) {
  const ldr = live?.ldr || {};
  const dec = ldrDecision(ldr, cfg.deadband);
  const bar = (key, label, cls, vertical) => {
    const v = ldr[key];
    const peak = dec && v === dec.peak;
    return (
      <div className={`absolute flex w-[88px] flex-col items-center gap-1.5 ${cls}`}>
        <span className="text-[11.5px] font-medium text-ink-2">{label}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle ring-1 ring-line ring-inset">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out-soft" style={{ width: `${v ?? 0}%`, background: peak ? c.sun : c.ink2 }} />
        </div>
        <span className="text-[15px] font-semibold num">{v ?? "--"}<span className="text-[11px] font-normal text-muted">%</span></span>
        {vertical}
      </div>
    );
  };
  const off = v => Math.max(-40, Math.min(40, v * 1.4));
  const ox = dec ? off(ldr.east - ldr.west) : 0;    // dot leans to the brighter side
  const oy = dec ? off(ldr.south - ldr.north) : 0;

  return (
    <>
      <div className="relative mx-auto h-[300px] w-full max-w-[360px]">
        <div className="absolute left-1/2 top-1/2 size-[132px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-subtle/50" />
        <div className="absolute left-1/2 top-1/2 size-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-line-strong" />
        <div className="absolute left-1/2 top-1/2 h-[132px] w-px -translate-x-1/2 -translate-y-1/2 bg-line" />
        <div className="absolute left-1/2 top-1/2 h-px w-[132px] -translate-x-1/2 -translate-y-1/2 bg-line" />
        <div className="absolute left-1/2 top-1/2 size-3.5 rounded-full transition-transform duration-700 ease-out-soft"
          style={{ background: c.sun, boxShadow: `0 0 0 4px ${c.surface}`, transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))` }} />
        {bar("north", "North (top)", "left-1/2 top-0 -translate-x-1/2")}
        {bar("south", "South (bottom)", "bottom-0 left-1/2 -translate-x-1/2")}
        {bar("east", "East", "right-0 top-1/2 -translate-y-1/2")}
        {bar("west", "West", "left-0 top-1/2 -translate-y-1/2")}
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <KV rows={[
          ["Azimuth motor", dec ? (dec.az ? `Turn ${dec.az.toLowerCase()}` : "Hold") : "--", dec ? `Δ ${dec.dEW}` : ""],
          ["Tilt motor", dec ? (dec.el ? (dec.el === "UP" ? "Tilt toward top" : "Tilt toward bottom") : "Hold") : "--", dec ? `Δ ${dec.dNS}` : ""],
          ["Deadband", `±${cfg.deadband} %`]
        ]} />
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The yellow dot leans toward the brighter sensors. Inside the dashed ring, both differences are within the deadband and the motors rest.
          {live?.mode === "manual" && " Manual mode is on, so the device is ignoring the sensors."}
        </p>
      </div>
    </>
  );
}

export default function Tracking() {
  const { cfg, live } = useTelemetry();
  const { c, theme } = useTheme();
  const d = derive(live, cfg);
  const aligned = d?.theta != null && d.theta < 5;

  /* live pose for the 3D model */
  const poseRef = useRef({});
  if (live && d) poseRef.current = { az: live.az ?? 180, tilt: live.el ?? 0, sunAz: d.sun.az, sunEl: d.sun.el };
  const path = useMemo(() => {
    if (!d) return [];
    const pts = [];
    for (let m = d.day.sunrise - 10; m <= d.day.sunset + 10; m += 6) { const s = sunPosition(cfg.site, live.doy, m); pts.push([s.az, s.el]); }
    return pts;
  }, [live?.doy, cfg.site]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Sun tracking"
        desc="Where the sun is, worked out from date, time and location, against where the panel is pointing. When the two markers meet, the panel faces the sun head-on." />

      <Panel i={1} className="mb-5" title="3D view" meta="Live pose from the device · drag to turn it around" bodyClass="relative"
        actions={<div className="hidden gap-4 text-[12px] text-ink-2 sm:flex">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sun" />Sun and today's path</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-s1" />Panel</span>
        </div>}>
        <div className="relative h-[340px] overflow-hidden rounded-b-xl bg-gradient-to-b from-subtle/70 to-transparent sm:h-[440px]">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading 3D view…</div>}>
            <TrackerScene poseRef={poseRef} path={path} c={c} dark={theme === "dark"} interactive camera={[-1.6, 5.4, -8.2]} fov={44} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
          </Suspense>
          <div className="pointer-events-none absolute left-5 top-4 space-y-1 text-[12.5px]">
            <div className="text-muted">Panel</div>
            <div className="text-[20px] font-semibold tracking-[-0.02em] num">{fmt(live?.az, 1)}° <span className="text-[13px] font-normal text-muted">az</span> · {fmt(live?.el, 1)}° <span className="text-[13px] font-normal text-muted">tilt</span></div>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-5">
            {d && (d.isDay
              ? <Status tone={aligned ? "good" : "sun"}>{aligned ? `Facing the sun · off by ${fmt(d.theta, 1)}°` : "Turning toward the sun"}</Status>
              : <Status tone="idle">Night · panel resting</Status>)}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel i={2} title="Sky map" meta="Looking straight up from the panel"
          actions={<div className="hidden gap-4 text-[12px] text-ink-2 sm:flex">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-sun" />Sun</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-s1" />Panel aim</span>
          </div>}>
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
            <SkyMap cfg={cfg} live={live} d={d} c={c} />
            <div>
              <SideView live={live} d={d} c={c} />
              <div className="mt-4">
                <KV rows={[
                  ["Sun", d ? `${fmt(d.sun.az, 1)}° az · ${fmt(d.sun.el, 1)}° el` : "--"],
                  ["Panel", live ? `${fmt(live.az, 1)}° az · ${fmt(live.el, 1)}° tilt` : "--"],
                  ["Ideal tilt", d?.isDay ? `${fmt(d.idealTilt, 1)}°` : "--", "90° − sun elevation"],
                  ["Angle to sun", d?.theta != null ? `${fmt(d.theta, 1)}°` : "--"],
                  ["Cosine factor", d?.cosFactor != null ? `${fmt(d.cosFactor, 1)} %` : "--"]
                ]} />
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[12.5px] text-ink-2">
            <div className="flex flex-wrap gap-x-5 gap-y-1 num">
              <span>Sunrise {d ? fmtClock(d.day.sunrise) : "--"}</span>
              <span>Solar noon {d ? fmtClock(d.day.noon) : "--"}</span>
              <span>Sunset {d ? fmtClock(d.day.sunset) : "--"}</span>
            </div>
            {d && (d.isDay
              ? <Status tone={aligned ? "good" : "sun"}>{aligned ? "Facing the sun" : "Turning toward the sun"}</Status>
              : <Status tone="idle">Night</Status>)}
          </div>
        </Panel>

        <Panel i={2} title="Light sensors" meta="Four LDRs on the panel edges">
          <Ldr live={live} cfg={cfg} c={c} />
        </Panel>
      </div>
    </>
  );
}
