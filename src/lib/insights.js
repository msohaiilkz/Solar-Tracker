/* Plain-language findings worked out from the readings: peak output, heat loss,
   how well the panel followed the sun, how closely power follows light, the best
   hour, and data gaps. Each insight is { icon, tone, title, text }. */
import { fmt } from "./params.js";
import { sunPosition, incidence } from "./sun.js";
import { trackerVsFixed } from "./energy.js";

const TEMP_COEFF = 0.4;   // % of output lost per °C above 25 °C (typical silicon panel)

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

export function insights(history, cfg) {
  const out = [];
  const rows = history.filter(r => r.t.power_mw != null);
  if (rows.length < 5) return out;
  const W = r => r.t.power_mw / 1000;

  /* peak */
  const peak = rows.reduce((m, r) => (W(r) > W(m) ? r : m), rows[0]);
  out.push({ icon: "bolt", tone: "sun", title: `Peak ${fmt(W(peak), 2)} W at ${peak.label}`,
    text: `The highest output in these ${rows.length} readings, with ${fmt((peak.t.light_intensity_lux ?? 0) / 1000, 1)} klux of light.` });

  /* energy and gain */
  const cmp = trackerVsFixed(history, cfg);
  if (cmp.whTracker > 0.05) {
    out.push({ icon: "battery", tone: "good", title: `${fmt(cmp.whTracker, 1)} Wh collected`,
      text: cmp.gain != null
        ? `A panel fixed at ${cmp.fixed.tilt}° facing south would have made about ${fmt(cmp.whFixed, 1)} Wh, so tracking gave +${fmt(cmp.gain, 0)}%.`
        : `Over ${fmt(cmp.spanH, 1)} h of readings. The comparison with a fixed panel appears after 2 hours.` });
  }

  /* best hour */
  if (cmp.hourly.length > 1) {
    const best = cmp.hourly.reduce((m, h) => (h.tracker > m.tracker ? h : m), cmp.hourly[0]);
    const end = String((+best.label.slice(0, 2) + 1) % 24).padStart(2, "0") + ":00";
    out.push({ icon: "clock", tone: "info", title: `Best hour ${best.label} to ${end}`,
      text: `${fmt(best.tracker, 1)} Wh in that hour, the most of any hour in this data.` });
  }

  /* heat loss */
  const bright = rows.filter(r => (r.t.light_intensity_lux ?? 0) > 30000 && r.t.panel_temp_c != null);
  if (bright.length >= 3) {
    const tp = bright.reduce((s, r) => s + r.t.panel_temp_c, 0) / bright.length;
    const loss = Math.max(0, (tp - 25) * TEMP_COEFF);
    out.push({ icon: "thermo", tone: loss > 10 ? "warn" : "info", title: `Heat cost about ${fmt(loss, 0)}% of output`,
      text: `In strong sun the panel averaged ${fmt(tp, 1)} °C. Silicon panels lose roughly ${TEMP_COEFF}% per °C above 25 °C, so cooling or airflow behind the panel would help.` });
  }

  /* tracking accuracy */
  const day = rows.filter(r => r.az != null && r.el != null).map(r => {
    const s = sunPosition(cfg.site, r.doy, r.minutes);
    return s.el > 5 ? incidence(r.az, r.el, s.az, s.el) : null;
  }).filter(v => v != null);
  if (day.length >= 5) {
    const within = (day.filter(v => v <= 5).length / day.length) * 100;
    const avg = day.reduce((a, b) => a + b, 0) / day.length;
    out.push({ icon: "compass", tone: within >= 80 ? "good" : "warn", title: `Facing the sun ${fmt(within, 0)}% of the time`,
      text: `Within 5° of the sun in ${day.filter(v => v <= 5).length} of ${day.length} daytime readings. Average error ${fmt(avg, 1)}°.` });
  }

  /* power follows light */
  const pairs = rows.filter(r => r.t.light_intensity_lux != null);
  const r = pearson(pairs.map(p => p.t.light_intensity_lux), pairs.map(W));
  if (r != null) {
    out.push({ icon: "sun", tone: r > 0.8 ? "good" : "warn", title: r > 0.8 ? "Power follows the light closely" : "Power and light disagree",
      text: `Correlation between sunlight and power is ${fmt(r, 2)} (1.00 is a perfect match).${r <= 0.8 ? " Shade, dust or a wiring fault can cause this." : ""}` });
  }

  /* data gaps */
  const gaps = [];
  for (let i = 1; i < history.length; i++) {
    const g = history[i].simulated ? (history[i].minutes - history[i - 1].minutes) * 60 : history[i].ts - history[i - 1].ts;
    if (g > 0) gaps.push(g);
  }
  if (gaps.length > 4) {
    const big = Math.max(...gaps);
    const typical = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    if (big > typical * 6 && big > 120) {
      out.push({ icon: "wifi", tone: "warn", title: `A ${fmt(big / 60, 0)}-minute gap in the data`,
        text: "The device stopped sending for a while. Wi-Fi drops or a power cut are the usual reasons." });
    }
  }
  return out;
}
