import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { PageHeader, Panel, Segmented, Status, Notice, KV } from "./ui.jsx";
import { fmt } from "../lib/params.js";
import { sunPosition, dayTimes, clamp } from "../lib/sun.js";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";

const r1 = v => Math.round(v * 10) / 10;

function useLimits(cfg) {
  const L = cfg.limits;
  const full = L.azMin === 0 && L.azMax === 360;
  return {
    az: a => (full ? ((a % 360) + 360) % 360 : clamp(a, L.azMin, L.azMax)),
    el: e => clamp(e, L.elMin, L.elMax)
  };
}

function presetList(cfg, live) {
  const doy = live?.doy;
  if (doy == null) return [];
  const day = dayTimes(cfg.site, doy);
  const aim = m => { const s = sunPosition(cfg.site, doy, m); return { az: r1(s.az), el: r1(Math.max(0, 90 - Math.max(0, s.el))) }; };
  return [
    { id: "sunrise", icon: "sunrise", name: "Sunrise", note: "Face east for the first light", ...aim(day.sunrise + 30) },
    { id: "noon", icon: "zenith", name: "Solar noon", note: "Sun at its highest", ...aim(day.noon) },
    { id: "sunset", icon: "sunset", name: "Sunset", note: "Face west for the last light", ...aim(day.sunset - 30) },
    { id: "stow", icon: "wind", name: "Storm stow", note: "Lay the panel flat in strong wind", az: r1(live?.az ?? cfg.home.az), el: 0 },
    { id: "home", icon: "home", name: "Home position", note: "Reset to the start position", az: cfg.home.az, el: cfg.home.el }
  ];
}

const STATE = {
  sending: ["info", "Sending"],
  sent: ["info", "Waiting for device"],
  confirmed: ["good", "Confirmed"],
  saved: ["good", "Saved to cloud"],
  timeout: ["warn", "No reply in 10 s"],
  error: ["crit", "Failed"]
};

/* Two live dials: where the panel points (solid) and where it was told to go (dashed) */
function PoseDials({ az, el, targetAz, targetEl, c }) {
  const rot = { transformOrigin: "0 0" };
  return (
    <div className="grid grid-cols-2 gap-4">
      <figure className="text-center">
        <svg viewBox="-70 -70 140 140" className="mx-auto w-full max-w-[150px]" role="img" aria-label={`Azimuth ${fmt(az, 0)} degrees`}>
          <circle r="58" fill={c.subtle} stroke={c.axis} />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180, long = i % 6 === 0;
            return <line key={i} x1={Math.sin(a) * (long ? 47 : 52)} y1={-Math.cos(a) * (long ? 47 : 52)} x2={Math.sin(a) * 57} y2={-Math.cos(a) * 57} stroke={long ? c.ink2 : c.axis} strokeWidth={long ? 1.5 : 1} />;
          })}
          {[["N", 0, -34], ["E", 35, 4], ["S", 0, 40], ["W", -35, 4]].map(([t, x, y]) => <text key={t} x={x} y={y} textAnchor="middle" fontSize="10" fontWeight="600" fill={c.muted}>{t}</text>)}
          {targetAz != null && (
            <g className="smooth" style={{ ...rot, transform: `rotate(${targetAz}deg)` }}>
              <line y2="-44" stroke={c.sun} strokeWidth="2" strokeDasharray="3 3" />
              <circle cy="-46" r="3" fill={c.sun} />
            </g>
          )}
          <g className="smooth" style={{ ...rot, transform: `rotate(${az ?? 0}deg)` }}>
            <path d="M0 -46 L5 0 L0 6 L-5 0 Z" fill={c.s1} />
          </g>
          <circle r="4" fill={c.surface} stroke={c.ink2} strokeWidth="1.5" />
        </svg>
        <figcaption className="mt-1 text-[12.5px] text-ink-2">Azimuth <span className="font-semibold text-ink num">{fmt(az, 1)}°</span></figcaption>
      </figure>
      <figure className="text-center">
        <svg viewBox="-12 -78 140 100" className="mx-auto w-full max-w-[150px]" role="img" aria-label={`Tilt ${fmt(el, 0)} degrees`}>
          <path d="M0 0 L62 0 A62 62 0 0 0 0 -62 Z" fill={c.subtle} stroke={c.axis} />
          {[0, 15, 30, 45, 60, 75, 90].map(d => {
            const a = (d * Math.PI) / 180;
            return <line key={d} x1={Math.cos(a) * 54} y1={-Math.sin(a) * 54} x2={Math.cos(a) * 62} y2={-Math.sin(a) * 62} stroke={c.ink2} />;
          })}
          <text x="66" y="4" fontSize="9.5" fill={c.muted}>0°</text>
          <text x="-4" y="-66" fontSize="9.5" fill={c.muted}>90°</text>
          {targetEl != null && (
            <g className="smooth" style={{ ...rot, transform: `rotate(${-targetEl}deg)` }}>
              <line x2="56" stroke={c.sun} strokeWidth="2" strokeDasharray="3 3" />
            </g>
          )}
          <g className="smooth" style={{ ...rot, transform: `rotate(${-(el ?? 0)}deg)` }}>
            <rect x="0" y="-3.5" width="56" height="7" rx="2" fill={c.s1} />
          </g>
          <circle r="4" fill={c.surface} stroke={c.ink2} strokeWidth="1.5" />
        </svg>
        <figcaption className="mt-1 text-[12.5px] text-ink-2">Tilt <span className="font-semibold text-ink num">{fmt(el, 1)}°</span></figcaption>
      </figure>
    </div>
  );
}

function JogButton({ icon, label, onClick, disabled, className = "" }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`grid place-items-center rounded-xl border border-line-strong bg-surface text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[.94] disabled:opacity-35 ${className}`}>
      <Icon name={icon} className="size-5" strokeWidth={2} />
    </button>
  );
}

export default function Control({ onLogin }) {
  const { cfg, live, control, cmd, send, canControl, kind } = useTelemetry();
  const { status } = useDeviceStatus();
  const { c } = useTheme();
  const lim = useLimits(cfg);
  const [step, setStep] = useState(5);
  const [log, setLog] = useState([]);
  const seq = useRef(0);

  /* keep the newest log entry in step with the command state */
  useEffect(() => {
    if (cmd.state === "idle") return;
    setLog(l => {
      if (!l.length) return l;
      const head = { ...l[0], state: cmd.state, msg: cmd.msg };
      /* the device applies commands in order: once a newer one is confirmed, older ones went through too */
      const rest = cmd.state === "confirmed"
        ? l.slice(1).map(e => (e.state === "sent" || e.state === "sending" || e.state === "timeout" ? { ...e, state: "confirmed" } : e))
        : l.slice(1);
      return [head, ...rest];
    });
  }, [cmd.state, cmd.msg]);

  const run = (patch, label) => {
    const t = new Date();
    setLog(l => [{ k: ++seq.current, label, state: "sending", time: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...l].slice(0, 6));
    send(patch, label);
  };

  const manual = control.mode === "manual";
  const locked = !canControl;
  const jogEnabled = manual && !control.estop && !locked;
  const baseAz = manual && control.targetAz != null ? control.targetAz : live?.az ?? cfg.home.az;
  const baseEl = manual && control.targetEl != null ? control.targetEl : live?.el ?? cfg.home.el;

  const setMode = m => {
    if (m === control.mode) return;
    if (m === "manual") run({ mode: "manual", target_az: r1(live?.az ?? baseAz), target_el: r1(live?.el ?? baseEl) }, "Switch to manual");
    else run({ mode: "auto" }, "Switch to automatic tracking");
  };
  const jog = (dAz, dEl, dir) => {
    const az = r1(lim.az(baseAz + dAz)), el = r1(lim.el(baseEl + dEl));
    run({ mode: "manual", target_az: az, target_el: el }, `${dir} ${step}° → ${fmt(az, 1)}° / ${fmt(el, 1)}°`);
  };
  const stop = () => run({ mode: "manual", target_az: r1(live?.az ?? baseAz), target_el: r1(live?.el ?? baseEl) }, "Stop and hold");
  const preset = p => run({ mode: "manual", target_az: p.az, target_el: p.el }, `${p.name} → ${fmt(p.az, 1)}° / ${fmt(p.el, 1)}°`);
  const estop = on => run({ estop: on }, on ? "Emergency stop" : "Release emergency stop");

  const busy = cmd.state === "sending" || cmd.state === "sent";

  return (
    <>
      <PageHeader title="Control"
        desc="In automatic mode the light sensors steer the panel and manual buttons stay locked. Switch to manual to move it yourself for testing, cleaning or stowing it flat before strong wind." />

      <div className="mb-5 space-y-3 empty:hidden">
        {locked && (
          <Notice icon="lock" action={<button className="btn btn-primary h-8 px-3" onClick={onLogin}>Sign in</button>}>
            Anyone can watch the readings. Sign in as an operator to move the panel.
          </Notice>
        )}
        {kind === "firebase" && status !== "online" && !locked && (
          <Notice tone="crit" icon="alert">The device is {status}. Commands will be saved and applied when it reconnects.</Notice>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel i={1} title="Manual control" meta="Mode, step size and direction"
          actions={<span data-tour="mode"><Segmented label="Tracking mode" value={control.mode} onChange={setMode} disabled={locked || control.estop}
            options={[["auto", "Automatic"], ["manual", "Manual"]]} /></span>}>
          <p className="min-h-10 text-[13.5px] leading-relaxed text-ink-2" aria-live="polite">
            {control.estop ? "Emergency stop is active. The motors stay off until it is released."
              : manual ? "Manual control is on. Each press moves the panel by the selected step."
                : "The sensors are steering the panel. Switch to manual to use the buttons."}
          </p>

          <div className="mt-5 grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="mx-auto grid grid-cols-[repeat(3,60px)] grid-rows-[repeat(3,60px)] gap-2">
              <JogButton icon="up" label="Tilt up" className="col-start-2 row-start-1" disabled={!jogEnabled} onClick={() => jog(0, step, "Up")} />
              <JogButton icon="left" label="Turn left (azimuth −)" className="col-start-1 row-start-2" disabled={!jogEnabled} onClick={() => jog(-step, 0, "Left")} />
              <button onClick={stop} disabled={!jogEnabled} aria-label="Stop and hold position" title="Stop and hold"
                className="col-start-2 row-start-2 grid place-items-center rounded-xl bg-primary text-[11px] font-semibold tracking-wide text-on-primary transition-transform active:scale-[.94] disabled:opacity-35">
                STOP
              </button>
              <JogButton icon="right" label="Turn right (azimuth +)" className="col-start-3 row-start-2" disabled={!jogEnabled} onClick={() => jog(step, 0, "Right")} />
              <JogButton icon="down" label="Tilt down" className="col-start-2 row-start-3" disabled={!jogEnabled} onClick={() => jog(0, -step, "Down")} />
            </div>

            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[12.5px] text-ink-2">Step per press</div>
                <Segmented label="Step size" value={step} onChange={setStep} options={[[1, "1°"], [5, "5°"], [15, "15°"]]} />
              </div>
              <KV rows={[
                ["Panel now", live ? `${fmt(live.az, 1)}° / ${fmt(live.el, 1)}°` : "--"],
                ["Target", manual && control.targetAz != null ? `${fmt(control.targetAz, 1)}° / ${fmt(control.targetEl, 1)}°` : "Following the sun"],
                ["Range", `az ${cfg.limits.azMin}–${cfg.limits.azMax}° · tilt ${cfg.limits.elMin}–${cfg.limits.elMax}°`]
              ]} />
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-3 flex items-center justify-between text-[12.5px]">
              <span className="font-medium text-ink-2">Live position</span>
              <span className="flex items-center gap-3 text-muted">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-s1" />Panel</span>
                {manual && <span className="flex items-center gap-1.5"><span className="h-0 w-3 border-t-2 border-dashed border-sun" />Target</span>}
              </span>
            </div>
            <PoseDials c={c} az={live?.az} el={live?.el}
              targetAz={manual ? control.targetAz : null} targetEl={manual ? control.targetEl : null} />
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink-2">Recent commands</span>
              <div className="relative h-0.5 w-20 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                {busy && <span className="indeterminate absolute inset-y-0 left-0 w-1/3 rounded-full bg-s1" />}
              </div>
            </div>
            {log.length === 0 ? <p className="py-2 text-[13px] text-muted">No commands sent yet.</p> : (
              <ul className="divide-y divide-line" aria-live="polite">
                {log.map(e => {
                  const [tone, text] = STATE[e.state] || ["idle", e.state];
                  return (
                    <li key={e.k} className="fade-in flex items-center justify-between gap-3 py-2 text-[13px]">
                      <span className="min-w-0 truncate"><span className="mr-2 text-muted num">{e.time}</span>{e.label}</span>
                      <Status tone={tone} live={e.state === "sent"} className="shrink-0 text-[12.5px]">{text}{e.msg ? `: ${e.msg}` : ""}</Status>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel i={2} tour="estop" title="Emergency stop" meta="Cuts power to both motors at once"
            className={control.estop ? "!border-crit-line" : ""}
            actions={control.estop ? <Status tone="crit" live>Stopped</Status> : <Status tone="good">Ready</Status>}>
            {control.estop ? (
              <div className="space-y-3">
                <p className="text-[13.5px] text-crit-ink">Motors are off. Tracking stays off until an operator releases the stop.</p>
                <button onClick={() => estop(false)} disabled={locked} className="btn btn-secondary h-11 w-full text-[14px]">
                  <Icon name="power" /> Release and resume
                </button>
              </div>
            ) : (
              <button onClick={() => estop(true)} disabled={locked}
                className="btn h-14 w-full rounded-xl bg-crit text-[15px] font-semibold tracking-wide text-white hover:brightness-110">
                <Icon name="alert" className="size-5" /> Emergency stop
              </button>
            )}
          </Panel>

          <Panel i={3} title="Presets" meta="One press moves the panel and switches to manual" bodyClass="p-2">
            {presetList(cfg, live).map(p => (
              <button key={p.id} onClick={() => preset(p)} disabled={locked || control.estop}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-hover disabled:opacity-40">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-subtle text-ink-2"><Icon name={p.icon} className="size-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">{p.name}</span>
                  <span className="block truncate text-[12.5px] text-muted">{p.note}</span>
                </span>
                <span className="text-right text-[12.5px] text-ink-2 num">{fmt(p.az, 1)}°<br /><span className="text-muted">{fmt(p.el, 1)}°</span></span>
                <Icon name="chevronRight" className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
