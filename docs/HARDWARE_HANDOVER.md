# SUNFLOWER: ESP32 ↔ Firebase Data Contract

The website and the Firebase database are ready. The firmware only has to follow this contract. You can test the whole loop without the website: open the Firebase console → Realtime Database → **Data** tab and watch the values change.

## 1. What you receive from the web team

| Item | Value |
|---|---|
| Web API Key | `AIzaSyAwOYukiXVwh5nKpL-s3XJoMoYK9_BoB-w` |
| Database URL | `https://sunflower-solar-tracker-default-rtdb.asia-southeast1.firebasedatabase.app` |
| Device account | `device@sunflower.com` + password (sent separately, Email/Password auth) |
| Device ID | `dual-axis-solar-01` |
| Live dashboard | https://sunflower-solar-tracker.web.app |

The database rules reject writes from devices that are not signed in, so the ESP32 must sign in with the device account.

**Permissions:** the database only accepts readings from the device account (`device@sunflower.com`, or any account given the `device` role). That account can write `live` and `history` and read `control`, but cannot send commands. Readings are validated: telemetry values must be numbers (numeric strings are accepted), LDR values 0 to 4095, angles in a sensible range. Extra fields are allowed.

## 2. Database paths

```
/devices/dual-axis-solar-01/
   live      ← ESP32 OVERWRITES (set) every 2–5 s
   history   ← ESP32 PUSHES a copy every 30 s (push → auto key)
   control   → ESP32 READS (listen/stream, or poll every 1–2 s). Written by the website.
```

## 3. `live` payload (and each `history` entry)

This is the specification payload plus **4 extra fields** at the end. The extra fields are required.

```json
{
  "device_id": "dual-axis-solar-01",
  "mode": "auto",
  "azimuth_deg": 180.0,
  "elevation_deg": 44.5,
  "telemetry": {
    "ambient_temp_c": 32.45,  "ambient_temp_f": 90.41,
    "humidity_pct": 54.20,
    "heat_index_c": 35.10,    "heat_index_f": 95.18,
    "dew_point_c": 21.80,     "dew_point_f": 71.24,
    "panel_temp_c": 44.60,    "panel_temp_f": 112.28,
    "light_intensity_lux": 84500.50,
    "shunt_voltage_mv": 125.07,
    "bus_voltage_v": 18.25,
    "current_ma": 1250.75,
    "load_voltage_v": 18.38,
    "power_mw": 22826.19,
    "capacity_mah": 4520.30
  },
  "ldr_sensors": { "north": 88, "south": 85, "east": 64, "west": 89 },

  "ts": 1764150000,
  "rssi_dbm": -58,
  "estop": false,
  "last_cmd_id": 1764149990123
}
```

| Extra field | Type | Meaning |
|---|---|---|
| `ts` | integer | Unix time in **seconds** from NTP. The website marks the device OFFLINE if `ts` is older than 60 s. |
| `rssi_dbm` | integer | `WiFi.RSSI()` |
| `estop` | bool | `true` while the emergency stop is active |
| `last_cmd_id` | number | `cmd_id` of the last control command applied (the website's "Confirmed ✓") |

**Rules for values**
- All 16 telemetry values are **numbers (float)**, not strings. Send 2 decimals.
- LDR values are 0–100 (% of full scale), integers.
- If a sensor fails, **omit the key** or send `null`. The card then shows `--`. Do **not** send `0` or `NaN`.

**Formulas**
| Value | How |
|---|---|
| °F | `c * 9 / 5 + 32` |
| Heat index | DHT library: `dht.computeHeatIndex(t, h, false)` |
| Dew point | Magnus: `g = ln(h/100) + 17.62*t/(243.12+t)`, `dp = 243.12*g/(17.62-g)` |
| INA219 | `getShuntVoltage_mV()`, `getBusVoltage_V()`, `getCurrent_mA()`, `getPower_mW()` |
| Load voltage | `bus_v + shunt_mv / 1000` |
| Capacity | `capacity_mah += current_ma * dt_hours` on every loop. Reset once a day. |

## 4. `control` node (website → ESP32)

```json
{
  "mode": "manual",
  "target_az": 135.0,
  "target_el": 30.0,
  "estop": false,
  "cmd_id": 1764149990123,
  "updated_by": "operator@email.com",
  "updated_at": 1764149990456
}
```

Firmware behaviour:
1. **`estop == true`**: cut or detach both motors at once and stop all movement, whatever the mode. Report `"estop": true`.
2. **`mode == "auto"`**: run the LDR differential tracking and ignore `target_*`.
3. **`mode == "manual"`**: move to `target_az` / `target_el`, then hold. Do not run LDR tracking.
4. After applying a new command, copy its `cmd_id` into `last_cmd_id` in the next `live` write.
5. On boot, read `control` once and start in that state. If `control` is empty, start in `auto`.

## 5. Angle conventions (important)

- **Azimuth:** 0° = North, 90° = East, 180° = South, 270° = West (clockwise).
- **Elevation (tilt):** 0° = panel **flat** (storm stow), 90° = panel vertical.
  To face the sun, tilt = `90 − sun elevation`.
- **LDR names:** `north` = sensor on the panel's **top** edge, `south` = bottom edge,
  `east` / `west` = left/right edges (`west` = the side that is brighter when the panel must turn toward higher azimuth).
- Tracking logic used in the website's simulator and its explanation:
  ```
  dEW = west - east;   if |dEW| > 5  → azimuth += step toward brighter side
  dNS = north - south; if |dNS| > 5  → tilt    −= step toward brighter side
  ```
- If the azimuth motor is a 180° servo, tell the web team. They will set `limits.azMax = 180` in `src/config.js`, and the website will stop sending targets above 180°.

## 6. Hardware notes

- **ESP32 ADC:** read the LDRs on **ADC1 pins (GPIO 32–39)**. ADC2 pins don't work while Wi-Fi is on.
- **ESP8266:** it has only one analog pin (A0). Four LDRs need an ADS1115 or a CD4051 multiplexer.
- **BH1750:** default mode saturates at about 65,535 lux. Direct sunlight can reach about 100,000 lux, so use the low-sensitivity (MTreg) setting outdoors.
- **INA219:** the standard module has a 0.1 Ω shunt (±3.2 A max). Wire it in series between the panel + and the charge controller / load.
- **Time:** `configTime(5 * 3600, 0, "pool.ntp.org");` then `ts = time(nullptr);`. Wait until `ts > 1700000000` before sending.

## 7. Firebase library

Either option works:
- **Arduino library:** "FirebaseClient" by Mobizt (Library Manager). It handles email/password sign-in, token refresh, `set`, `push` and streams.
- **Plain REST over HTTPS:**
  - Sign in: `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<API_KEY>`
    with body `{"email":"…","password":"…","returnSecureToken":true}`, which returns `idToken` (valid for 1 hour).
  - Write live: `PUT <DB_URL>/devices/dual-axis-solar-01/live.json?auth=<idToken>`
  - Push history: `POST <DB_URL>/devices/dual-axis-solar-01/history.json?auth=<idToken>`
  - Read control: `GET <DB_URL>/devices/dual-axis-solar-01/control.json?auth=<idToken>`

## 8. Reference implementation

**ESP32 firmware:** `firmware/sunflower_esp32/sunflower_esp32.ino` implements this whole contract with the plain REST API: sign-in, `live` every 3 s, `history` every 30 s, `control` polling, E-STOP, the `last_cmd_id` ack, NTP, `null` for failed sensors, and LDR tracking.
- Copy `secrets.example.h` to `secrets.h` and fill in Wi-Fi + Firebase values.
- Pins, LDR direction, servo direction and the angle range are in the **CONFIG** block at the top. Change them to match your wiring.
- Default azimuth range is **90°–270°** (a 180° servo covering East → South → West). If you keep that, tell the web team to set `limits: { azMin: 90, azMax: 270 }` in `src/config.js`.
- It has not been compiled by the web team. Please compile it once and report any errors.

`tools/fake-device.mjs` in the web project does exactly what the ESP32 must do: it signs in, writes `live`, pushes `history`, listens to `control` and echoes `last_cmd_id`. Run it to see the expected data in the console. The tracking simulation is in `src/lib/demoDevice.js`.
