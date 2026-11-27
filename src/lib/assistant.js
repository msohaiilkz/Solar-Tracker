/* Sunflower Assistant: answers questions from the project's own knowledge and the
   live readings. No online AI, no API key: it matches the question against topics
   (English and Roman Urdu keywords) and fills answers with current values. */
import { fmt } from "./params.js";
import { fmtClock } from "./sun.js";

const T = (keys, answer, extra = {}) => ({ keys, answer, ...extra });
const W = t => (t.power_mw != null ? t.power_mw / 1000 : null);

const TOPICS = [
  /* ---- greetings ---- */
  T(["hi", "hello", "hey", "salam", "assalam", "aoa", "hola"], () =>
    "Hello! I'm the Sunflower assistant. Ask me about the live readings, how the tracker works, or how to use this dashboard.", { small: true }),
  T(["thanks", "thank you", "shukriya", "shukria", "jazak"], () => "You're welcome! Anything else about the tracker?", { small: true }),

  /* ---- live values ---- */
  T(["power", "watt", "bijli", "output", "produce", "generating", "kitni bijli", "energy now"], c => {
    const t = c.t;
    if (W(t) == null) return "I don't have a power reading yet. The device may still be connecting.";
    return `Right now the panel is producing **${fmt(W(t))} W** (${fmt(t.load_voltage_v)} V × ${fmt(t.current_ma, 0)} mA). The highest so far in this session is ${fmt(c.peak)} W.`;
  }, { action: ["Open analytics", "analytics"] }),
  T(["panel temp", "panel temperature", "panel garam", "panel hot", "hot panel", "ds18b20"], c =>
    c.t.panel_temp_c == null ? "No panel temperature reading yet."
      : `The panel is at **${fmt(c.t.panel_temp_c, 1)} °C** (${fmt(c.t.panel_temp_f, 1)} °F), about ${fmt(c.t.panel_temp_c - (c.t.ambient_temp_c ?? 0), 1)} °C above the air. A hotter panel gives slightly less voltage, which is why we measure it.`),
  T(["temperature", "temp", "garmi", "thand", "weather", "mausam", "air", "hawa", "ambient"], c =>
    c.t.ambient_temp_c == null ? "No weather reading yet."
      : `The air is **${fmt(c.t.ambient_temp_c, 1)} °C** (${fmt(c.t.ambient_temp_f, 1)} °F), humidity ${fmt(c.t.humidity_pct, 1)} %. It feels like ${fmt(c.t.heat_index_c, 1)} °C, and the dew point is ${fmt(c.t.dew_point_c, 1)} °C.`,
  { action: ["See all 16 readings", "telemetry"] }),
  T(["humidity", "nami", "moisture"], c => `Relative humidity is **${fmt(c.t.humidity_pct, 1)} %**, measured by the DHT22 sensor.`),
  T(["light", "lux", "roshni", "dhoop", "sunlight", "bright", "bh1750"], c =>
    `Light intensity is **${fmt(c.t.light_intensity_lux, 0)} lux** (${fmt((c.t.light_intensity_lux ?? 0) / 1000, 1)} klux). Full sun is roughly 100,000 lux; a cloudy day is 10,000 to 25,000.`),
  T(["voltage", "volt", "current", "amp", "milliamp", "shunt", "ina219", "load voltage", "bus voltage"], c =>
    `Bus voltage ${fmt(c.t.bus_voltage_v)} V, shunt voltage ${fmt(c.t.shunt_voltage_mv)} mV, load voltage ${fmt(c.t.load_voltage_v)} V and current ${fmt(c.t.current_ma, 1)} mA. The INA219 measures the tiny voltage across a 0.1 Ω shunt resistor to work out the current.`),
  T(["capacity", "mah", "charge", "battery", "stored"], c =>
    `Charge collected so far today is **${fmt(c.t.capacity_mah, 0)} mAh**. The ESP32 adds up current × time on every reading and resets it once a day.`),
  T(["position", "azimuth", "tilt", "angle", "rukh", "jhukao", "kidhar", "direction", "pointing", "facing", "elevation"], c => {
    if (c.live?.az == null) return "I don't have the panel's position yet.";
    const s = c.d ? ` The sun is at ${fmt(c.d.sun.az, 1)}° azimuth and ${fmt(c.d.sun.el, 1)}° elevation${c.d.theta != null ? `, so the panel is off by only ${fmt(c.d.theta, 1)}°` : ""}.` : "";
    return `The panel points at **${fmt(c.live.az, 1)}° azimuth** (0° = north, 180° = south) with a **${fmt(c.live.el, 1)}° tilt** (0° = flat).${s}`;
  }, { action: ["Open sun tracking", "tracking"] }),
  T(["sunrise", "sunset", "noon", "sooraj kab", "suraj kab", "din", "day length"], c =>
    c.d ? `Today in ${c.cfg.site.name}: sunrise ${fmtClock(c.d.day.sunrise)}, solar noon ${fmtClock(c.d.day.noon)}, sunset ${fmtClock(c.d.day.sunset)}. These are calculated from the date and the site's latitude and longitude.` : "I need a reading first to know the date."),
  T(["online", "offline", "connected", "status", "chal raha", "working", "live", "device"], c => ({
    demo: "The dashboard is in **demo mode**: a built-in simulator is producing realistic readings because the hardware is not connected yet.",
    online: `The tracker is **online** and sending fresh readings${c.age != null ? ` (last one ${Math.round(c.age)} s ago)` : ""}.`,
    offline: `The tracker is **offline**: nothing has arrived for ${Math.round(c.age ?? 0)} seconds. Check the ESP32's power and Wi-Fi.`,
    waiting: "The dashboard is connected to the cloud and waiting for the first reading from the tracker."
  })[c.status], { action: ["Open system", "system"] }),
  T(["mode", "auto", "automatic", "manual"], c =>
    `The tracker is in **${c.control.mode === "auto" ? "automatic" : "manual"} mode**${c.control.estop ? " with the emergency stop active" : ""}. In automatic mode the light sensors steer it; in manual mode an operator moves it from the Control page.`,
  { action: ["Open control", "control"] }),
  T(["ldr", "light sensor", "sensor reading", "north sensor", "four sensors", "quadrant"], c => {
    const l = c.live?.ldr || {};
    return `The four light sensors read north ${l.north ?? "--"} %, south ${l.south ?? "--"} %, east ${l.east ?? "--"} %, west ${l.west ?? "--"} %. When opposite sensors differ by more than ${c.cfg.deadband} %, the motor turns toward the brighter one.`;
  }, { action: ["See the sensors", "tracking"] }),
  T(["gain", "fixed", "benefit", "faida", "fayda", "zyada", "more energy", "efficiency", "compare", "difference", "kitna behtar"], c =>
    `Compared with the same panel fixed at ${Math.round(Math.abs(c.cfg.site.lat))}° facing south, tracking collects about **+${fmt(c.gain, 0)} % more direct sunlight** on a clear day like today (clear-sky model).${c.sessionGain != null ? ` From the readings in this session the estimate is +${fmt(c.sessionGain, 1)} %.` : ""} Dual-axis trackers usually gain 25 to 40 % over fixed panels.`,
  { action: ["See the comparison", "analytics"] }),

  T(["summary", "insight", "insights", "report today", "aaj ka", "today summary", "how was today", "khulasa", "result"], c =>
    c.insights?.length
      ? "Here is what the data says:\n" + c.insights.slice(0, 4).map(n => `• **${n.title}**. ${n.text}`).join("\n")
      : "There aren't enough readings yet for a summary. Give it a few minutes of data.",
  { action: ["Open analytics", "analytics"] }),
  T(["clean", "dust", "dirty", "safai", "mitti", "health", "shade", "saaf"], c =>
    c.health == null ? "Panel health needs a few bright readings first (above 30,000 lux)."
      : `Panel health is **${Math.round(c.health)}%**: the output compared with the panel's best for the same amount of light. ${c.health >= 88 ? "It looks clean." : c.health >= 75 ? "A little low; check it soon." : "Low. The panel is probably dusty or shaded, so clean it."}`),
  T(["forecast", "tomorrow", "kal", "kal mausam", "mausam kal", "kal ka mausam", "weather tomorrow", "tomorrow weather", "next days", "cloud", "badal", "barish", "rain"], () =>
    "The **Solar outlook** on the Overview page shows today, tomorrow and the day after: expected energy for this panel, sunshine hours, cloud cover, and the next 24 hours hour by hour. Data comes free from Open-Meteo.",
  { action: ["Open overview", "overview"] }),

  /* ---- how it works ---- */
  T(["this project", "the project", "project", "sunflower", "about the project", "kya hai ye", "ye kya hai", "purpose", "maqsad", "summary", "introduce"], c =>
    `**${c.cfg.project.name}** is ${/^an?\s/i.test(c.cfg.project.title) ? "" : "a "}${c.cfg.project.title.charAt(0).toLowerCase() + c.cfg.project.title.slice(1)}: a solar panel that turns on two axes to keep facing the sun all day. An ESP32 reads 16 values (weather, panel and power), steers two motors using four light sensors, and sends everything to Firebase. This dashboard shows it live and lets an operator take control.`,
  { action: ["About the project", "about"] }),
  T(["how does it track", "how it works", "kaise kaam", "kaise chalta", "tracking", "algorithm", "logic", "follow", "differential"], () =>
    "It compares opposite light sensors. West minus east decides the azimuth motor, north minus south decides the tilt motor. If one side is brighter by more than 5 %, that motor takes a small step toward it. When both differences are small, the panel faces the sun and the motors rest."),
  T(["dual", "two axis", "single axis", "why two", "kyun"], () =>
    "A single-axis tracker only follows the sun east to west. A dual-axis tracker also changes the tilt as the sun rises and sets and as the seasons change, so the panel faces the sun almost exactly all day."),
  T(["deadband", "jitter", "shaking", "hilna"], c =>
    `The deadband is ±${c.cfg.deadband} %. Small differences between sensors are ignored, otherwise the motors would twitch back and forth on every tiny change in light.`),
  T(["sensors", "hardware", "components", "parts", "dht22", "ldr list", "what sensors", "kaun se sensor"], c =>
    `Hardware: ${c.cfg.project.hardware.map(h => `${h.part} (${h.role.toLowerCase()})`).join(", ")}.`, { action: ["See the hardware", "about"] }),
  T(["esp32", "microcontroller", "controller", "nodemcu", "arduino", "firmware"], () =>
    "The ESP32 is the brain on the tracker. It reads all the sensors, runs the tracking loop, drives both motors and sends the readings over Wi-Fi to Firebase every few seconds. It also reads commands from the dashboard."),
  T(["firebase", "database", "cloud", "data kahan", "where is data", "server"], () =>
    "Readings go to Firebase Realtime Database, a free cloud database from Google. The ESP32 writes to it, this website reads from it instantly, and commands travel back the same way. Security rules let anyone view the data but only a signed-in operator control the panel."),
  T(["heat index", "feels like", "dew point", "oas"], () =>
    "Heat index is how hot it feels when humidity is added to the air temperature. Dew point is the temperature at which the air would start forming dew. Both are calculated from the DHT22's temperature and humidity."),

  /* ---- using the dashboard ---- */
  T(["control", "move", "manual control", "ghumao", "jog", "arrow", "kaise chalao", "turn panel", "rotate"], () =>
    "Go to **Control**, sign in as an operator, switch to **Manual**, pick a step (1°, 5° or 15°) and press the arrows. Up/down changes the tilt, left/right the azimuth. The command list shows when the device confirms each move.",
  { action: ["Open control", "control"] }),
  T(["emergency", "e-stop", "estop", "stop", "band karo", "rok"], c =>
    `The emergency stop cuts power to both motors at once. It is ${c.control.estop ? "**active right now**" : "currently off"}. Use the red button on the Control page, and press "Release and resume" to start tracking again.`,
  { action: ["Open control", "control"] }),
  T(["export", "csv", "excel", "json", "download", "report", "pdf", "print", "thesis"], () =>
    "On **Analytics** you can download every reading as CSV (opens in Excel) or JSON. The **Report** button prints a clean page; choose “Save as PDF” in the print window for your thesis.",
  { action: ["Open analytics", "analytics"] }),
  T(["demo", "simulator", "simulated", "fake", "real data", "asli"], c =>
    c.kind === "demo" ? "Demo mode means the readings come from a built-in simulator that follows the real sun for this location. Once the hardware is connected to Firebase, the same screens show real data."
      : "The dashboard is using real data from Firebase. Add ?demo to the address to see the simulator instead."),
  T(["not working", "no data", "problem", "masla", "error", "issue", "kharab"], () =>
    "If no data shows: check the status in the top bar. Offline means the ESP32 isn't sending (check its power, Wi-Fi and NTP time). Waiting means the website is connected but nothing has arrived yet. For a presentation without hardware, open the site with ?demo at the end.",
  { action: ["Open system", "system"] }),
  T(["install", "app", "apk", "phone", "mobile", "home screen"], () =>
    "Open the website on your phone in Chrome, tap the ⋮ menu and choose **Install app**. It then opens full-screen from your home screen like a normal app. On iPhone use Share → Add to Home Screen."),
  T(["login", "sign in", "password", "operator", "account"], () =>
    "Operators sign in with the email and password created by the admin in the Firebase console. Anyone can watch the readings; signing in is only needed to move the panel. Use “Forgot?” on the sign-in box to reset a password."),
  T(["tour", "guide", "help", "kaise use", "how to use", "madad"], () =>
    "I can start a guided tour that walks you through every part of the dashboard.", { action: ["Start the tour", "#tour"] }),
  T(["team", "members", "kis ne", "who made", "students", "banaya", "developer"], c =>
    `The team: ${c.cfg.project.team.map(m => m.name).join(", ")}, ${c.cfg.project.department}, ${c.cfg.project.university}.`, { action: ["Meet the team", "about"] }),
  T(["supervisor", "sir", "madam", "teacher", "guided by"], c =>
    `Supervised by ${c.cfg.project.supervisor}, with ${c.cfg.project.coSupervisor} as co-supervisor.`)
];

export const SUGGESTIONS = [
  "How much power right now?",
  "How does the tracking work?",
  "Tracker vs fixed panel?",
  "Where is the panel pointing?",
  "How do I control it manually?",
  "Export data for my report"
];

const clean = s => ` ${s.toLowerCase().replace(/[^a-z0-9%°\s-]/g, " ").replace(/\s+/g, " ").trim()} `;

export function answer(question, ctx) {
  const q = clean(question);
  let best = null, score = 0;
  for (const topic of TOPICS) {
    let s = 0;
    for (const k of topic.keys) {
      const key = clean(k);
      if (q.includes(key)) s += key.trim().split(" ").length * 2 + (topic.small ? 0 : 0.5);
    }
    if (s > score) { score = s; best = topic; }
  }
  if (!best) {
    return {
      text: "I'm not sure about that one. I know the live readings, how the tracker works, and how to use this dashboard. Try one of these:",
      suggest: true
    };
  }
  return { text: best.answer(ctx), action: best.action };
}
