/* Central store: live reading, history buffer, connection, auth and control.
   Every component reads from here via useTelemetry(). */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDataSource, pickSource, hasFirebaseConfig } from "../lib/dataSource.js";
import { normalize } from "../lib/normalize.js";

const MAX_POINTS = 400;
const ACK_TIMEOUT_MS = 10000;
const Ctx = createContext(null);

export function TelemetryProvider({ cfg, children }) {
  const kind = useMemo(() => pickSource(cfg), [cfg]);
  const [live, setLive] = useState(null);
  const [history, setHistory] = useState([]);
  const [cloud, setCloud] = useState(false);
  const [user, setUser] = useState(undefined);       // undefined = still checking
  const [remoteControl, setRemoteControl] = useState(null);
  const [desired, setDesired] = useState({});         // what the operator last asked for
  const [cmd, setCmd] = useState({ state: "idle" });
  const [error, setError] = useState(null);
  const [updates, setUpdates] = useState(0);
  const srcRef = useRef(null);

  useEffect(() => {
    const src = createDataSource(cfg, {
      onLive: raw => {
        const r = normalize(raw, cfg);
        if (!r) return;
        setLive(r);
        setUpdates(u => u + 1);
        setHistory(h => {
          const last = h[h.length - 1];
          if (last && last.ts === r.ts && last.minutes === r.minutes) return h;     // duplicate
          if (last && r.simulated && r.minutes < last.minutes - 60) return [r];      // demo: new day
          const next = h.length >= MAX_POINTS ? h.slice(h.length - MAX_POINTS + 1) : h.slice();
          next.push(r);
          return next;
        });
      },
      onHistory: arr => {
        const old = arr.map(x => normalize(x, cfg)).filter(Boolean).sort((a, b) => a.ts - b.ts);
        setHistory(h => {
          const lastOld = old.length ? old[old.length - 1].ts : 0;
          return old.concat(h.filter(x => x.ts > lastOld)).slice(-MAX_POINTS);
        });
      },
      onCloud: setCloud,
      onControl: c => setRemoteControl(c),
      onAuth: setUser,
      onError: msg => setError(msg)
    });
    srcRef.current = src;
    src.start();
    return () => src.stop();
  }, [cfg]);

  /* Does this firmware echo last_cmd_id? If it never does, commands are shown as
     "saved" instead of warning that the device did not reply. */
  const ackSupported = useRef(false);
  const liveRef = useRef(null);
  liveRef.current = live;
  if (live?.lastCmdId != null) ackSupported.current = true;

  /* Device confirms a command by echoing its id back in last_cmd_id */
  useEffect(() => {
    if (cmd.state === "sent" && live?.lastCmdId != null && live.lastCmdId >= cmd.id) {
      setCmd(c => ({ ...c, state: "confirmed" }));
    }
  }, [live, cmd.state, cmd.id]);

  useEffect(() => {
    if (cmd.state !== "sent") return;
    const t = setTimeout(() => setCmd(c => (c.state === "sent" ? { ...c, state: ackSupported.current ? "timeout" : "saved" } : c)), ACK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [cmd.state, cmd.id]);

  const send = useCallback((patch, label) => {
    const src = srcRef.current;
    if (!src) return Promise.resolve();
    setDesired(d => ({ ...d, ...patch }));
    setCmd({ state: "sending", label });
    return src.sendControl(patch)
      /* readings are arriving but the firmware never echoes ids: the write itself is the confirmation */
      .then(c => setCmd({ state: liveRef.current && !ackSupported.current && kind !== "demo" ? "saved" : "sent", id: c.cmd_id, label }))
      .catch(e => setCmd({
        state: "error", label,
        msg: /permission/i.test(e.message) ? "this account is not an operator" : e.message
      }));
  }, [kind]);

  const auth = useMemo(() => ({
    login: (e, p) => srcRef.current.login(e, p),
    logout: () => srcRef.current.logout(),
    resetPassword: e => srcRef.current.resetPassword(e)
  }), []);

  /* Mode/E-stop shown in the UI: operator's request first, then the cloud
     control node, then what the device reports. */
  const control = {
    mode: desired.mode ?? remoteControl?.mode ?? live?.mode ?? "auto",
    estop: desired.estop ?? remoteControl?.estop ?? live?.estop ?? false,
    targetAz: desired.target_az ?? remoteControl?.target_az ?? null,
    targetEl: desired.target_el ?? remoteControl?.target_el ?? null
  };

  const canControl = kind === "demo" || !!user;

  const value = {
    cfg, kind, configured: hasFirebaseConfig(cfg),
    live, history, cloud, user, error, updates,
    control, cmd, send, canControl, auth
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTelemetry() {
  return useContext(Ctx);
}

/* Re-render every `ms` (for "updated 3 s ago" style labels) */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/* online | offline | waiting | demo */
export function useDeviceStatus() {
  const { kind, live, cfg } = useTelemetry();
  const now = useNow(1000);
  if (kind === "demo") return { status: "demo", age: 0 };
  if (!live) return { status: "waiting", age: null };
  const age = Math.max(0, now / 1000 - live.ts);
  return { status: age <= cfg.offlineAfterSec ? "online" : "offline", age };
}
