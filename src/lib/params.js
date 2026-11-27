/* The 16 mandatory float parameters from the spec, in spec order.
   `key` matches the JSON field inside "telemetry". */
export const PARAMS = [
  { n: 1, key: "ambient_temp_c", label: "Ambient Temperature", unit: "°C", group: "weather" },
  { n: 2, key: "ambient_temp_f", label: "Ambient Temperature", unit: "°F", group: "weather" },
  { n: 3, key: "humidity_pct", label: "Humidity", unit: "%", group: "weather" },
  { n: 4, key: "heat_index_c", label: "Heat Index", unit: "°C", group: "weather" },
  { n: 5, key: "heat_index_f", label: "Heat Index", unit: "°F", group: "weather" },
  { n: 6, key: "dew_point_c", label: "Dew Point", unit: "°C", group: "weather" },
  { n: 7, key: "dew_point_f", label: "Dew Point", unit: "°F", group: "weather" },
  { n: 8, key: "panel_temp_c", label: "Panel Temperature", unit: "°C", group: "panel" },
  { n: 9, key: "panel_temp_f", label: "Panel Temperature", unit: "°F", group: "panel" },
  { n: 10, key: "light_intensity_lux", label: "Light Intensity", unit: "lux", group: "panel" },
  { n: 11, key: "shunt_voltage_mv", label: "Shunt Voltage", unit: "mV", group: "power" },
  { n: 12, key: "bus_voltage_v", label: "Bus Voltage", unit: "V", group: "power" },
  { n: 13, key: "current_ma", label: "Current", unit: "mA", group: "power" },
  { n: 14, key: "load_voltage_v", label: "Load Voltage", unit: "V", group: "power" },
  { n: 15, key: "power_mw", label: "Power", unit: "mW", group: "power" },
  { n: 16, key: "capacity_mah", label: "Capacity", unit: "mAh", group: "power" }
];

export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map(p => [p.key, p]));

/* Dashboard cards. °C/°F pairs share one card so all 16 values stay visible
   without 16 separate boxes. */
export const CARD_GROUPS = [
  {
    id: "weather", title: "Weather", hint: "DHT22", accent: "sky",
    cards: [
      { id: "ambient", icon: "thermo", main: "ambient_temp_c", alt: "ambient_temp_f", label: "Ambient Temperature" },
      { id: "humidity", icon: "drop", main: "humidity_pct", label: "Humidity" },
      { id: "heat", icon: "flame", main: "heat_index_c", alt: "heat_index_f", label: "Heat Index" },
      { id: "dew", icon: "dew", main: "dew_point_c", alt: "dew_point_f", label: "Dew Point" }
    ]
  },
  {
    id: "panel", title: "Panel", hint: "DS18B20 · BH1750", accent: "amber",
    cards: [
      { id: "ptemp", icon: "panel", main: "panel_temp_c", alt: "panel_temp_f", label: "Panel Temperature" },
      { id: "lux", icon: "sun", main: "light_intensity_lux", label: "Light Intensity" }
    ]
  },
  {
    id: "power", title: "Electrical output", hint: "INA219", accent: "emerald",
    cards: [
      { id: "bus", icon: "bolt", main: "bus_voltage_v", label: "Bus Voltage" },
      { id: "shunt", icon: "wave", main: "shunt_voltage_mv", label: "Shunt Voltage" },
      { id: "load", icon: "plug", main: "load_voltage_v", label: "Load Voltage" },
      { id: "current", icon: "current", main: "current_ma", label: "Current" },
      { id: "power", icon: "gauge", main: "power_mw", label: "Power", altCalc: v => [v / 1000, "W"] },
      { id: "cap", icon: "battery", main: "capacity_mah", label: "Capacity" }
    ]
  }
];

export function fmt(v, digits = 2) {
  if (v == null || !Number.isFinite(v)) return "--";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
