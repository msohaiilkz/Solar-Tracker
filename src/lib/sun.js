/* Solar position + weather formulas (pure functions, no React) */

export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const c2f = c => c * 9 / 5 + 32;
const f2c = f => (f - 32) * 5 / 9;

/* Site-local day-of-year and minutes (independent of the viewer's timezone) */
export function siteNow(site, date) {
  const shifted = new Date((date ? date.getTime() : Date.now()) + site.tzHours * 3600e3);
  const y = shifted.getUTCFullYear();
  const doy = Math.round((Date.UTC(y, shifted.getUTCMonth(), shifted.getUTCDate()) - Date.UTC(y, 0, 0)) / 86400e3);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes() + shifted.getUTCSeconds() / 60;
  return { doy, minutes };
}

function eqOfTime(doy) {
  const B = 2 * Math.PI * (doy - 81) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
}
function declination(doy) {
  return 23.45 * Math.sin(rad(360 * (284 + doy) / 365));
}

/* Sun azimuth (0 = North, clockwise) and elevation (deg above horizon) */
export function sunPosition(site, doy, localMin) {
  const decl = declination(doy);
  const solarMin = localMin + 4 * (site.lon - 15 * site.tzHours) + eqOfTime(doy);
  const H = rad((solarMin / 60 - 12) * 15);
  const lat = rad(site.lat), d = rad(decl);
  const sinEl = Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(H);
  const el = deg(Math.asin(clamp(sinEl, -1, 1)));
  let az = deg(Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(d) * Math.cos(lat))) + 180;
  az = (az + 360) % 360;
  return { az, el };
}

/* Sunrise / solar noon / sunset in site-local minutes */
export function dayTimes(site, doy) {
  const noon = 720 - 4 * (site.lon - 15 * site.tzHours) - eqOfTime(doy);
  const lat = rad(site.lat), d = rad(declination(doy));
  const cosH0 = (Math.sin(rad(-0.833)) - Math.sin(lat) * Math.sin(d)) / (Math.cos(lat) * Math.cos(d));
  const H0 = deg(Math.acos(clamp(cosH0, -1, 1)));
  return { sunrise: noon - 4 * H0, noon, sunset: noon + 4 * H0 };
}

/* Panel normal from azimuth + tilt (tilt 0 = flat facing the sky) */
export function panelNormal(az, tilt) {
  const pe = rad(90 - tilt), a = rad(az);
  return [Math.cos(pe) * Math.sin(a), Math.cos(pe) * Math.cos(a), Math.sin(pe)];
}
export function sunVector(az, el) {
  const e = rad(el), a = rad(az);
  return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
}
/* Angle between the panel normal and the sun ray (0° = perfectly aligned) */
export function incidence(panelAz, panelTilt, sunAz, sunEl) {
  const n = panelNormal(panelAz, panelTilt), s = sunVector(sunAz, sunEl);
  return deg(Math.acos(clamp(n[0] * s[0] + n[1] * s[1] + n[2] * s[2], -1, 1)));
}

/* US NWS heat index (same formula the DHT library uses) */
export function heatIndexC(tC, rh) {
  const T = c2f(tC);
  let hi = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094);
  if ((hi + T) / 2 >= 80) {
    hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh
      - 0.00683783 * T * T - 0.05481717 * rh * rh + 0.00122874 * T * T * rh
      + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
    if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
    else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5);
  }
  return f2c(hi);
}

/* Magnus formula */
export function dewPointC(tC, rh) {
  const a = 17.62, b = 243.12;
  const g = Math.log(Math.max(rh, 1) / 100) + a * tC / (b + tC);
  return b * g / (a - g);
}

export function fmtClock(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
