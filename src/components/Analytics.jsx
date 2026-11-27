import { useEffect, useMemo, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import Icon from "./Icon.jsx";
import { PageHeader, Panel, Segmented } from "./ui.jsx";
import { fmt } from "../lib/params.js";
import { lineOptions, series, barOptions, bars } from "../lib/chart.js";
import { trackerVsFixed } from "../lib/energy.js";
import { printReport } from "../lib/print.js";
import { insights } from "../lib/insights.js";
import { exportCsv, exportJson } from "../lib/exporters.js";
import { useTelemetry } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";

const W = r => (r.t.power_mw != null ? r.t.power_mw / 1000 : null);
const KLX = r => (r.t.light_intensity_lux != null ? r.t.light_intensity_lux / 1000 : null);

function Stat({ label, value, unit, note, accent }) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="text-[12.5px] text-ink-2">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold tracking-[-0.02em] ${accent || ""}`}>{value}<span className="ml-1 text-[14px] font-medium text-muted">{unit}</span></div>
      {note && <div className="mt-0.5 text-[12px] text-muted">{note}</div>}
    </div>
  );
}

/* One "Export" button: Excel (CSV) for everyone, JSON for developers */
function ExportMenu({ disabled, onCsv, onJson }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!e.target.closest?.("[data-export]")) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const item = (icon, title, sub, run) => (
    <button onClick={() => { setOpen(false); run(); }} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-hover">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-subtle text-ink-2 ring-1 ring-line"><Icon name={icon} className="size-4" /></span>
      <span><span className="block text-[13.5px] font-medium">{title}</span><span className="block text-[12px] text-muted">{sub}</span></span>
    </button>
  );
  return (
    <div className="relative" data-export data-tour="export">
      <button className="btn btn-secondary h-8 px-3" disabled={disabled} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="menu">
        <Icon name="download" /> Export <Icon name="chevronDown" className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="pop-in absolute right-0 top-10 z-50 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-xl shadow-black/15">
          {item("sheet", "Excel (CSV)", "Open in Excel or Google Sheets", onCsv)}
          {item("code", "JSON", "Raw data for developers", onJson)}
        </div>
      )}
    </div>
  );
}

function ChartBox({ data, options }) {
  return <div className="h-[240px]">{data.labels.length > 1 ? <Line data={data} options={options} /> : <div className="grid h-full place-items-center text-sm text-muted">Collecting readings…</div>}</div>;
}

export default function Analytics() {
  const { history, cfg } = useTelemetry();
  const theme = useTheme();
  const { c } = theme;
  const [range, setRange] = useState(120);
  const [table, setTable] = useState(false);
  const rows = useMemo(() => (range === Infinity ? history : history.slice(-range)), [history, range]);
  const labels = rows.map(r => r.label);

  const power = useMemo(() => ({ labels, datasets: [series("Power", rows.map(W), c.s1, { fill: true })] }), [rows, c]); // eslint-disable-line react-hooks/exhaustive-deps
  const light = useMemo(() => ({ labels, datasets: [series("Light", rows.map(KLX), c.s1)] }), [rows, c]); // eslint-disable-line react-hooks/exhaustive-deps
  const temp = useMemo(() => ({
    labels,
    datasets: [series("Ambient air", rows.map(r => r.t.ambient_temp_c), c.s1), series("Panel", rows.map(r => r.t.panel_temp_c), c.s2)]
  }), [rows, c]); // eslint-disable-line react-hooks/exhaustive-deps

  const cmp = useMemo(() => trackerVsFixed(rows, cfg), [rows, cfg]);
  const cmpLine = useMemo(() => ({
    labels,
    datasets: [
      series("Sunflower tracker", cmp.series.map(x => x.tracker), c.s1, { fill: true }),
      { ...series(`Fixed panel (${cmp.fixed.tilt}° south)`, cmp.series.map(x => x.fixed), c.muted), borderDash: [5, 4], borderWidth: 1.75 }
    ]
  }), [cmp, c]); // eslint-disable-line react-hooks/exhaustive-deps
  const hourly = useMemo(() => ({
    labels: cmp.hourly.map(h => h.label),
    datasets: [bars("Sunflower tracker", cmp.hourly.map(h => h.tracker), c.s1), bars("Fixed panel", cmp.hourly.map(h => h.fixed), c.axis)]
  }), [cmp, c]);
  const notes = useMemo(() => insights(rows, cfg), [rows, cfg]);
  const oCmp = useMemo(() => lineOptions(c, { unit: "W", legend: true }), [c]);
  const oBar = useMemo(() => barOptions(c, { unit: "Wh" }), [c]);
  const oW = useMemo(() => lineOptions(c, { unit: "W" }), [c]);
  const oL = useMemo(() => lineOptions(c, { unit: "klux", digits: 1 }), [c]);
  const oT = useMemo(() => lineOptions(c, { unit: "°C", digits: 1, legend: true }), [c]);

  const peak = rows.reduce((m, r) => Math.max(m, W(r) ?? 0), 0);
  const maxPanel = rows.reduce((m, r) => Math.max(m, r.t.panel_temp_c ?? -Infinity), -Infinity);
  const both = rows.filter(r => r.t.panel_temp_c != null && r.t.ambient_temp_c != null);
  const rise = both.length ? both.reduce((s, r) => s + r.t.panel_temp_c - r.t.ambient_temp_c, 0) / both.length : null;

  return (
    <>
      <PageHeader title="Analytics"
        desc="How power follows the light, and how panel heat compares with the air around it. A hotter panel gives a little less voltage."
        actions={<>
          <Segmented label="Readings shown" value={range} onChange={setRange} options={[[30, "Last 30"], [120, "Last 120"], [Infinity, "All"]]} />
          <ExportMenu disabled={!history.length} onCsv={() => exportCsv(history, cfg.deviceId)} onJson={() => exportJson(history, cfg.deviceId)} />
          <button className="btn btn-primary h-8 px-3" onClick={() => printReport(theme)}><Icon name="printer" /> Report</button>
        </>} />

      <div className="mb-6 hidden border-b border-line pb-4 print:block">
        <div className="text-[20px] font-semibold">{cfg.project.name}: performance report</div>
        <div className="mt-1 text-[12.5px] text-ink-2">{cfg.project.title} · {cfg.project.university}</div>
        <div className="mt-1 text-[12.5px] text-muted">Device {cfg.deviceId} · {rows.length} readings · printed {new Date().toLocaleString()}</div>
      </div>

      <section className="panel reveal mb-5 grid grid-cols-2 gap-px overflow-hidden bg-line md:grid-cols-4" style={{ "--i": 1 }}>
        <Stat label="Energy collected" value={fmt(cmp.whTracker, 1)} unit="Wh" note={`${rows.length} readings`} />
        <Stat label="Gain over a fixed panel" value={cmp.gain != null ? `+${fmt(cmp.gain, 1)}` : "--"} unit="%" accent="text-good-ink"
          note={cmp.gain != null ? `Fixed would give ${fmt(cmp.whFixed, 1)} Wh` : `Needs 2 h of readings (${fmt(cmp.spanH, 1)} h so far)`} />
        <Stat label="Peak power" value={fmt(peak)} unit="W" note={`Hottest panel ${fmt(Number.isFinite(maxPanel) ? maxPanel : null, 1)} °C`} />
        <Stat label="Panel above air" value={rise != null ? `+${fmt(rise, 1)}` : "--"} unit="°C avg" note="Heat lowers voltage" />
      </section>

      {notes.length > 0 && (
        <Panel i={2} className="mb-5" title="Insights" meta="Worked out automatically from the readings shown" bodyClass="p-3">
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {notes.map(n => (
              <li key={n.title} className="flex gap-3 rounded-xl border border-line bg-subtle/40 p-3.5 transition-colors hover:border-line-strong">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${{ sun: "bg-sun/14 text-sun-ink", good: "bg-good/12 text-good-ink", warn: "bg-warn/15 text-warn-ink", info: "bg-s1/12 text-s1" }[n.tone]}`}>
                  <Icon name={n.icon} className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold leading-snug">{n.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-2">{n.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel i={2} title="Tracker vs fixed panel" meta={`Measured power against an estimate for a panel fixed at ${cmp.fixed.tilt}° facing south`}>
          <ChartBox data={cmpLine} options={oCmp} />
        </Panel>
        <Panel i={3} title="Energy per hour" meta="Watt-hours collected in each hour">
          <div className="h-[240px]">{hourly.labels.length ? <Bar data={hourly} options={oBar} /> : <div className="grid h-full place-items-center text-sm text-muted">Collecting readings…</div>}</div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel i={2} title="Power output" meta="Watts"><ChartBox data={power} options={oW} /></Panel>
        <Panel i={3} title="Light intensity" meta="Thousand lux"><ChartBox data={light} options={oL} /></Panel>
        <Panel i={4} className="xl:col-span-2" title="Panel and air temperature" meta="Degrees Celsius"><ChartBox data={temp} options={oT} /></Panel>
      </div>

      <div className="reveal mt-5 print:hidden" style={{ "--i": 5 }}>
        <button className="btn btn-quiet -ml-2 h-8 px-2" onClick={() => setTable(v => !v)} aria-expanded={table}>
          <Icon name="chevronRight" className={`size-4 transition-transform ${table ? "rotate-90" : ""}`} />
          {table ? "Hide" : "Show"} data table
        </button>
        {table && (
          <div className="panel fade-in mt-2 max-h-[420px] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-[13px] num">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-[12px] text-muted">
                  {["Time", "Power (W)", "Light (klux)", "Panel (°C)", "Air (°C)", "Azimuth (°)", "Tilt (°)"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 font-medium ${i ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice().reverse().map((r, i) => (
                  <tr key={i} className="hover:bg-subtle">
                    <td className="px-4 py-2 text-ink-2">{r.label}</td>
                    <td className="px-4 py-2 text-right">{fmt(W(r))}</td>
                    <td className="px-4 py-2 text-right">{fmt(KLX(r), 1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(r.t.panel_temp_c, 1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(r.t.ambient_temp_c, 1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(r.az, 1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(r.el, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
