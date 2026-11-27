/* Tracker vs fixed panel.
   A fixed panel faces south (north in the southern hemisphere), tilted at the
   site latitude: the usual fixed installation. For every reading we know the
   sun's position and the tracker's pose, so the fixed panel's output is
   estimated from the measured power, scaled by the ratio of the cosine of the
   two incidence angles. It is an estimate (direct sunlight only). */
import { sunPosition, incidence, rad } from "./sun.js";

export function fixedPose(cfg) {
  return { az: cfg.site.lat >= 0 ? 180 : 0, tilt: Math.round(Math.abs(cfg.site.lat)) };
}

const cosd = d => Math.max(0, Math.cos(rad(d)));
const MAX_GAP_H = 0.25;
export const MIN_SPAN_H = 2;            // ignore gaps longer than 15 min when adding up energy

export function trackerVsFixed(rows, cfg) {
  const f = fixedPose(cfg);
  const series = [];
  const hours = new Map();
  let whTracker = 0, whFixed = 0, spanH = 0;

  rows.forEach((r, i) => {
    const p = r.t.power_mw != null ? r.t.power_mw / 1000 : null;
    let fixed = null;
    if (p != null) {
      const sun = sunPosition(cfg.site, r.doy, r.minutes);
      if (sun.el <= 0) fixed = 0;
      else {
        const cf = cosd(incidence(f.az, f.tilt, sun.az, sun.el));
        const ct = r.az != null && r.el != null ? Math.max(0.2, cosd(incidence(r.az, r.el, sun.az, sun.el))) : 1;
        fixed = Math.min(p, (p * cf) / ct);
      }
    }
    series.push({ label: r.label, tracker: p, fixed });

    const prev = rows[i - 1];
    const pp = series[i - 1];
    if (!prev || p == null || pp?.tracker == null) return;
    const dtH = r.simulated ? (r.minutes - prev.minutes) / 60 : (r.ts - prev.ts) / 3600;
    if (dtH <= 0 || dtH > MAX_GAP_H) return;
    const eT = ((p + pp.tracker) / 2) * dtH;                   // trapezoid rule
    const eF = (((fixed ?? 0) + (pp.fixed ?? 0)) / 2) * dtH;
    whTracker += eT;
    whFixed += eF;
    spanH += dtH;
    const h = Math.floor(r.minutes / 60);
    const key = `${r.doy}-${h}`;
    const slot = hours.get(key) || { label: `${String(h).padStart(2, "0")}:00`, tracker: 0, fixed: 0 };
    slot.tracker += eT;
    slot.fixed += eF;
    hours.set(key, slot);
  });

  return {
    series,
    hourly: [...hours.values()].slice(-24),
    whTracker,
    whFixed,
    spanH,
    /* a few morning readings would exaggerate the gain, so wait for 2 hours of data */
    gain: whFixed > 0.001 && spanH >= MIN_SPAN_H ? (whTracker / whFixed - 1) * 100 : null,
    fixed: f
  };
}

/* Clear-sky model for a whole day: how much more direct sunlight a perfect
   dual-axis tracker collects than the fixed panel. Uses the Meinel air-mass
   model for direct irradiance. Returns a percentage. */
export function modelDayGain(cfg, doy) {
  const f = fixedPose(cfg);
  let tracker = 0, fixed = 0;
  for (let m = 0; m < 24 * 60; m += 5) {
    const s = sunPosition(cfg.site, doy, m);
    if (s.el <= 1) continue;
    const am = 1 / (Math.sin(rad(s.el)) + 0.50572 * Math.pow(s.el + 6.07995, -1.6364));
    const dni = 1000 * Math.pow(0.7, Math.pow(am, 0.678));
    tracker += dni;
    fixed += dni * cosd(incidence(f.az, f.tilt, s.az, s.el));
  }
  return fixed > 0 ? (tracker / fixed - 1) * 100 : null;
}
