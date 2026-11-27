/* Turn any incoming payload (live or history, demo or ESP32) into one clean
   shape. Strings like "25.45" are parsed to floats; missing values become null. */
import { PARAMS } from "./params.js";
import { siteNow, fmtClock } from "./sun.js";

const num = v => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export function normalize(raw, cfg) {
  if (!raw || typeof raw !== "object") return null;
  let ts = num(raw.ts);
  if (ts == null) ts = Date.now() / 1000;
  if (ts > 1e12) ts /= 1000;            // milliseconds -> seconds

  const src = raw.telemetry || raw;     // history entries may be flat
  const t = {};
  PARAMS.forEach(p => { t[p.key] = num(src[p.key]); });

  const l = raw.ldr_sensors || {};
  const ldr = { north: num(l.north), south: num(l.south), east: num(l.east), west: num(l.west) };

  const sim = num(raw.sim_minutes);
  const local = siteNow(cfg.site, new Date(ts * 1000));
  const minutes = sim != null ? sim : local.minutes;
  const doy = num(raw.sim_doy) ?? local.doy;

  return {
    ts,
    label: fmtClock(minutes),
    minutes,
    doy,
    simulated: sim != null,
    deviceId: raw.device_id || cfg.deviceId,
    mode: raw.mode === "manual" ? "manual" : "auto",
    az: num(raw.azimuth_deg),
    el: num(raw.elevation_deg),
    t,
    ldr,
    rssi: num(raw.rssi_dbm),
    estop: raw.estop === true,
    lastCmdId: num(raw.last_cmd_id)
  };
}
