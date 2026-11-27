/* CSV / JSON export of the readings currently loaded in the dashboard */
import { PARAMS } from "./params.js";

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function exportCsv(rows, deviceId) {
  const head = ["timestamp_iso", "time", "mode", "azimuth_deg", "elevation_deg",
    ...PARAMS.map(p => p.key), "ldr_north", "ldr_south", "ldr_east", "ldr_west", "rssi_dbm"];
  const cell = v => (v == null ? "" : String(v));
  const lines = rows.map(r => [
    new Date(r.ts * 1000).toISOString(), r.label, r.mode, r.az, r.el,
    ...PARAMS.map(p => r.t[p.key]),
    r.ldr.north, r.ldr.south, r.ldr.east, r.ldr.west, r.rssi
  ].map(cell).join(","));
  download(`${deviceId}-${stamp()}.csv`, [head.join(","), ...lines].join("\n"), "text/csv");
}

export function exportJson(rows, deviceId) {
  const data = rows.map(r => ({
    ts: r.ts, time: r.label, device_id: r.deviceId, mode: r.mode,
    azimuth_deg: r.az, elevation_deg: r.el,
    telemetry: r.t, ldr_sensors: r.ldr, rssi_dbm: r.rssi
  }));
  download(`${deviceId}-${stamp()}.json`, JSON.stringify({ device_id: deviceId, exported_at: new Date().toISOString(), count: data.length, readings: data }, null, 2), "application/json");
}
