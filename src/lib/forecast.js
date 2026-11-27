/* Solar forecast from Open-Meteo (free, no key). Expected energy for the tracker
   (direct-normal + diffuse light) and for a fixed panel (tilted irradiance at the
   site latitude, facing the equator). Cached for an hour. */
const CACHE = "sunflower-forecast-v1";
const MAX_AGE = 60 * 60 * 1000;
const LOSS = 0.85;   // wiring, heat and conversion losses

export async function fetchForecast(cfg) {
  try {
    const hit = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (hit && Date.now() - hit.at < MAX_AGE && hit.lat === cfg.site.lat) return hit.data;
  } catch { /* ignore */ }

  const tilt = Math.round(Math.abs(cfg.site.lat));
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: cfg.site.lat, longitude: cfg.site.lon,
    hourly: "direct_normal_irradiance,diffuse_radiation,global_tilted_irradiance,cloud_cover,temperature_2m",
    daily: "sunshine_duration,cloud_cover_mean,temperature_2m_max",
    tilt, azimuth: cfg.site.lat >= 0 ? 0 : 180,      // Open-Meteo: 0 = facing the equator (south here)
    timezone: "auto", forecast_days: 3
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast unavailable (${res.status})`);
  const data = await res.json();
  try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), lat: cfg.site.lat, data })); } catch { /* ignore */ }
  return data;
}

export function summarize(data, ratedW) {
  const h = data.hourly;
  const hours = h.time.map((t, i) => {
    const tracker = ((h.direct_normal_irradiance[i] ?? 0) + (h.diffuse_radiation[i] ?? 0)) / 1000 * ratedW * LOSS;
    const fixed = (h.global_tilted_irradiance[i] ?? 0) / 1000 * ratedW * LOSS;
    return { time: t, date: t.slice(0, 10), hour: +t.slice(11, 13), tracker, fixed, cloud: h.cloud_cover[i], temp: h.temperature_2m[i] };
  });
  const days = data.daily.time.map((date, i) => {
    const hs = hours.filter(x => x.date === date);
    const whT = hs.reduce((s, x) => s + x.tracker, 0), whF = hs.reduce((s, x) => s + x.fixed, 0);
    return {
      date, whTracker: whT, whFixed: whF,
      gain: whF > 0 ? (whT / whF - 1) * 100 : null,
      sunHours: (data.daily.sunshine_duration[i] ?? 0) / 3600,
      cloud: data.daily.cloud_cover_mean[i], tmax: data.daily.temperature_2m_max[i]
    };
  });
  return { hours, days };
}

export function skyIcon(cloud) {
  if (cloud == null) return ["sun", "--"];
  if (cloud < 25) return ["sun", "Sunny"];
  if (cloud < 60) return ["cloudSun", "Partly cloudy"];
  return ["cloud", "Cloudy"];
}
