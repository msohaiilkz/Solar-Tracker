import { Suspense, lazy, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Icon from "./Icon.jsx";
import { Panel, Num, Status } from "./ui.jsx";
import { FlowDiagram } from "./Illustrations.jsx";
import { useTelemetry } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";
import { derive } from "../lib/derived.js";
import { sunPosition, siteNow } from "../lib/sun.js";
import { modelDayGain } from "../lib/energy.js";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
const TrackerScene = lazy(() => import("./three/TrackerScene.jsx"));

const LAYERS = [
  { icon: "sun", title: "Sensing", text: "Four LDRs find the sun. DHT22, DS18B20, BH1750 and INA219 measure the air, the panel, the light and the power." },
  { icon: "chip", title: "Processing", text: "The ESP32 compares opposite light sensors, drives both motors and packs every reading into JSON." },
  { icon: "cloud", title: "Cloud", text: "Readings travel over Wi-Fi to Firebase Realtime Database. Commands from this site come back the same way." },
  { icon: "grid", title: "Dashboard", text: "This web app shows the live data, the charts and the tracker, and sends control commands." }
];

const STEPS = [
  ["Read", "Read the four light sensors: north, south, east and west."],
  ["Compare", "Work out west − east for the azimuth and north − south for the tilt."],
  ["Ignore small gaps", "If a difference is within ±5 %, that motor stays still. This stops the panel from jittering."],
  ["Move", "Otherwise turn that axis a step toward the brighter side, then repeat."]
];

const JOURNEY = [
  { title: "Idea and proposal", text: "Problem defined: fixed panels waste sunlight. Dual-axis tracking chosen, supervisors approved the scope.", state: "done" },
  { title: "Cloud and data contract", text: "Firebase Realtime Database, security rules, device and operator logins, and the JSON format for all 16 readings.", state: "done" },
  { title: "Web dashboard", text: "Live telemetry, 3D tracking view, control console, analytics, alerts and export. Deployed on Firebase Hosting.", state: "done" },
  { title: "Hardware and firmware", text: "ESP32, sensors, motors and the tracking loop, sending data to the same Firebase project.", state: "active" },
  { title: "Field testing", text: "Run the tracker in the sun, compare against a fixed panel and record the results for the thesis.", state: "next" }
];

const STACK = [
  ["ESP32 + Arduino", "Firmware"], ["Firebase RTDB", "Realtime cloud"], ["React 19", "Interface"], ["Tailwind CSS 4", "Styling"],
  ["Three.js", "3D model"], ["GSAP", "Motion"], ["Chart.js", "Charts"], ["Vite", "Build"]
];

const initials = name => name.replace(/^(Dr|Ms|Mr|Mrs|Prof)\.?\s+/i, "").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

/* Making it easy for an ordinary owner: what this version already does, and what comes next */
const PRODUCT = [
  { icon: "grid", title: "Install like an app", text: "Add to the home screen from the browser. No Play Store, no APK.", now: true },
  { icon: "book", title: "Built-in guide", text: "A one-minute tour explains every screen on the first visit.", now: true },
  { icon: "sun", title: "Ask in plain words", text: "The assistant answers in English or Roman Urdu, using live readings.", now: true },
  { icon: "bell", title: "Alerts with sound", text: "Hot panel, dust, offline device or emergency stop: a beep, a vibration and a notification.", now: true },
  { icon: "cloudSun", title: "Tomorrow's sunshine", text: "Free weather data predicts how much energy the panel will make.", now: true },
  { icon: "printer", title: "One-tap report", text: "A clean PDF of the day's energy, gain and findings.", now: true },
  { icon: "wifi", title: "Wi-Fi setup by phone", text: "Scan a QR code on the box and enter the home Wi-Fi. No code changes for the owner.", now: false },
  { icon: "bell", title: "Alerts when the app is closed", text: "A Telegram or WhatsApp message for offline or dusty panels, even with the phone locked.", now: false },
  { icon: "info", title: "Full Urdu interface", text: "Every screen in Urdu, with large text and simple words for older users.", now: false },
  { icon: "layers", title: "Many trackers, one account", text: "A farm or a school sees all its panels on one map, with totals for the month.", now: false },
  { icon: "battery", title: "Savings in rupees", text: "Turn watt-hours into money saved on the electricity bill, using the local tariff.", now: false },
  { icon: "wind", title: "Weather protection", text: "Lay the panel flat automatically before a storm, using the forecast and a wind sensor.", now: false }
];

const hwIcon = part => {
  const p = part.toLowerCase();
  if (p.includes("esp")) return "chip";
  if (p.includes("ldr") || p.includes("bh1750")) return "sun";
  if (p.includes("servo") || p.includes("motor")) return "compass";
  if (p.includes("dht")) return "drop";
  if (p.includes("ds18")) return "thermo";
  if (p.includes("ina")) return "bolt";
  return "chip";
};

export default function About() {
  const { cfg, live } = useTelemetry();
  const { c, theme } = useTheme();
  const p = cfg.project;
  const root = useRef(null);
  const d = derive(live, cfg);
  const doy = live?.doy ?? siteNow(cfg.site, new Date()).doy;
  const gain = useMemo(() => modelDayGain(cfg, doy), [cfg, doy]);

  const poseRef = useRef({ az: 180, tilt: 40, sunAz: 160, sunEl: 40 });
  if (d) poseRef.current = { az: live.az ?? d.sun.az, tilt: live.el ?? 90 - d.sun.el, sunAz: d.sun.az, sunEl: d.sun.el };
  const path = useMemo(() => {
    const pts = [];
    for (let m = 6 * 60; m <= 18 * 60; m += 8) { const s = sunPosition(cfg.site, doy, m); if (s.el > -2) pts.push([s.az, s.el]); }
    return pts;
  }, [cfg.site, doy]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const q = gsap.utils.selector(root);
    const scroller = document.getElementById("scroller") || undefined;

    document.fonts.ready.then(() => {
      if (!root.current) return;
      SplitText.create(q(".about-title"), {
        type: "lines,words", mask: "lines", autoSplit: true,
        onSplit: self => gsap.from(self.words, { yPercent: 110, duration: 0.9, ease: "expo.out", stagger: 0.03 })
      });
    });
    gsap.from(q(".about-fade"), { y: 18, autoAlpha: 0, duration: 0.8, ease: "power3.out", stagger: 0.08, delay: 0.25 });

    /* journey line fills as you scroll */
    gsap.fromTo(q(".journey-fill"), { scaleY: 0 }, {
      scaleY: 1, ease: "none",
      scrollTrigger: { trigger: q(".journey")[0], scroller, start: "top 75%", end: "bottom 60%", scrub: 0.6 }
    });
    q(".journey-item").forEach(el => gsap.from(el, {
      x: -24, autoAlpha: 0, duration: 0.7, ease: "power3.out",
      scrollTrigger: { trigger: el, scroller, start: "top 85%" }
    }));
    gsap.from(q(".stack-chip"), {
      autoAlpha: 0, duration: 0.6, ease: "power2.out", stagger: 0.05,
      scrollTrigger: { trigger: q(".stack")[0], scroller, start: "top 85%" }
    });
  }, { scope: root });

  return (
    <div ref={root} className="space-y-5">
      {/* hero */}
      <header className="panel reveal relative grid grid-cols-1 items-center overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" style={{ "--i": 0 }}>
        <div className="hdr-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="hdr-glow pointer-events-none absolute -left-24 -top-32 size-[460px] rounded-full" aria-hidden="true" />
        <div className="relative p-6 sm:p-10">
          <p className="about-fade inline-flex items-center gap-2 rounded-full border border-line bg-subtle/80 px-3 py-1 text-[12px] font-medium text-ink-2 backdrop-blur">
            <Icon name="info" className="size-3.5" />Final year project · {p.university}
          </p>
          <h1 className="about-title mt-4 text-[32px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[46px]">{p.title}</h1>
          <p className="about-fade mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
            A fixed solar panel faces the sun properly for only a short part of the day. Sunflower turns the panel on two axes so it keeps facing the sun from sunrise to sunset, and reports everything it measures to this dashboard.
          </p>
          <div className="about-fade mt-6 flex flex-wrap gap-2">
            <a href="#/overview" className="btn btn-primary h-10 rounded-full px-4">Open live dashboard <Icon name="arrowUpRight" className="size-4" /></a>
            <a href="#/home" className="btn btn-secondary h-10 rounded-full px-4">Watch the intro</a>
          </div>
          <p className="about-fade mt-6 text-[12.5px] text-muted">{p.department}</p>
        </div>
        <div className="relative h-[340px] sm:h-[420px] lg:h-full lg:min-h-[460px]">
          <Suspense fallback={null}>
            <TrackerScene poseRef={poseRef} path={path} c={c} dark={theme === "dark"} interactive autoRotate labels={false}
              camera={[-3.5, 4.6, -8.6]} fov={42} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
          </Suspense>
          <span className="pointer-events-none absolute bottom-4 right-5 text-[12px] text-muted">Drag to turn</span>
        </div>
      </header>

      {/* at a glance */}
      <section className="panel reveal grid grid-cols-2 gap-px overflow-hidden bg-line lg:grid-cols-4" style={{ "--i": 1 }}>
        {[
          [16, 0, "", "live readings", "weather, panel, power"],
          [2, 0, "", "axes of motion", "azimuth and tilt"],
          [4, 0, "", "light sensors", "north, south, east, west"],
          [gain, 0, "%", "more direct sunlight", "than a fixed panel, clear-sky model"]
        ].map(([v, dg, u, l, n], i) => (
          <div key={l} className="bg-surface px-6 py-6">
            <div className="text-[40px] font-semibold leading-none tracking-[-0.05em]">
              {i === 3 && "+"}<Num value={v} digits={dg} />{u && <span className="text-[20px] text-muted">{u}</span>}
            </div>
            <div className="mt-2 text-[14px] font-medium">{l}</div>
            <div className="text-[12.5px] text-muted">{n}</div>
          </div>
        ))}
      </section>

      <Panel i={2} title="Data flow" meta="Readings go up, commands come back down">
        <div className="overflow-x-auto"><div className="mx-auto min-w-[560px] max-w-[820px]"><FlowDiagram /></div></div>
      </Panel>

      <Panel i={3} title="How it works" meta="Four layers from sunlight to this screen" bodyClass="">
        <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-b-xl bg-line sm:grid-cols-2 xl:grid-cols-4">
          {LAYERS.map((l, i) => (
            <li key={l.title} className="group relative overflow-hidden bg-surface p-6 transition-colors hover:bg-subtle/60">
              <Icon name={l.icon} className="pointer-events-none absolute -right-6 -top-6 size-28 text-line transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110" strokeWidth={0.8} />
              <div className="relative flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl border border-line bg-subtle text-ink transition-colors group-hover:border-sun/50 group-hover:text-sun-ink"><Icon name={l.icon} className="size-5" /></span>
              </div>
              <div className="relative mt-5 font-mono text-[11.5px] text-muted">0{i + 1}</div>
              <h3 className="relative mt-1 text-[16px] font-semibold tracking-[-0.01em]">{l.title}</h3>
              <p className="relative mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{l.text}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel i={4} title="Tracking logic" meta="Differential comparison of the light sensors">
          <ol className="space-y-3.5">
            {STEPS.map(([t, s], i) => (
              <li key={t} className="flex gap-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-semibold text-on-primary">{i + 1}</span>
                <p className="pt-0.5 text-[13.5px] leading-relaxed"><span className="font-medium">{t}.</span> <span className="text-ink-2">{s}</span></p>
              </li>
            ))}
          </ol>
          <div className="mt-5 overflow-hidden rounded-xl border border-line bg-[#141412]">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
              {["#ff5f57", "#febc2e", "#28c840"].map(x => <span key={x} className="size-2.5 rounded-full" style={{ background: x }} />)}
              <span className="ml-2 font-mono text-[11.5px] text-white/50">tracking.ino</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-white/80">
              <span className="text-white/40">{"// compare opposite sensors\n"}</span>
              {"int dEW = west - east;\nint dNS = north - south;\n"}
              <span className="text-[#f2b100]">if</span>{" (abs(dEW) > DEADBAND) azimuth += (dEW > 0) ? STEP : -STEP;\n"}
              <span className="text-[#f2b100]">if</span>{" (abs(dNS) > DEADBAND) tilt    -= (dNS > 0) ? STEP : -STEP;"}
            </pre>
          </div>
        </Panel>

        <Panel i={5} title="Hardware" meta="Parts on the tracker" bodyClass="p-3">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {p.hardware.map(h => (
              <li key={h.part} className="group flex items-center gap-3 rounded-xl border border-line bg-subtle/40 p-3 transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-ink-2 ring-1 ring-line transition-colors group-hover:text-sun-ink"><Icon name={hwIcon(h.part)} className="size-[18px]" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{h.part}</span>
                  <span className="block truncate text-[12px] text-muted">{h.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel i={6} title="Project journey" meta="Where the work stands">
          <ol className="journey relative ml-3 space-y-6 py-1">
            <span className="absolute -left-px top-2 bottom-2 w-0.5 rounded-full bg-line" aria-hidden="true" />
            <span className="journey-fill absolute -left-px top-2 bottom-2 w-0.5 origin-top rounded-full bg-sun" aria-hidden="true" />
            {JOURNEY.map(j => (
              <li key={j.title} className="journey-item relative pl-7">
                <span className={`absolute -left-[7px] top-1 grid size-4 place-items-center rounded-full ring-4 ring-surface ${j.state === "done" ? "bg-sun" : j.state === "active" ? "bg-surface ring-sun/0 outline-2 outline-sun" : "bg-line-strong"}`}>
                  {j.state === "done" && <Icon name="check" className="size-2.5 text-[#141412]" strokeWidth={3} />}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14.5px] font-semibold">{j.title}</h3>
                  {j.state === "done" && <Status tone="good" className="text-[12px]">Done</Status>}
                  {j.state === "active" && <Status tone="sun" live className="text-[12px]">In progress</Status>}
                  {j.state === "next" && <Status tone="idle" className="text-[12px]">Next</Status>}
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{j.text}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel i={7} title="Built with" meta="Free and open tools">
          <ul className="stack grid grid-cols-2 gap-2">
            {STACK.map(([n, r]) => (
              <li key={n} className="stack-chip rounded-xl border border-line bg-subtle/40 px-3.5 py-3 transition-colors duration-300 hover:border-line-strong">
                <div className="text-[13.5px] font-medium">{n}</div>
                <div className="text-[12px] text-muted">{r}</div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel i={8} title="From prototype to product" meta="How an ordinary owner would use Sunflower: what this version already does, and the next steps">
        <div className="mb-4 flex flex-wrap gap-4 text-[12.5px]">
          <Status tone="good">In this version</Status>
          <Status tone="idle">Next steps</Status>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRODUCT.map(f => (
            <li key={f.title} className={`relative flex gap-3 rounded-xl border p-4 transition-colors ${f.now ? "border-good/25 bg-good/[.04] hover:border-good/50" : "border-dashed border-line-strong bg-transparent hover:border-ink-2/40"}`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${f.now ? "bg-good/12 text-good-ink" : "bg-subtle text-muted ring-1 ring-line"}`}><Icon name={f.icon} className="size-[18px]" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[14px] font-semibold">{f.title}{f.now && <Icon name="check" className="size-3.5 text-good-ink" strokeWidth={2.6} />}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-2">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Panel i={9} title="Supervision" meta={p.department} bodyClass="p-4">
          <ul className="space-y-3">
            {[[p.supervisor, "Supervisor"], [p.coSupervisor, "Co-supervisor"]].map(([name, role]) => (
              <li key={role} className="flex items-center gap-4 rounded-xl border border-line bg-subtle/40 p-4 transition-colors duration-300 hover:border-line-strong">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#141412] text-[15px] font-semibold text-sun ring-4 ring-sun/15">
                  {initials(name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{name}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-sun/12 px-2 py-0.5 text-[11.5px] font-medium text-sun-ink">
                    <Icon name="info" className="size-3" />{role}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel i={10} title="Project team" meta={`${p.team.length} students · BS Information Technology`} bodyClass="p-4">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.team.map(m => (
              <li key={m.roll} className="flex items-center gap-3.5 rounded-xl border border-line bg-subtle/40 p-3.5 transition-colors duration-300 hover:border-line-strong">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sun to-[#eb6834] text-[15px] font-semibold text-[#141412]">
                  {initials(m.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-medium">{m.name}</span>
                  <span className="block truncate font-mono text-[12px] text-muted">{m.roll}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <p className="pt-4 text-center text-[12px] text-muted">© {new Date().getFullYear()} {p.name} · {p.university}</p>
    </div>
  );
}
