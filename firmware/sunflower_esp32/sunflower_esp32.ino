/* ===========================================================================
   SUNFLOWER: ESP32 firmware (reference implementation)

   Follows docs/HARDWARE_HANDOVER.md exactly:
     every 3 s   PUT  /devices/<id>/live      (full payload)
     every 30 s  POST /devices/<id>/history   (same payload)
     every 1.5 s GET  /devices/<id>/control   (mode / targets / estop)
   Uses the Firebase REST API over HTTPS, so no Firebase library is needed.

   Board:     ESP32 Dev Module (Arduino core for ESP32, 2.x or 3.x)
   Libraries (Arduino Library Manager):
     ArduinoJson (Benoit Blanchon, v7)       DHT sensor library (Adafruit)
     OneWire + DallasTemperature             BH1750 (Christopher Laws)
     Adafruit INA219                         ESP32Servo (Kevin Harrington)

   Setup: copy secrets.example.h to secrets.h and fill it in.
   Everything you may need to change is in the CONFIG section below.
   =========================================================================== */
#define ARDUINOJSON_USE_LONG_LONG 1   // cmd_id is a 13-digit millisecond timestamp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <time.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <BH1750.h>
#include <Adafruit_INA219.h>
#include <ESP32Servo.h>
#include "secrets.h"

/* ============================== CONFIG =================================== */
const char* DEVICE_ID = "dual-axis-solar-01";

// Pins. LDRs MUST be on ADC1 (GPIO 32-39); ADC2 does not work with Wi-Fi.
const int PIN_LDR_NORTH = 34;   // top edge of the panel
const int PIN_LDR_SOUTH = 35;   // bottom edge
const int PIN_LDR_EAST  = 32;
const int PIN_LDR_WEST  = 33;   // side that is brighter when azimuth must INCREASE
const int PIN_DHT       = 4;    // DHT22 data
const int PIN_DS18B20   = 5;    // panel temperature probe (4.7k pull-up to 3.3 V)
const int PIN_SERVO_AZ  = 18;
const int PIN_SERVO_EL  = 19;
// I2C (BH1750 + INA219): SDA 21, SCL 22 (ESP32 defaults)

// LDR wiring: LDR from 3.3 V to the pin, 10k from the pin to GND
// -> more light = higher reading. If yours is the other way round, set true.
const bool LDR_INVERTED = false;

// Mechanical range. A 180° servo cannot do 0-360°.
// Default: azimuth servo 0..180° covers East (90°) -> South (180°) -> West (270°).
// Tell the web team these numbers: they set the same in src/config.js "limits".
const float AZ_MIN = 90,  AZ_MAX = 270;
const float EL_MIN = 0,   EL_MAX = 90;   // tilt: 0 = flat (stow), 90 = vertical
const bool  AZ_SERVO_REVERSED = false;   // flip if the panel turns the wrong way
const bool  EL_SERVO_REVERSED = false;

const int   DEADBAND      = 5;     // % LDR difference ignored (same as website)
const float TRACK_STEP    = 1.0;   // degrees per tracking step
const float MANUAL_SPEED  = 2.0;   // degrees per step when moving to a manual target
const unsigned long MOVE_EVERY_MS    = 80;
const unsigned long LIVE_EVERY_MS    = 3000;
const unsigned long HISTORY_EVERY_MS = 30000;
const unsigned long CONTROL_EVERY_MS = 1500;
/* ========================================================================= */

DHT dht(PIN_DHT, DHT22);
OneWire oneWire(PIN_DS18B20);
DallasTemperature panelProbe(&oneWire);
BH1750 lightMeter;
Adafruit_INA219 ina219;
Servo servoAz, servoEl;
bool hasBH1750 = false, hasINA219 = false;

WiFiClientSecure tls;
String idToken;
unsigned long tokenAt = 0;
const unsigned long TOKEN_LIFE_MS = 50UL * 60UL * 1000UL;   // tokens last 60 min

// Desired state (from /control) and actual state
String mode = "auto";
bool estop = false;
float targetAz = 180, targetEl = 0;
long long lastCmdId = 0;
float az = 180, el = 0;
bool servosAttached = false;

double capacityMah = 0;
int capacityDay = -1;
unsigned long lastMove = 0, lastLive = 0, lastHistory = 0, lastControl = 0, lastEnergy = 0, lastWifiTry = 0;

/* ------------------------------- helpers -------------------------------- */
float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
float cToF(float c) { return c * 9.0f / 5.0f + 32.0f; }

int readLdrPct(int pin) {
  long sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(pin);
  int pct = (int)lround((sum / 8.0) * 100.0 / 4095.0);
  return LDR_INVERTED ? 100 - pct : pct;
}

float dewPointC(float t, float h) {
  float g = log(h / 100.0f) + 17.62f * t / (243.12f + t);
  return 243.12f * g / (17.62f - g);
}

void writeServos() {
  if (!servosAttached) return;
  float a = (az - AZ_MIN) * 180.0f / (AZ_MAX - AZ_MIN);
  float e = el;                                // tilt 0..90° = servo 0..90°
  if (AZ_SERVO_REVERSED) a = 180 - a;
  if (EL_SERVO_REVERSED) e = 180 - e;
  servoAz.write((int)lround(clampf(a, 0, 180)));
  servoEl.write((int)lround(clampf(e, 0, 180)));
}

void attachServos() {
  if (servosAttached) return;
  servoAz.attach(PIN_SERVO_AZ, 500, 2400);
  servoEl.attach(PIN_SERVO_EL, 500, 2400);
  servosAttached = true;
  writeServos();
}

void detachServos() {          // E-STOP: no more PWM, motors go limp
  if (!servosAttached) return;
  servoAz.detach();
  servoEl.detach();
  servosAttached = false;
}

/* ------------------------------ networking ------------------------------ */
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Wi-Fi");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print('.'); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " FAILED (will retry)");
}

void waitForTime() {
  configTime(5 * 3600, 0, "pool.ntp.org", "time.google.com");
  Serial.print("NTP");
  for (int i = 0; i < 100 && time(nullptr) < 1700000000; i++) { delay(300); Serial.print('.'); }
  Serial.println(time(nullptr) > 1700000000 ? " ok" : " FAILED (website will show OFFLINE until time is set)");
}

bool signIn() {
  HTTPClient http;
  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;
  if (!http.begin(tls, url)) return false;
  http.addHeader("Content-Type", "application/json");
  JsonDocument body;
  body["email"] = DEVICE_EMAIL;
  body["password"] = DEVICE_PASSWORD;
  body["returnSecureToken"] = true;
  String out; serializeJson(body, out);
  int code = http.POST(out);
  if (code == 200) {
    JsonDocument res;
    deserializeJson(res, http.getString());
    idToken = res["idToken"].as<String>();
    tokenAt = millis();
    Serial.println("Firebase sign-in ok");
  } else {
    Serial.printf("Sign-in failed: HTTP %d %s\n", code, http.getString().c_str());
  }
  http.end();
  return code == 200;
}

bool ensureToken() {
  if (idToken.length() && millis() - tokenAt < TOKEN_LIFE_MS) return true;
  return signIn();
}

// method: "GET" | "PUT" | "POST". Returns HTTP status (negative = network error).
int firebase(const char* method, const String& path, const String& payload, String* response = nullptr) {
  if (WiFi.status() != WL_CONNECTED || !ensureToken()) return -1;
  HTTPClient http;
  http.setTimeout(5000);
  String url = String(FIREBASE_DB_URL) + "/devices/" + DEVICE_ID + "/" + path + ".json?auth=" + idToken;
  if (!http.begin(tls, url)) return -1;
  http.addHeader("Content-Type", "application/json");
  int code = http.sendRequest(method, payload);
  if (response && code == 200) *response = http.getString();
  http.end();
  if (code == 401) idToken = "";      // token expired or revoked: sign in again next time
  return code;
}

/* ----------------------------- control (in) ----------------------------- */
void applyControl(JsonVariantConst c) {
  if (c.isNull()) return;
  if (c["mode"].is<const char*>()) mode = String(c["mode"].as<const char*>()) == "manual" ? "manual" : "auto";
  if (c["target_az"].is<float>()) targetAz = clampf(c["target_az"].as<float>(), AZ_MIN, AZ_MAX);
  if (c["target_el"].is<float>()) targetEl = clampf(c["target_el"].as<float>(), EL_MIN, EL_MAX);
  if (c["estop"].is<bool>()) estop = c["estop"].as<bool>();
  if (estop) detachServos(); else attachServos();
  if (c["cmd_id"].is<long long>()) lastCmdId = c["cmd_id"].as<long long>();   // ack in the next live write
}

void pollControl() {
  String body;
  if (firebase("GET", "control", "", &body) != 200) return;
  JsonDocument doc;
  if (deserializeJson(doc, body)) return;          // "null" when empty -> keep current state
  long long id = doc["cmd_id"] | 0LL;
  if (id == 0 || id == lastCmdId) return;          // nothing new
  applyControl(doc.as<JsonVariantConst>());
  Serial.printf("<- control: mode=%s az=%.1f el=%.1f estop=%d\n", mode.c_str(), targetAz, targetEl, estop);
}

/* ------------------------------- movement ------------------------------- */
float stepToward(float cur, float target, float maxStep) {
  float d = target - cur;
  if (fabs(d) <= maxStep) return target;
  return cur + (d > 0 ? maxStep : -maxStep);
}

void moveOnce() {
  if (estop) return;
  if (mode == "manual") {
    az = stepToward(az, targetAz, MANUAL_SPEED);
    el = stepToward(el, targetEl, MANUAL_SPEED);
  } else {
    int n = readLdrPct(PIN_LDR_NORTH), s = readLdrPct(PIN_LDR_SOUTH);
    int e = readLdrPct(PIN_LDR_EAST),  w = readLdrPct(PIN_LDR_WEST);
    int dEW = w - e, dNS = n - s;
    if (abs(dEW) > DEADBAND) az += dEW > 0 ? TRACK_STEP : -TRACK_STEP;   // turn toward brighter side
    if (abs(dNS) > DEADBAND) el += dNS > 0 ? -TRACK_STEP : TRACK_STEP;   // top brighter -> flatter
  }
  az = clampf(az, AZ_MIN, AZ_MAX);
  el = clampf(el, EL_MIN, EL_MAX);
  writeServos();
}

/* ---------------------------- telemetry (out) --------------------------- */
// Adds key only when the value is valid, so a failed sensor shows "--" on the website.
void put(JsonObject o, const char* key, float v) {
  if (!isnan(v) && !isinf(v)) o[key] = roundf(v * 100.0f) / 100.0f;
}

void updateEnergy(float currentMa) {
  time_t now = time(nullptr);
  struct tm lt; localtime_r(&now, &lt);
  if (lt.tm_yday != capacityDay) { capacityDay = lt.tm_yday; capacityMah = 0; }   // reset once a day
  unsigned long ms = millis();
  if (lastEnergy && !isnan(currentMa) && currentMa > 0) capacityMah += currentMa * (ms - lastEnergy) / 3600000.0;
  lastEnergy = ms;
}

String buildPayload() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  panelProbe.requestTemperatures();
  float pt = panelProbe.getTempCByIndex(0);
  if (pt == DEVICE_DISCONNECTED_C) pt = NAN;
  float lux = hasBH1750 ? lightMeter.readLightLevel() : NAN;
  if (lux < 0) lux = NAN;

  float shunt = NAN, bus = NAN, cur = NAN, pwr = NAN;
  if (hasINA219) {
    shunt = ina219.getShuntVoltage_mV();
    bus   = ina219.getBusVoltage_V();
    cur   = ina219.getCurrent_mA();
    pwr   = ina219.getPower_mW();
  }
  updateEnergy(cur);

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["mode"] = mode;
  doc["azimuth_deg"] = roundf(az * 10) / 10;
  doc["elevation_deg"] = roundf(el * 10) / 10;

  JsonObject tel = doc["telemetry"].to<JsonObject>();
  put(tel, "ambient_temp_c", t);
  put(tel, "ambient_temp_f", cToF(t));
  put(tel, "humidity_pct", h);
  float hiF = (isnan(t) || isnan(h)) ? NAN : dht.computeHeatIndex(cToF(t), h, true);
  put(tel, "heat_index_c", isnan(hiF) ? NAN : (hiF - 32) * 5.0f / 9.0f);
  put(tel, "heat_index_f", hiF);
  float dp = (isnan(t) || isnan(h) || h <= 0) ? NAN : dewPointC(t, h);
  put(tel, "dew_point_c", dp);
  put(tel, "dew_point_f", cToF(dp));
  put(tel, "panel_temp_c", pt);
  put(tel, "panel_temp_f", cToF(pt));
  put(tel, "light_intensity_lux", lux);
  put(tel, "shunt_voltage_mv", shunt);
  put(tel, "bus_voltage_v", bus);
  put(tel, "current_ma", cur);
  put(tel, "load_voltage_v", bus + shunt / 1000.0f);
  put(tel, "power_mw", pwr);
  put(tel, "capacity_mah", (float)capacityMah);

  JsonObject l = doc["ldr_sensors"].to<JsonObject>();
  l["north"] = readLdrPct(PIN_LDR_NORTH);
  l["south"] = readLdrPct(PIN_LDR_SOUTH);
  l["east"]  = readLdrPct(PIN_LDR_EAST);
  l["west"]  = readLdrPct(PIN_LDR_WEST);

  doc["ts"] = (long long)time(nullptr);
  doc["rssi_dbm"] = WiFi.RSSI();
  doc["estop"] = estop;
  doc["last_cmd_id"] = lastCmdId;

  String out; serializeJson(doc, out);
  return out;
}

/* --------------------------------- main --------------------------------- */
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nSUNFLOWER booting");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);     // full 0-3.3 V range
  Wire.begin();
  dht.begin();
  panelProbe.begin();
  // Low MTreg (31-69, default 69) -> range up to ~120,000 lux, so direct sun does not saturate
  hasBH1750 = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  if (hasBH1750) lightMeter.setMTreg(32);
  hasINA219 = ina219.begin();
  Serial.printf("BH1750 %s, INA219 %s\n", hasBH1750 ? "ok" : "MISSING", hasINA219 ? "ok" : "MISSING");

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  servoAz.setPeriodHertz(50);
  servoEl.setPeriodHertz(50);

  tls.setInsecure();   // FYP shortcut: encrypted but the certificate is not checked
  connectWiFi();
  waitForTime();
  signIn();

  // Boot: start in the state the website last set (auto if control is empty)
  String body;
  if (firebase("GET", "control", "", &body) == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, body)) applyControl(doc.as<JsonVariantConst>());
  }
  if (!estop) attachServos();
  Serial.printf("Start: mode=%s estop=%d\n", mode.c_str(), estop);
}

void loop() {
  unsigned long now = millis();
  // Wi-Fi lost: retry in the background every 10 s; tracking keeps running meanwhile
  if (WiFi.status() != WL_CONNECTED && now - lastWifiTry > 10000) { lastWifiTry = now; WiFi.reconnect(); }

  if (now - lastMove >= MOVE_EVERY_MS) { lastMove = now; moveOnce(); }

  if (now - lastControl >= CONTROL_EVERY_MS) { lastControl = now; pollControl(); }

  if (now - lastLive >= LIVE_EVERY_MS) {
    lastLive = now;
    String payload = buildPayload();
    int code = firebase("PUT", "live", payload);
    if (code != 200) Serial.printf("live write: HTTP %d\n", code);
    if (now - lastHistory >= HISTORY_EVERY_MS || lastHistory == 0) {
      lastHistory = now;
      firebase("POST", "history", payload);
    }
  }
}
