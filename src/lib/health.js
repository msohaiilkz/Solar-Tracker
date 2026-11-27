/* Panel health: watts produced per thousand lux, compared with the best this panel
   has managed in this session. A clean, sun-facing panel stays near 100 %; dust,
   shade or a fault pulls it down. Only bright readings are used. */
const BRIGHT_LUX = 30000;

const median = a => {
  const s = [...a].sort((x, y) => x - y), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function panelHealth(history) {
  const idx = history
    .filter(r => r.t.power_mw != null && r.t.light_intensity_lux != null && r.t.light_intensity_lux > BRIGHT_LUX)
    .map(r => (r.t.power_mw / 1000) / (r.t.light_intensity_lux / 1000));
  if (idx.length < 8) return { pct: null, samples: idx.length };
  const sorted = [...idx].sort((a, b) => a - b);
  const best = sorted[Math.floor(sorted.length * 0.9)];           // 90th percentile = clean baseline
  const now = median(idx.slice(-6));
  const pct = best > 0 ? Math.min(100, (now / best) * 100) : null;
  return { pct, samples: idx.length, wPerKlux: now };
}

export function healthLabel(pct) {
  if (pct == null) return ["idle", "Learning", "Needs a few bright readings"];
  if (pct >= 88) return ["good", "Clean", "Output matches the light"];
  if (pct >= 75) return ["warn", "Check soon", "Output a little low for the light"];
  return ["crit", "Clean the panel", "Low output for this much sunlight: dust, shade or a fault"];
}
