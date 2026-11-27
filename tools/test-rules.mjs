/* Checks database.rules.json against the Firebase emulator, as each kind of user.
   Run with:  npm run test:rules   (starts the emulator, runs this, stops it) */
import { initializeApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator, ref, get, set, push, update } from "firebase/database";

const PORT = 9000;
const URL = "https://demo-sunflower-default-rtdb.firebaseio.com";
let n = 0;

function as(name, token) {
  const app = initializeApp({ projectId: "demo-sunflower", databaseURL: URL }, name);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, "127.0.0.1", PORT, token ? { mockUserToken: token } : undefined);
  return db;
}

const admin = as("admin", "owner");
const anon = as("anon");
const attacker = as("attacker", { sub: "intruder-1", email: "someone@example.com" });
const device = as("device", { sub: "device-uid", email: "device@sunflower.com" });
const operator = as("operator", { sub: "operator-uid", email: "operator@example.com" });

const P = "devices/dual-axis-solar-01";
const reading = {
  device_id: "dual-axis-solar-01", mode: "auto", azimuth_deg: 180.5, elevation_deg: 44.5,
  telemetry: { ambient_temp_c: 32.45, humidity_pct: 54.2, power_mw: 22826.19 },
  ldr_sensors: { north: 88, south: 85, east: 64, west: 89 },
  ts: 1764150000, rssi_dbm: -58, estop: false, last_cmd_id: 0
};
const command = { mode: "manual", target_az: 135, target_el: 30, estop: false, cmd_id: 1, updated_by: "operator@example.com", updated_at: 1 };

let failed = 0;
async function expect(label, allowed, fn) {
  n++;
  let ok;
  try { await fn(); ok = true; } catch (e) { ok = false; if (!/permission/i.test(e.message)) console.log("   unexpected error:", e.message); }
  const pass = ok === allowed;
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${allowed ? "allowed" : "blocked"}  ${label}`);
}

await set(ref(admin, "roles/operator-uid"), "operator");

console.log("\nAnyone (not signed in)");
await expect("read live readings", true, () => get(ref(anon, `${P}/live`)));
await expect("read history", true, () => get(ref(anon, `${P}/history`)));
await expect("read the whole database", false, () => get(ref(anon, "/")));
await expect("write a reading", false, () => set(ref(anon, `${P}/live`), reading));
await expect("read commands", false, () => get(ref(anon, `${P}/control`)));
await expect("send a command", false, () => set(ref(anon, `${P}/control`), command));

console.log("\nSelf-registered account (no role)");
await expect("send a command", false, () => set(ref(attacker, `${P}/control`), command));
await expect("write a fake reading", false, () => set(ref(attacker, `${P}/live`), reading));
await expect("read commands", false, () => get(ref(attacker, `${P}/control`)));
await expect("give itself the operator role", false, () => set(ref(attacker, "roles/intruder-1"), "operator"));

console.log("\nDevice account");
await expect("write a valid reading", true, () => set(ref(device, `${P}/live`), reading));
await expect("write readings sent as numeric strings", true, () => set(ref(device, `${P}/live`), { ...reading, telemetry: { ambient_temp_c: "32.45" } }));
await expect("write a reading with extra fields", true, () => set(ref(device, `${P}/live`), { ...reading, firmware: "1.0" }));
await expect("push to history", true, () => push(ref(device, `${P}/history`), reading));
await expect("read commands", true, () => get(ref(device, `${P}/control`)));
await expect("write text where a number belongs", false, () => set(ref(device, `${P}/live`), { ...reading, telemetry: { ambient_temp_c: "hot" } }));
await expect("write an impossible tilt (500°)", false, () => set(ref(device, `${P}/live`), { ...reading, elevation_deg: 500 }));
await expect("send itself a command", false, () => set(ref(device, `${P}/control`), command));

console.log("\nOperator account");
await expect("send a valid command", true, () => set(ref(operator, `${P}/control`), command));
await expect("update one field (emergency stop)", true, () => update(ref(operator, `${P}/control`), { estop: true, cmd_id: 2 }));
await expect("read commands", true, () => get(ref(operator, `${P}/control`)));
await expect("read its own role", true, () => get(ref(operator, "roles/operator-uid")));
await expect("command a tilt of 500°", false, () => update(ref(operator, `${P}/control`), { target_el: 500 }));
await expect("add an unknown command field", false, () => update(ref(operator, `${P}/control`), { reboot: true }));
await expect("write fake readings", false, () => set(ref(operator, `${P}/live`), reading));

console.log(`\n${n - failed} of ${n} checks passed`);
process.exit(failed ? 1 : 0);
