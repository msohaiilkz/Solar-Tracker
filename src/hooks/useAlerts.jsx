/* Watches the live data and raises alerts: device offline/online, emergency stop,
   hot panel, failed commands. Shows a toast, keeps a list for the bell menu and,
   if the user allowed it, sends a system notification while the tab is hidden. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTelemetry, useDeviceStatus } from "./useTelemetry.jsx";
import { fmt, PARAMS } from "../lib/params.js";
import { panelHealth } from "../lib/health.js";
import { derive } from "../lib/derived.js";
import { chime, vibrate, flashTitle, unlockAudio } from "../lib/chime.js";

const Ctx = createContext(null);
const canNotify = () => typeof window !== "undefined" && "Notification" in window;

function systemNotify(title, body) {
  if (!canNotify() || Notification.permission !== "granted" || !document.hidden) return;
  const opts = { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: title };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => {});
  } else {
    try { new Notification(title, opts); } catch { /* not allowed here */ }
  }
}

export function AlertsProvider({ children }) {
  const { cfg, live, cmd, history, kind, control } = useTelemetry();
  const { status } = useDeviceStatus();
  const [items, setItems] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [permission, setPermission] = useState(() => (canNotify() ? Notification.permission : "unsupported"));
  const seq = useRef(0);
  const hotC = cfg.alerts?.panelHotC ?? 65;
  const [sound, setSound] = useState(() => { try { return localStorage.getItem("alert-sound") !== "0"; } catch { return true; } });
  const soundRef = useRef(sound);
  soundRef.current = sound;

  /* allow sound after the first tap or click anywhere */
  useEffect(() => {
    const once = () => unlockAudio();
    window.addEventListener("pointerdown", once, { once: true });
    window.addEventListener("keydown", once, { once: true });
    return () => { window.removeEventListener("pointerdown", once); window.removeEventListener("keydown", once); };
  }, []);

  const push = useCallback((tone, title, body = "") => {
    const a = { id: ++seq.current, tone, title, body, at: Date.now(), read: false };
    setItems(l => [a, ...l].slice(0, 40));
    setToasts(t => [a, ...t].slice(0, 3));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== a.id)), tone === "crit" ? 9000 : 5500);
    systemNotify(title, body);
    if (soundRef.current) chime(tone);
    if (tone !== "good") vibrate(tone);
    flashTitle(title);
  }, []);

  /* device online / offline */
  const prevStatus = useRef(status);
  useEffect(() => {
    const p = prevStatus.current;
    prevStatus.current = status;
    if (p === status) return;
    if (status === "offline") push("crit", "Device offline", `No reading for ${cfg.offlineAfterSec} seconds.`);
    else if (status === "online" && (p === "offline" || p === "waiting")) push("good", "Device connected", "Live readings are arriving.");
  }, [status, push, cfg.offlineAfterSec]);

  /* emergency stop, as reported by the device */
  const prevStop = useRef(null);
  const estop = live?.estop;
  useEffect(() => {
    if (estop == null) return;
    if (prevStop.current !== null && prevStop.current !== estop) {
      push(estop ? "crit" : "good", estop ? "Emergency stop active" : "Emergency stop released",
        estop ? "Both motors are off." : "The tracker can move again.");
    }
    prevStop.current = estop;
  }, [estop, push]);

  /* hot panel, with 5 °C hysteresis so it does not repeat */
  const hot = useRef(false);
  const panelC = live?.t.panel_temp_c;
  useEffect(() => {
    if (panelC == null) return;
    if (!hot.current && panelC >= hotC) { hot.current = true; push("warn", "Panel is hot", `${fmt(panelC, 1)} °C. Output drops as the panel heats up.`); }
    else if (hot.current && panelC < hotC - 5) hot.current = false;
  }, [panelC, hotC, push]);

  /* dusty or shaded panel: output low for the light (with hysteresis) */
  const lowHealth = useRef(false);
  const healthPct = useMemo(() => panelHealth(history).pct, [history]);
  useEffect(() => {
    if (healthPct == null) return;
    const lim = cfg.alerts?.lowHealthPct ?? 75;
    if (!lowHealth.current && healthPct < lim) {
      lowHealth.current = true;
      push("warn", "Panel may need cleaning", `It is giving ${Math.round(healthPct)}% of its best output for this much sunlight. Dust, shade or a loose wire are likely.`);
    } else if (lowHealth.current && healthPct > lim + 10) lowHealth.current = false;
  }, [healthPct, cfg.alerts, push]);

  /* sensor readings that stopped arriving */
  const missingKey = useRef("");
  useEffect(() => {
    if (!live || kind === "demo") return;
    const missing = PARAMS.filter(p => live.t[p.key] == null).map(p => `${p.label} ${p.unit}`);
    const key = missing.join("|");
    if (key && key !== missingKey.current) push("warn", `${missing.length} reading${missing.length > 1 ? "s" : ""} missing`, missing.slice(0, 4).join(", ") + (missing.length > 4 ? "…" : ""));
    missingKey.current = key;
  }, [live, kind, push]);

  /* panel not facing the sun for a while in automatic mode */
  const offSince = useRef(null), offWarned = useRef(false);
  useEffect(() => {
    const d = derive(live, cfg);
    if (!d || !d.isDay || d.theta == null || control.mode !== "auto" || control.estop) { offSince.current = null; return; }
    const lim = cfg.alerts?.offSunDeg ?? 10;
    if (d.theta > lim) {
      offSince.current ??= Date.now();
      if (!offWarned.current && Date.now() - offSince.current > 90000) {
        offWarned.current = true;
        push("warn", "Panel is not facing the sun", `Off by ${fmt(d.theta, 0)}° for over a minute. Check the light sensors and motors.`);
      }
    } else if (d.theta < lim / 2) { offSince.current = null; offWarned.current = false; }
  }, [live, cfg, control.mode, control.estop, push]);

  /* commands that did not go through */
  useEffect(() => {
    if (cmd.state === "timeout") push("warn", "No reply from device", cmd.label);
    if (cmd.state === "error") push("crit", "Command failed", cmd.msg || cmd.label);
  }, [cmd.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    items, toasts, permission, sound,
    toggleSound: () => setSound(v => {
      const next = !v;
      try { localStorage.setItem("alert-sound", next ? "1" : "0"); } catch { /* ignore */ }
      if (next) { unlockAudio(); setTimeout(() => chime("info"), 50); }
      return next;
    }),
    unread: items.filter(i => !i.read).length,
    markAllRead: () => setItems(l => l.map(i => ({ ...i, read: true }))),
    clear: () => setItems([]),
    dismiss: id => setToasts(t => t.filter(x => x.id !== id)),
    requestPermission: async () => {
      if (!canNotify()) return;
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p === "granted") push("good", "Notifications on", "You will be alerted even when this tab is in the background.");
    },
    test: () => push("warn", "Test alert", "This is how alerts look.")
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAlerts() {
  return useContext(Ctx);
}
