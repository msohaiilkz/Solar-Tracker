/* Values calculated on the website from a reading (not sent by the device) */
import { sunPosition, incidence, dayTimes } from "./sun.js";

export function derive(r, cfg) {
  if (!r) return null;
  const sun = sunPosition(cfg.site, r.doy, r.minutes);
  const day = dayTimes(cfg.site, r.doy);
  const hasPose = r.az != null && r.el != null;
  const theta = hasPose && sun.el > 0 ? incidence(r.az, r.el, sun.az, sun.el) : null;
  return {
    sun,
    day,
    isDay: sun.el > 0,
    idealTilt: Math.max(0, 90 - sun.el),      // tilt that faces the sun directly
    theta,                                     // angle between panel normal and sun
    cosFactor: theta == null ? null : Math.max(0, Math.cos(theta * Math.PI / 180)) * 100
  };
}

/* Direction the LDR matrix wants to move, using the firmware's deadband logic */
export function ldrDecision(ldr, deadband) {
  const { north, south, east, west } = ldr || {};
  if ([north, south, east, west].some(v => v == null)) return null;
  const dEW = west - east, dNS = north - south;
  const az = Math.abs(dEW) > deadband ? (dEW > 0 ? "WEST" : "EAST") : null;
  const el = Math.abs(dNS) > deadband ? (dNS > 0 ? "UP" : "DOWN") : null;
  return { dEW, dNS, az, el, balanced: !az && !el, peak: Math.max(north, south, east, west) };
}
