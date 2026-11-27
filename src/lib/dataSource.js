/* =========================================================================
   Data layer: ek hi interface, do sources (DEMO simulator ya Firebase RTDB)

   Firebase Realtime Database structure:
     /devices/<id>/live      <- ESP32 har 2-5 sec overwrite karta hai (spec payload)
     /devices/<id>/history   <- ESP32 har 30 sec push karta hai (chart + CSV export)
     /devices/<id>/control   <- Website likhti hai, ESP32 parhta hai
   ========================================================================= */
import { createDemoDevice } from "./demoDevice.js";

export function hasFirebaseConfig(cfg) {
  const f = cfg.firebase || {};
  return !!(f.apiKey && f.databaseURL && f.projectId);
}

export function pickSource(cfg) {
  const q = new URLSearchParams(window.location.search);
  if (q.has("demo")) return "demo";
  if (q.has("live")) return "firebase";
  if (cfg.dataMode === "demo") return "demo";
  if (cfg.dataMode === "firebase") return "firebase";
  return hasFirebaseConfig(cfg) ? "firebase" : "demo";
}

/* handlers: onLive, onHistory, onCloud, onControl, onAuth, onError */
export function createDataSource(cfg, h) {
  const source = pickSource(cfg);
  return source === "firebase" ? firebaseSource(cfg, h) : demoSource(cfg, h);
}

/* ---------------- DEMO ---------------- */
function demoSource(cfg, h) {
  const device = createDemoDevice(cfg, p => h.onLive(p));
  return {
    kind: "demo",
    start() {
      h.onCloud(true);
      h.onAuth({ email: "demo@sunflower.local", demo: true });
      h.onHistory([]);
      device.start();
    },
    stop() { device.stop(); },
    sendControl(patch) {
      const cmd = { ...patch, cmd_id: Date.now() };
      device.applyControl(cmd);
      return Promise.resolve(cmd);
    },
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    resetPassword: () => Promise.resolve()
  };
}

/* ---------------- FIREBASE ---------------- */
function firebaseSource(cfg, h) {
  let fb = null;          // loaded SDK modules
  let base = null, auth = null, user = null;
  const unsubs = [];
  let controlUnsub = null;
  let stopped = false;

  async function start() {
    if (!hasFirebaseConfig(cfg)) {
      h.onError("src/config.js mein Firebase config khali hai.");
      return;
    }
    try {
      const [appMod, dbMod, authMod] = await Promise.all([
        import("firebase/app"), import("firebase/database"), import("firebase/auth")
      ]);
      fb = { ...appMod, ...dbMod, ...authMod };
    } catch (e) {
      h.onError("Firebase SDK load nahi hua: " + e.message);
      return;
    }
    if (stopped) return;   // component unmounted while the SDK was loading
    const app = fb.getApps().length ? fb.getApp() : fb.initializeApp(cfg.firebase);
    const db = fb.getDatabase(app);
    auth = fb.getAuth(app);
    base = fb.ref(db, "devices/" + cfg.deviceId);

    unsubs.push(fb.onValue(fb.ref(db, ".info/connected"), s => h.onCloud(!!s.val())));

    unsubs.push(fb.onValue(fb.child(base, "live"),
      s => { const v = s.val(); if (v) h.onLive(v); },
      e => h.onError("Live data read error: " + e.message)));

    fb.get(fb.query(fb.child(base, "history"), fb.limitToLast(cfg.historyLimit)))
      .then(s => {
        const arr = [];
        s.forEach(c => { arr.push(c.val()); });
        h.onHistory(arr);
      })
      .catch(e => h.onError("History read error: " + e.message));

    unsubs.push(fb.onAuthStateChanged(auth, u => {
      user = u;
      if (controlUnsub) { controlUnsub(); controlUnsub = null; }
      if (u) {
        controlUnsub = fb.onValue(fb.child(base, "control"),
          s => h.onControl(s.val() || {}),
          e => h.onError("Control read error: " + e.message));
      }
      h.onAuth(u ? { email: u.email } : null);
    }));
  }

  return {
    kind: "firebase",
    start,
    stop() { stopped = true; unsubs.forEach(u => u()); if (controlUnsub) controlUnsub(); },
    sendControl(patch) {
      if (!base) return Promise.reject(new Error("Firebase connected nahi hai"));
      if (!user) return Promise.reject(new Error("Control ke liye login zaroori hai"));
      const cmd = { ...patch, cmd_id: Date.now(), updated_by: user.email, updated_at: fb.serverTimestamp() };
      return fb.update(fb.child(base, "control"), cmd).then(() => cmd);
    },
    login: (email, pass) => fb.signInWithEmailAndPassword(auth, email, pass),
    logout: () => fb.signOut(auth),
    resetPassword: email => fb.sendPasswordResetEmail(auth, email)
  };
}
