import { memo, useState } from "react";
import { PageHeader, Panel, Num, Sparkline, Segmented, Status } from "./ui.jsx";
import { CARD_GROUPS, PARAM_BY_KEY, PARAMS, fmt } from "../lib/params.js";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";

const SENSOR = { weather: "DHT22", panel: "DS18B20 · BH1750", power: "INA219" };

const Cell = memo(function Cell({ card, value, alt, prev, values, color }) {
  const p = PARAM_BY_KEY[card.main];
  const altP = card.alt ? PARAM_BY_KEY[card.alt] : null;
  const altCalc = card.altCalc && value != null ? card.altCalc(value) : null;
  const delta = value != null && prev != null ? value - prev : null;
  const ids = altP ? `${String(p.n).padStart(2, "0")} · ${String(altP.n).padStart(2, "0")}` : String(p.n).padStart(2, "0");

  return (
    <div className="flex min-w-0 flex-col bg-surface px-5 pb-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] text-ink-2">{card.label}</span>
        <span className="font-mono text-[11px] text-muted" title="Parameter number in the specification">#{ids}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <Num value={value} className="text-[28px] font-semibold leading-none tracking-[-0.03em]" />
        <span className="text-[14px] font-medium text-muted">{p.unit}</span>
      </div>
      <div className="mt-1.5 flex min-h-[18px] items-center gap-3 text-[12.5px] num">
        {altP && <span className="text-ink-2">{fmt(alt)} {altP.unit}</span>}
        {altCalc && <span className="text-ink-2">{fmt(altCalc[0])} {altCalc[1]}</span>}
        {delta != null && Math.abs(delta) >= 0.005 && (
          <span className="text-muted">{delta > 0 ? "↑" : "↓"} {fmt(Math.abs(delta))}</span>
        )}
      </div>
      <div className="mt-auto pt-3"><Sparkline values={values} color={color} /></div>
    </div>
  );
});

function TableView({ live }) {
  return (
    <Panel i={1} bodyClass="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-muted">
            <th className="px-5 py-2.5 font-medium">#</th>
            <th className="px-3 py-2.5 font-medium">Parameter</th>
            <th className="px-3 py-2.5 text-right font-medium">Value</th>
            <th className="px-3 py-2.5 font-medium">Unit</th>
            <th className="px-3 py-2.5 font-medium">JSON key</th>
            <th className="px-5 py-2.5 font-medium">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {PARAMS.map(p => (
            <tr key={p.key} className="transition-colors hover:bg-subtle">
              <td className="px-5 py-2.5 font-mono text-[12px] text-muted">{String(p.n).padStart(2, "0")}</td>
              <td className="px-3 py-2.5">{p.label}</td>
              <td className="px-3 py-2.5 text-right font-medium num"><Num value={live?.t[p.key] ?? null} /></td>
              <td className="px-3 py-2.5 text-ink-2">{p.unit}</td>
              <td className="px-3 py-2.5 font-mono text-[12px] text-ink-2">{p.key}</td>
              <td className="px-5 py-2.5 font-mono text-[12px] text-muted">float</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export default function Telemetry() {
  const { live, history } = useTelemetry();
  const { status, age } = useDeviceStatus();
  const { c } = useTheme();
  const [view, setView] = useState("grid");
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const recent = history.slice(-40);
  const count = live ? PARAMS.filter(p => live.t[p.key] != null).length : 0;

  return (
    <>
      <PageHeader title="Telemetry"
        desc="All 16 readings from the device, each sent as a float with two decimals. Celsius and Fahrenheit pairs share a tile."
        actions={<>
          <span className="mr-1 text-[13px]">
            <Status tone={count === 16 ? "good" : "warn"}>{count} of 16 reporting</Status>
          </span>
          <Segmented label="View" value={view} onChange={setView} options={[["grid", "Tiles", "grid"], ["table", "Table", "table"]]} />
        </>} />

      {status === "offline" && (
        <p className="mb-4 text-[13px] text-crit-ink">No new data for {Math.round(age)} s. Showing the last values received.</p>
      )}

      {view === "table" ? <TableView live={live} /> : (
        <div className={`space-y-5 transition-opacity ${status === "offline" ? "opacity-60" : ""}`}>
          {CARD_GROUPS.map((g, gi) => (
            <Panel key={g.id} i={gi + 1} title={g.title} meta={SENSOR[g.id]} bodyClass="">
              <div className={`grid grid-cols-1 gap-px overflow-hidden rounded-b-xl bg-line sm:grid-cols-2 ${g.cards.length === 4 ? "xl:grid-cols-4" : g.cards.length === 6 ? "xl:grid-cols-3" : ""}`}>
                {g.cards.map(card => (
                  <Cell key={card.id} card={card} color={c.s1}
                    value={live?.t[card.main] ?? null}
                    alt={card.alt ? live?.t[card.alt] ?? null : null}
                    prev={prev?.t[card.main] ?? null}
                    values={recent.map(r => r.t[card.main])} />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
