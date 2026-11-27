# Firebase Setup Guide (Step by Step)

Sab kuch **free** hai (Firebase "Spark" plan). Credit card ki zaroorat nahi.
Total time: ~30–40 minute.

---

## Step 0 — Ek team Gmail account

1. Project ke liye **alag Gmail** banayein, maslan `sunflower.fyp.gcuh@gmail.com`.
   Personal Gmail use na karein, taake baad mein ownership ka masla na ho.
2. Password sirf team leader ke paas rahe.

---

## Step 1 — Firebase project banana

1. <https://console.firebase.google.com> kholein aur us Gmail se login karein.
2. **Create a project** (ya "Get started with a Firebase project") dabayein.
3. Project name: `sunflower-solar-tracker`
   (Firebase is ke aage kuch letters laga sakta hai. Jo **Project ID** dikhe, note kar lein.)
4. **Google Analytics:** OFF kar dein. Is ki zaroorat nahi.
5. **Create project** dabayein, 1 minute wait karein, phir **Continue**.

---

## Step 2 — Realtime Database banana

1. Left menu: **Build → Realtime Database → Create Database**
2. **Location:** `Singapore (asia-southeast1)`. Ye Pakistan ke sab se qareeb hai.
3. Security rules: **Start in locked mode** chunein. ⚠️ "Test mode" mat chunein.
4. **Enable** dabayein.
5. Upar database ka URL nazar aayega, kuch is tarah:
   `https://sunflower-solar-tracker-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app`
   Is ko copy kar ke note kar lein. Ye **databaseURL** hai.

### Rules lagana

1. Realtime Database ke andar **Rules** tab kholein.
2. Wahan jo likha hai sab mita dein.
3. Project folder ki file `database.rules.json` ka poora content copy kar ke wahan paste karein.
4. **Publish** dabayein.

Ye rules ye karte hain:
- Live readings aur history **sab dekh sakte hain**, taake examiner bina login ke dashboard dekh sake.
- Panel control **sirf login wala** kar sakta hai.
- Galat values (maslan elevation 500°) database khud reject kar deta hai.

---

## Step 3 — Login (Authentication) on karna

1. Left menu: **Build → Authentication → Get started**
2. **Sign-in method** tab mein **Email/Password** par click karein.
3. Pehla toggle **Enable** karein (dusra "Email link" OFF hi rehne dein), phir **Save**.

### Do users banana (Users tab → Add user)

| User | Email | Kis ke liye |
|---|---|---|
| Operator | aap ki team ki asli email | Website par login kar ke panel control karna |
| Device | `device@sunflower.com` (fake bhi chalega) | ESP32 is account se data likhega |

- Dono ke liye mazboot password rakhein, kam az kam 10 characters.
- Operator ke liye **asli email** rakhein, taake "Forgot password" kaam kare.
- Har team member ke liye alag operator account bhi bana sakte hain.

---

## Step 4 — Website ko Firebase se jorna

1. Left menu ke upar **⚙️ (gear) → Project settings → General** kholein.
2. Neeche **Your apps** mein **`</>` (Web)** icon dabayein.
3. App nickname: `sunflower-web`. "Firebase Hosting" checkbox **mat** lagayein (wo hum baad mein khud karenge). Phir **Register app**.
4. Ek code dikhega jis mein `firebaseConfig = { ... }` hoga.
5. Project mein `src/config.js` kholein aur ye 5 values paste karein:

```js
firebase: {
  apiKey: "AIza....",
  authDomain: "sunflower-solar-tracker-xxxx.firebaseapp.com",
  databaseURL: "https://sunflower-solar-tracker-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sunflower-solar-tracker-xxxx",
  appId: "1:1234567890:web:abcdef..."
},
```

> ⚠️ Agar `databaseURL` code mein na aaye to Step 2 wala URL khud paste kar dein.
> `apiKey` ka public hona theek hai, ye password nahi hai. Asli security rules se aati hai.

---

## Step 5 — Hardware ke baghair poora test karna

Project folder mein do terminal kholein.

**Terminal 1 (website):**
```powershell
npm run dev
```
Browser mein `http://localhost:5173` kholein. Status **CONNECTING / OFFLINE** dikhayega, kyunke abhi koi device data nahi bhej raha.

**Terminal 2 (fake ESP32):**
```powershell
$env:DEVICE_EMAIL="device@sunflower.com"; $env:DEVICE_PASSWORD="device-ka-password"; npm run fake-device
```

Ab check karein:
- [ ] Website par status **LIVE** ho gaya
- [ ] 16/16 parameters aa rahe hain
- [ ] Firebase console → Realtime Database → **Data** tab mein `devices/dual-axis-solar-01/live` har second badal raha hai
- [ ] Website par **Log in** (operator account) → MANUAL → jog button dabayein → Terminal 2 mein `← control:` likha aaye, aur website par "Confirmed by device ✓" aaye
- [ ] EMERGENCY STOP dabayein → panel ruk jaye
- [ ] Terminal 2 band karein (Ctrl+C) → 60 second baad website **OFFLINE** dikhaye
- [ ] CSV / JSON export file download ho

Sab ✓ ho gaya to software poori tarah ready hai. Ab sirf asli ESP32 ne yahi kaam karna hai.

---

## Step 6 — Website ko internet par live karna (free URL)

Ye ek hi baar karna hai:
```powershell
npm install -g firebase-tools
firebase login
firebase use --add
```
`firebase use --add` mein apna project chunein, aur alias mein `default` likh dein.

Phir jab bhi website update karni ho:
```powershell
npm run deploy
```
Website live ho jayegi: `https://<project-id>.web.app`. Yahi link examiner ko dena hai.

---

## Step 7 — Senior ko kya dena hai (hardware hand-over)

Senior ko ye cheezein dein:
1. `docs/HARDWARE_HANDOVER.md` file
2. **Web API Key** (Project settings → General → Web API Key)
3. **Database URL** (Step 2)
4. **Device account** ka email aur password (sirf device wala)
5. Device ID: `dual-axis-solar-01`

Ye cheezein **mat** dein:
- ❌ Gmail ka password
- ❌ Operator account ka password
- ❌ Service account / private key files (hamein in ki zaroorat hi nahi)

Agar kisi team member ko console access chahiye to Project settings → **Users and permissions → Add member** se add karein. Password share karne ki zaroorat nahi.

---

## ✅ Karna hai / ❌ Nahi karna

| ✅ Karna hai | ❌ Nahi karna |
|---|---|
| Locked mode + hamari rules file | "Test mode" rules (30 din baad band, aur sab ke liye khuli) |
| Spark (free) plan | Blaze plan / card add karna |
| ESP32: live har 2–5 sec, history har 30 sec | Har 100 ms likhna (free quota khatam ho jayega) |
| Device ke liye alag account | Operator ka password ESP32 mein daalna |
| Path aur field names spec ke mutabiq | Senior ko bataye baghair `deviceId` ya field names badalna |

### Free plan limits (hamare liye kaafi hain)
- Database: 1 GB storage, 10 GB/month download, ek waqt mein 100 connections
- Hosting: 10 GB storage, 360 MB/day transfer
- Hamara andaza: history har 30 sec ≈ 2 MB/din ≈ 60 MB/month

---

## Masla aaye to

| Masla | Hal |
|---|---|
| Website hamesha **DEMO DATA** dikhaye | `src/config.js` mein apiKey / databaseURL / projectId khali hain |
| `PERMISSION_DENIED` | Rules publish nahi hue, ya device login nahi hua |
| Login: "Email or password is incorrect" | Authentication → Users mein user maujood hai? Email/Password enable hai? |
| Status **OFFLINE** jabke device chal raha hai | ESP32 ka `ts` galat hai. NTP time set karein (handover doc dekhein) |
| Presentation mein internet / hardware ka masla | URL ke aakhir mein `?demo` laga dein, maslan `https://<project-id>.web.app/?demo` |
