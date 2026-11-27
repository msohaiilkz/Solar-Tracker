import { PageHeader, Panel, KV, Status, Notice } from "./ui.jsx";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";

function rssiInfo(r) {
  if (r == null) return { label: "No data", bars: 0, tone: "idle" };
  if (r >= -55) return { label: "Excellent", bars: 4, tone: "good" };
  if (r >= -67) return { label: "Good", bars: 3, tone: "good" };
  if (r >= -75) return { label: "Fair", bars: 2, tone: "warn" };
  return { label: "Weak", bars: 1, tone: "crit" };
}

function ago(age) {
  if (age == null) return "never";
  if (age < 60) return `${Math.round(age)} s ago`;
  if (age < 3600) return `${Math.round(age / 60)} min ago`;
  return `${Math.round(age / 3600)} h ago`;
}

export default function System() {
  const { live, cloud, kind, cfg, updates, error, user } = useTelemetry();
  const { status, age } = useDeviceStatus();
  const rs = rssiInfo(live?.rssi);
  const dev = {
    demo: ["warn", "Simulator"], online: ["good", "Online"], offline: ["crit", "Offline"], waiting: ["idle", "Waiting"]
  }[status];

  return (
    <>
      <PageHeader title="System" desc={`Health of the device, its Wi-Fi link and the cloud database. The device counts as offline after ${cfg.offlineAfterSec} seconds without a reading.`} />
      {error && <div className="mb-5"><Notice tone="crit" icon="alert">{error}</Notice></div>}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Panel i={1} title="Device" meta="ESP32 controller" actions={<Status tone={dev[0]} live={status === "online"}>{dev[1]}</Status>}>
          <KV rows={[
            ["Device ID", <span className="font-mono text-[12.5px]">{live?.deviceId || cfg.deviceId}</span>],
            ["Last reading", kind === "demo" ? "live" : ago(age), live && kind !== "demo" ? new Date(live.ts * 1000).toLocaleTimeString() : ""],
            ["Mode", live ? (live.mode === "auto" ? "Automatic" : "Manual") : "--"],
            ["Emergency stop", live ? (live.estop ? "Active" : "Off") : "--"],
            ["Readings this session", String(updates)]
          ]} />
        </Panel>

        <Panel i={2} title="Wi-Fi" meta="Signal at the device" actions={<Status tone={rs.tone}>{rs.label}</Status>}>
          <div className="mb-4 flex items-end gap-1.5" aria-label={`${rs.bars} of 4 signal bars`}>
            {[1, 2, 3, 4].map(b => (
              <span key={b} className={`w-2.5 rounded-sm transition-colors duration-500 ${b <= rs.bars ? "bg-ink" : "bg-line"}`} style={{ height: 6 + b * 6 }} />
            ))}
            <span className="ml-2 text-[22px] font-semibold leading-none tracking-[-0.02em]">{live?.rssi ?? "--"}<span className="ml-1 text-[13px] font-medium text-muted">dBm</span></span>
          </div>
          <KV rows={[
            ["Device clock", live?.label || "--", live?.simulated ? "simulated" : ""],
            ["Time source", kind === "demo" ? "Simulator" : "NTP (pool.ntp.org)"]
          ]} />
        </Panel>

        <Panel i={3} title="Cloud" meta="Firebase Realtime Database" actions={kind === "demo" ? <Status tone="warn">Not used</Status> : cloud ? <Status tone="good" live>Connected</Status> : <Status tone="crit">Disconnected</Status>}>
          <KV rows={[
            ["Data source", kind === "demo" ? "Simulator" : "Firebase"],
            ["Path", <span className="font-mono text-[12.5px]">/devices/{cfg.deviceId}</span>],
            ["Operator", kind === "demo" ? "Not required" : user ? user.email : "Not signed in"],
            ["Offline after", `${cfg.offlineAfterSec} s`]
          ]} />
        </Panel>
      </div>
    </>
  );
}
