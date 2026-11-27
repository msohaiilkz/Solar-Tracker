/* Solar outlook (3-day forecast, next 24 h) and panel health */
import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon.jsx";
import { Panel, Num, Status } from "./ui.jsx";
import { fmt } from "../lib/params.js";
import { fetchForecast, summarize, skyIcon } from "../lib/forecast.js";
import { panelHealth, healthLabel } from "../lib/health.js";
import { useTelemetry } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";

function dayName(date, i) {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });
}

function HealthRing({ pct, c, tone }) {
  const r = 30, len = 2 * Math.PI * r;
  const col = { good: c.good, warn: "#fab219", crit: c.crit, idle: c.axis }[tone];
  return (
    <svg viewBox="0 0 72 72" className="size-[72px] -rotate-90" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke={c.grid} strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - (pct ?? 0) / 100)} className="transition-[stroke-dashoffset] duration-1000 ease-out-soft" />
    </svg>
  );
}

export default function Forecast({ i = 6 }) {
  const { cfg, history } = useTelemetry();
  const { c } = useTheme();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    fetchForecast(cfg)
      .then(d => alive && setState({ data: summarize(d, cfg.panel?.ratedW ?? 20) }))
      .catch(e => alive && setState({ error: e.message || "Forecast unavailable" }));
    return () => { alive = false; };
  }, [cfg]);

  const health = useMemo(() => panelHealth(history), [history]);
  const [tone, label, note] = healthLabel(health.pct);

  /* next 24 hours from the current hour */
  const next = useMemo(() => {
    if (!state.data) return [];
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}`;
    const start = Math.max(0, state.data.hours.findIndex(h => h.time.startsWith(key)));
    return state.data.hours.slice(start, start + 24);
  }, [state.data]);
  const maxW = Math.max(1, ...next.map(h => h.tracker));

  return (
    <Panel i={i} title="Solar outlook" meta="Forecast energy for this panel and how healthy it looks"
      actions={<a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="text-[11.5px] text-muted hover:text-ink">Weather data by Open-Meteo</a>}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {state.loading && <div className="grid h-[180px] place-items-center text-sm text-muted">Loading forecast…</div>}
          {state.error && (
            <div className="grid h-[180px] place-items-center text-center text-[13px] text-muted">
              <div><Icon name="cloud" className="mx-auto mb-2 size-6" />Forecast needs an internet connection.<br /><span className="text-[12px]">{state.error}</span></div>
            </div>
          )}
          {state.data && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {state.data.days.map((d, k) => {
                  const [icon, sky] = skyIcon(d.cloud);
                  return (
                    <div key={d.date} className="group rounded-xl border border-line bg-subtle/40 p-4 transition-colors hover:border-line-strong">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium">{dayName(d.date, k)}</span>
                        <span className="grid size-9 place-items-center rounded-xl bg-sun/14 text-sun-ink transition-transform duration-500 group-hover:rotate-12">
                          <Icon name={icon} className="size-5" />
                        </span>
                      </div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em]"><Num value={d.whTracker} digits={0} /><span className="ml-1 text-[13px] font-medium text-muted">Wh</span></div>
                      <div className="text-[12px] text-muted">expected · fixed {fmt(d.whFixed, 0)} Wh</div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
                        <span>{sky}</span><span>{fmt(d.sunHours, 1)} h sun</span><span>{fmt(d.tmax, 0)}°C</span>
                      </div>
                      {d.gain != null && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-good/12 px-2 py-0.5 text-[11.5px] font-medium text-good-ink"><Icon name="trendUp" className="size-3" />+{fmt(d.gain, 0)}% vs fixed</div>}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
                  <span>Next 24 hours · expected power</span><span>peak {fmt(maxW, 1)} W</span>
                </div>
                <div className="flex h-20 items-end gap-[3px]" role="img" aria-label="Expected power for the next 24 hours">
                  {next.map(h => (
                    <div key={h.time} className="group relative flex-1">
                      <div className="rounded-t-[3px] bg-s1/80 transition-[height] duration-700 ease-out-soft group-hover:bg-s1"
                        style={{ height: `${Math.max(2, (h.tracker / maxW) * 80)}px`, opacity: h.tracker > 0.05 ? 1 : 0.25 }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[11px] text-on-primary group-hover:block">
                        {String(h.hour).padStart(2, "0")}:00 · {fmt(h.tracker, 1)} W · {h.cloud}% cloud
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted num">
                  {next.filter((_, k) => k % 6 === 0).map(h => <span key={h.time}>{String(h.hour).padStart(2, "0")}:00</span>)}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col justify-center gap-1 rounded-xl border border-line bg-subtle/40 p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <HealthRing pct={health.pct} c={c} tone={tone} />
              <span className="absolute inset-0 grid place-items-center text-[15px] font-semibold num">{health.pct != null ? `${Math.round(health.pct)}%` : "--"}</span>
            </div>
            <div>
              <div className="text-[12.5px] text-ink-2">Panel health</div>
              <div className="mt-0.5"><Status tone={tone} live={tone === "crit"} className="text-[15px]">{label}</Status></div>
              <div className="mt-1 text-[12px] text-muted">{note}</div>
            </div>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            Compares watts per thousand lux with the panel's best this session{health.wPerKlux != null ? ` (now ${fmt(health.wPerKlux, 3)} W/klux)` : ""}. If it drops while the sun is strong, the panel is probably dusty or shaded.
          </p>
        </div>
      </div>
    </Panel>
  );
}
