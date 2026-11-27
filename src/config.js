/* =========================================================================
   SUNFLOWER — Configuration
   Firebase connect karte waqt sirf yehi file edit karni hai.
   ========================================================================= */

const config = {
  /* Firebase console > Project settings > General > "Your apps" > Web app
     se ye values copy kar ke yahan paste karein.
     Khali rahengi to website DEMO mode mein chalegi. */
  firebase: {
    apiKey: "AIzaSyAwOYukiXVwh5nKpL-s3XJoMoYK9_BoB-w",
    authDomain: "sunflower-solar-tracker.firebaseapp.com",
    databaseURL: "https://sunflower-solar-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sunflower-solar-tracker",
    appId: "1:96331336493:web:9e4a2d0a93303d6c9161a4"
  },

  /* Database path: /devices/<deviceId>/live | history | control */
  deviceId: "dual-axis-solar-01",

  /* "auto"     -> Firebase config bhara ho to LIVE, warna DEMO
     "demo"     -> hamesha simulated data
     "firebase" -> hamesha Firebase
     URL ke aakhir mein ?demo likhne se bhi demo mode on ho jata hai. */
  dataMode: "auto",

  /* Itne second tak naya data na aaye to device OFFLINE dikhega */
  offlineAfterSec: 60,

  /* Chart aur export ke liye kitni purani readings load hon */
  historyLimit: 300,

  /* Location: sun position isi se calculate hoti hai */
  site: { name: "Hyderabad, Sindh", lat: 25.396, lon: 68.358, tzHours: 5 },

  /* Mechanical limits. 180° servo use ho to azMax: 180 kar dein.
     Elevation = panel tilt: 0° = flat (storm stow), 90° = vertical. */
  limits: { azMin: 0, azMax: 360, elMin: 0, elMax: 90 },

  /* LDR deadband (%). Is se kam farq par motor nahi chalti */
  deadband: 5,

  /* Reset Home Zero preset */
  home: { az: 180, el: 0 },

  /* INA219 shunt resistor (ohm). Sirf demo simulator ke liye */
  shuntOhm: 0.1,

  /* Panel ki rating (watt, poori dhoop 1000 W/m² par). Forecast ke liye.
     Senior se panel ka asli watt pooch kar yahan likhein. */
  panel: { ratedW: 20 },

  /* Bijli ka rate: apne bill se "per unit" (1 unit = 1 kWh) rate dekh kar yahan likhein */
  money: { currency: "Rs", perKwh: 60 },

  /* Alerts: panel itna garam (°C), health itni kam (%), sooraj se itna hata hua (°) */
  alerts: { panelHotC: 65, lowHealthPct: 75, offSunDeg: 10 },

  project: {
    name: "SUNFLOWER",
    title: "An IoT-Integrated Intelligent Dual-Axis Solar Tracker",
    university: "GC University Hyderabad",
    department: "Department of Information Technology",
    supervisor: "Dr. Sheeba Memon",
    coSupervisor: "Ms. Iqra Lakho",
    team: [
      { name: "Abdullah", roll: "BSIT-2022-05" },
      { name: "Ahmed", roll: "BSIT-2022-055" },
      { name: "Mustafa", roll: "BSIT-2022-044" },
      { name: "Ibtisam", roll: "BSIT-2023-177" }
    ],
    /* Hardware team jo sensors use kare, ye list us ke mutabiq update karein */
    hardware: [
      { part: "ESP32 / NodeMCU", role: "Controller + Wi-Fi" },
      { part: "4 × LDR quadrant", role: "Sun direction" },
      { part: "2 × Servo / motor", role: "Azimuth + elevation" },
      { part: "DHT22", role: "Air temp + humidity" },
      { part: "DS18B20", role: "Panel temperature" },
      { part: "BH1750", role: "Light intensity (lux)" },
      { part: "INA219", role: "Voltage, current, power" }
    ]
  }
};

export default config;
