// Copy this file to "secrets.h" (same folder) and fill in the values.
// secrets.h is git-ignored. Never commit real passwords.
#pragma once

#define WIFI_SSID       "your-wifi-name"
#define WIFI_PASSWORD   "your-wifi-password"

// Firebase console > Project settings > General
#define FIREBASE_API_KEY  "AIzaSy..."
// Realtime Database URL, WITHOUT the trailing slash
#define FIREBASE_DB_URL   "https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app"

// The DEVICE account (Authentication > Users). Not the operator account.
#define DEVICE_EMAIL      "device@sunflower.com"
#define DEVICE_PASSWORD   "device-password"
