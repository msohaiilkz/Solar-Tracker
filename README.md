# SUNFLOWER: Dual-Axis Solar Tracker Dashboard

FYP web dashboard: GC University Hyderabad, Department of IT.
React + Tailwind CSS + Chart.js + Firebase Realtime Database.

## Run

```powershell
npm install        # first time only
npm run dev        # http://localhost:5173
```

Without Firebase config the site runs on **demo data** (a built-in simulator).
Add `?demo` to the URL to force demo mode at any time.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local development server |
| `npm run build` | Production build into `dist/` |
| `npm run fake-device` | Fake ESP32 that writes to the real Firebase (needs `DEVICE_EMAIL`, `DEVICE_PASSWORD`) |
| `npm run deploy` | Build and publish to Firebase Hosting + database rules |

## Install as an app (PWA)

The deployed site (`https://<project-id>.web.app`) can be installed like an app, free and from the same code:
- **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**
- **iPhone (Safari):** Share → **Add to Home Screen**
- **Laptop (Chrome/Edge):** the install icon in the address bar

The service worker is only active in the production build (`npm run build` / deploy), not in `npm run dev`.
To redraw the icons: `node tools/make-icons.mjs`.

## Docs

- [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md): Firebase account, database, login, hosting (step by step)
- [docs/HARDWARE_HANDOVER.md](docs/HARDWARE_HANDOVER.md): data contract for the ESP32 firmware

## Structure

```
src/
  config.js            ← the only file to edit (Firebase keys, limits, team)
  App.jsx
  components/          Header, Hero, Telemetry, Tracking, Control, Analytics, System, About, LoginModal
  hooks/useTelemetry   central data store (live, history, control, auth)
  lib/
    dataSource.js      Firebase or demo, same interface
    demoDevice.js      simulator (same JSON as the ESP32)
    sun.js             sun position, heat index, dew point
    params.js          the 16 spec parameters
database.rules.json    Firebase security rules
tools/fake-device.mjs  ESP32 stand-in for end-to-end testing
tools/make-icons.mjs   regenerates the PWA icons
firmware/sunflower_esp32/  reference ESP32 sketch (copy secrets.example.h → secrets.h)
public/manifest.webmanifest, public/sw.js   PWA (installable app)
```
