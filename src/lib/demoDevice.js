/* =========================================================================
   Demo simulator — hardware connect na ho tab bhi dashboard chale.
   Ye bilkul wahi JSON banata hai jo ESP32 Firebase par bhejega, aur saari
   values physics formulas se aapas mein consistent hain
   (e.g. shunt mV = current mA × 0.1 Ω, power = load V × current).
   ========================================================================= */
import {
  clamp, rad, c2f, siteNow, sunPosition, dayTimes, sunVector, panelNormal,
  incidence, heatIndexC, dewPointC
} from "./sun.js";

const TICK_MS = 1500;     // real time between updates
const SIM_STEP_MIN = 2;   // simulated minutes per update (1 day ≈ 8 min)
const SLEW = 4;           // max degrees moved per update

const rand = (a, b) => a + Math.random() * (b - a);
const r2 = v => Math.round(v * 100) / 100;

export function createDemoDevice(cfg, onPayload) {
  const { site, limits: lim } = cfg;
  const now = siteNow(site);
  const today = dayTimes(site, now.doy);

  /* Real time if there's enough daylight left, otherwise start mid-morning */
  const startMin = (now.minutes > today.sunrise + 20 && now.minutes < today.sunset - 90) ? now.minutes : today.sunrise + 150;
  const startSun = sunPosition(site, now.doy, startMin);

  const st = {
    doy: now.doy,
    min: startMin,
    mode: "auto",
    az: clamp(startSun.az - 6, lim.azMin, lim.azMax),       // start close to the sun, slightly off
    tilt: clamp(90 - startSun.el + 5, lim.elMin, lim.elMax),
    target: null,
    estop: false,
    capacity: 0,
    cloud: 0.95,
    panelT: null,
    lastCmdId: 0,
    timer: null
  };

  const clampAz = a => clamp(a, lim.azMin, lim.azMax);
  const clampEl = e => clamp(e, lim.elMin, lim.elMax);

  /* LDR readings from where the sun sits relative to the panel face */
  function readLdr(sun, light) {
    if (sun.el <= 0 || light <= 0.01) {
      const d = () => Math.round(rand(1, 4));
      return { north: d(), south: d(), east: d(), west: d() };
    }
    const pe = rad(90 - st.tilt), a = rad(st.az);
    const s = sunVector(sun.az, sun.el);
    const r = [Math.cos(a), -Math.sin(a), 0];                                            // toward increasing azimuth (west side)
    const u = [-Math.sin(pe) * Math.sin(a), -Math.sin(pe) * Math.cos(a), Math.cos(pe)];  // toward panel top (north sensor)
    const n = panelNormal(st.az, st.tilt);
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const sx = dot(s, r), sy = dot(s, u), facing = dot(s, n);
    const b = 90 * light * (facing > 0 ? 1 : 0.25);
    const K = 2.5;
    const v = x => Math.round(clamp(x + rand(-0.8, 0.8), 0, 100));
    return { north: v(b * (1 + K * sy)), south: v(b * (1 - K * sy)), east: v(b * (1 - K * sx)), west: v(b * (1 + K * sx)) };
  }

  function moveToward(tAz, tEl) {
    st.az += clamp(clampAz(tAz) - st.az, -SLEW, SLEW);
    st.tilt += clamp(clampEl(tEl) - st.tilt, -SLEW, SLEW);
  }

  function tick() {
    st.min += SIM_STEP_MIN;
    const day = dayTimes(site, st.doy);
    if (st.min > day.sunset + 30) {        // start a new simulated day
      st.min = day.sunrise - 6;
      st.capacity = 0;
    }
    const sun = sunPosition(site, st.doy, st.min);

    st.cloud = clamp(st.cloud + rand(-0.05, 0.05), 0.6, 1);
    const dni = sun.el > 0 ? 950 * st.cloud * (1 - Math.exp(-sun.el / 6)) : 0;       // W/m²
    const diffuse = sun.el > 0 ? 70 * (1 - st.cloud * 0.5) * Math.min(1, sun.el / 10) : 0;
    const light = clamp(dni / 1000, 0, 1);

    /* ---- control loop: same differential logic as the firmware ---- */
    let ldr = readLdr(sun, light);
    if (!st.estop) {
      if (st.mode === "auto") {
        if (sun.el > 2) {
          const dEW = ldr.west - ldr.east, dNS = ldr.north - ldr.south;
          if (Math.abs(dEW) > cfg.deadband) st.az = clampAz(st.az + clamp(dEW * 0.15, -SLEW, SLEW));
          if (Math.abs(dNS) > cfg.deadband) st.tilt = clampEl(st.tilt - clamp(dNS * 0.15, -SLEW, SLEW));
          if (incidence(st.az, st.tilt, sun.az, sun.el) > 80) moveToward(sun.az, 90 - sun.el);
        } else {
          const rise = sunPosition(site, st.doy, day.sunrise + 15);   // night park: face east for dawn
          moveToward(rise.az, 80);
        }
      } else if (st.target) {
        moveToward(st.target.az, st.target.el);
      }
      ldr = readLdr(sun, light);
    }

    /* ---- electrical model: ~20 W panel, INA219 with 0.1 Ω shunt ---- */
    const cosT = Math.max(0, Math.cos(rad(incidence(st.az, st.tilt, sun.az, sun.el))));
    const gEff = dni * cosT + diffuse;                     // W/m² on the panel surface
    const lux = sun.el > 0 ? gEff * 105 + rand(-150, 150) : rand(0, 3);

    const ambient = 25 + 7 * Math.cos(2 * Math.PI * (st.min - 900) / 1440) + rand(-0.15, 0.15);
    const rh = clamp(60 - 1.8 * (ambient - 25) + rand(-0.6, 0.6), 15, 95);
    const panelTarget = ambient + 0.031 * gEff;            // NOCT-style heating
    st.panelT = st.panelT == null ? panelTarget : st.panelT + (panelTarget - st.panelT) * 0.35;

    const current = gEff > 3 ? 1180 * gEff / 1000 * (1 + 0.0005 * (st.panelT - 25)) + rand(-6, 6) : 0;
    const bus = gEff > 3
      ? (17.2 + 1.4 * Math.min(1, gEff / 600)) * (1 - 0.0035 * (st.panelT - 25)) + rand(-0.04, 0.04)
      : Math.max(0, gEff * 0.3);
    const cur = Math.max(0, current);
    const shunt = cur * cfg.shuntOhm;                      // mV = mA × Ω
    const load = bus + shunt / 1000;                       // V
    st.capacity += cur * (SIM_STEP_MIN / 60);              // mAh
    const hi = heatIndexC(ambient, rh), dp = dewPointC(ambient, rh);

    onPayload({
      device_id: cfg.deviceId,
      mode: st.mode,
      azimuth_deg: r2(st.az),
      elevation_deg: r2(st.tilt),
      telemetry: {
        ambient_temp_c: r2(ambient),
        ambient_temp_f: r2(c2f(ambient)),
        humidity_pct: r2(rh),
        heat_index_c: r2(hi),
        heat_index_f: r2(c2f(hi)),
        dew_point_c: r2(dp),
        dew_point_f: r2(c2f(dp)),
        panel_temp_c: r2(st.panelT),
        panel_temp_f: r2(c2f(st.panelT)),
        light_intensity_lux: r2(Math.max(0, lux)),
        shunt_voltage_mv: r2(shunt),
        bus_voltage_v: r2(bus),
        current_ma: r2(cur),
        load_voltage_v: r2(load),
        power_mw: r2(load * cur),
        capacity_mah: r2(st.capacity)
      },
      ldr_sensors: ldr,
      estop: st.estop,
      rssi_dbm: Math.round(-58 + rand(-4, 4)),
      last_cmd_id: st.lastCmdId,
      ts: Math.floor(Date.now() / 1000),
      sim_minutes: st.min,
      sim_doy: st.doy
    });
  }

  return {
    start() { tick(); st.timer = setInterval(tick, TICK_MS); },
    stop() { clearInterval(st.timer); },
    /* Same shape as the /control node in Firebase */
    applyControl(c) {
      if (c.mode) st.mode = c.mode;
      if (typeof c.estop === "boolean") st.estop = c.estop;
      if (c.target_az != null && c.target_el != null) st.target = { az: +c.target_az, el: +c.target_el };
      if (st.mode === "auto") st.target = null;
      if (c.cmd_id) setTimeout(() => { st.lastCmdId = c.cmd_id; }, 400);
    }
  };
}
