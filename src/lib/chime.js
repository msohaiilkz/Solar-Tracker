/* Alert sounds made with the Web Audio API (no audio files), phone vibration,
   and a flashing tab title while the page is in the background. */
let ctx = null;

/* Browsers only allow sound after the user has interacted with the page once */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio support */ }
}

function beep(freq, start, dur = 0.18, vol = 0.18) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

const PATTERNS = {
  crit: [[880, 0], [660, 0.22], [880, 0.44], [660, 0.66]],   // urgent two-tone, twice
  warn: [[740, 0], [740, 0.24]],                              // double beep
  good: [[523, 0, 0.14, 0.12], [784, 0.14, 0.22, 0.12]],      // soft rising
  info: [[660, 0, 0.15, 0.12]]
};
const VIBRATE = { crit: [220, 100, 220, 100, 220], warn: [160, 80, 160], good: [80], info: [80] };

export function chime(tone = "info") {
  try {
    if (!ctx) unlockAudio();
    if (!ctx || ctx.state !== "running") return;
    (PATTERNS[tone] || PATTERNS.info).forEach(([f, t, d, v]) => beep(f, t, d, v));
  } catch { /* ignore */ }
}

export function vibrate(tone = "info") {
  try { navigator.vibrate?.(VIBRATE[tone] || VIBRATE.info); } catch { /* ignore */ }
}

/* "🔔 Panel is hot" alternating with the normal title until the tab is opened */
let flashTimer = null, savedTitle = null;
export function flashTitle(text) {
  if (!document.hidden) return;
  if (savedTitle == null) savedTitle = document.title;
  clearInterval(flashTimer);
  let on = false;
  flashTimer = setInterval(() => { on = !on; document.title = on ? `🔔 ${text}` : savedTitle; }, 1000);
  const stop = () => {
    if (document.hidden) return;
    clearInterval(flashTimer); flashTimer = null;
    if (savedTitle != null) document.title = savedTitle;
    savedTitle = null;
    document.removeEventListener("visibilitychange", stop);
  };
  document.addEventListener("visibilitychange", stop);
}
