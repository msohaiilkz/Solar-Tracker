/* =========================================================================
   Fake ESP32: hardware ke baghair asli Firebase par poora system test karein.
   Ye bilkul wohi karta hai jo ESP32 karega:
     - har 1.5 s  -> /devices/<id>/live  overwrite
     - har 30 s   -> /devices/<id>/history  mein push
     - /devices/<id>/control sun kar mode / target / estop apply karta hai

   Chalane ka tareeqa (PowerShell):
     $env:DEVICE_EMAIL="device@sunflower.com"; $env:DEVICE_PASSWORD="your-password"; npm run fake-device
   ========================================================================= */
import { initializeApp, deleteApp } from "firebase/app";
import { getDatabase, ref, child, set, push, onValue } from "firebase/database";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import config from "../src/config.js";
import { createDemoDevice } from "../src/lib/demoDevice.js";

const email = process.env.DEVICE_EMAIL;
const password = process.env.DEVICE_PASSWORD;

if (!config.firebase.apiKey || !config.firebase.databaseURL) {
  console.error("✗ src/config.js mein Firebase config khali hai. Pehle wo bharein.");
  process.exit(1);
}
if (!email || !password) {
  console.error("✗ DEVICE_EMAIL aur DEVICE_PASSWORD set karein. Example:");
  console.error('  $env:DEVICE_EMAIL="device@sunflower.com"; $env:DEVICE_PASSWORD="..."; npm run fake-device');
  process.exit(1);
}

const app = initializeApp(config.firebase);
const db = getDatabase(app);
const auth = getAuth(app);

try {
  await signInWithEmailAndPassword(auth, email, password);
} catch (e) {
  const hints = {
    "auth/invalid-credential": "Email ya password galat hai. DEVICE_PASSWORD mein wohi asli password likhein jo Firebase console mein device user banate waqt rakha tha.",
    "auth/invalid-email": "DEVICE_EMAIL sahi email nahi hai.",
    "auth/too-many-requests": "Bahut zyada galat koshishein. Thodi der ruk kar dobara chalayein.",
    "auth/network-request-failed": "Internet connection check karein."
  };
  console.error(`✗ Login fail (${e.code}): ${hints[e.code] || e.message}`);
  process.exitCode = 1;
  await deleteApp(app);      // close Firebase cleanly, then Node exits by itself
  await new Promise(r => setTimeout(r, 50));
  process.kill(process.pid, "SIGTERM");
}
console.log(`✓ Logged in as ${email}`);

const base = ref(db, `devices/${config.deviceId}`);
let n = 0;

const device = createDemoDevice(config, payload => {
  n++;
  set(child(base, "live"), payload).catch(e => console.error("live write failed:", e.message));
  if (n % 20 === 1) {
    push(child(base, "history"), payload).catch(e => console.error("history push failed:", e.message));
  }
  const t = payload.telemetry;
  process.stdout.write(`\r#${n}  mode=${payload.mode.padEnd(6)} az=${payload.azimuth_deg.toFixed(1).padStart(6)}° el=${payload.elevation_deg.toFixed(1).padStart(5)}°  power=${(t.power_mw / 1000).toFixed(2)} W   `);
});

onValue(child(base, "control"), s => {
  const c = s.val();
  if (!c) return;
  console.log(`\n← control: ${JSON.stringify({ mode: c.mode, target_az: c.target_az, target_el: c.target_el, estop: c.estop })}`);
  device.applyControl(c);
});

device.start();
console.log(`✓ Sending to /devices/${config.deviceId}  (Ctrl+C se band karein)`);
