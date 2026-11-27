/* Cinematic intro page: 3D tracker, scroll-driven day, split-text headings,
   counters, horizontal cards, live preview. GSAP + ScrollTrigger + SplitText + Lenis. */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import Icon from "./Icon.jsx";
import { Num, Sparkline, Status } from "./ui.jsx";
import { ThemeToggle } from "./Shell.jsx";
import { useTelemetry, useDeviceStatus } from "../hooks/useTelemetry.jsx";
import { useTheme } from "../hooks/useTheme.jsx";
import { sunPosition, dayTimes, fmtClock, siteNow } from "../lib/sun.js";
import { modelDayGain } from "../lib/energy.js";
import { fmt } from "../lib/params.js";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
const TrackerScene = lazy(() => import("./three/TrackerScene.jsx"));
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const LAYERS = [
  { n: "01", icon: "sun", title: "Sense", text: "Four light sensors sit in a cross on the panel edge. DHT22, DS18B20, BH1750 and INA219 read the air, the panel, the light and the power." },
  { n: "02", icon: "chip", title: "Decide", text: "The ESP32 compares west with east and top with bottom. If one side is brighter by more than 5 %, that motor takes a step toward it." },
  { n: "03", icon: "cloud", title: "Share", text: "Every few seconds the readings travel over Wi-Fi to Firebase Realtime Database as clean JSON, with a timestamp." },
  { n: "04", icon: "grid", title: "Show & steer", text: "This web app turns the numbers into charts and a live 3D model, and lets an operator take manual control from anywhere." }
];

function Marquee({ items }) {
  const row = items.map((t, i) => (
    <span key={i} className="flex items-center gap-10 pr-10">
      <span>{t}</span><span className="inline-block size-3 rounded-full bg-sun" aria-hidden="true" />
    </span>
  ));
  return (
    <div className="relative overflow-hidden border-y border-line py-6" aria-hidden="true">
      <div className="marquee flex w-max whitespace-nowrap text-[clamp(36px,6vw,84px)] font-semibold tracking-[-0.04em] text-ink">
        <div className="flex">{row}</div><div className="flex">{row}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { cfg, live, history, kind } = useTelemetry();
  const { status } = useDeviceStatus();
  const { c, theme } = useTheme();
  const root = useRef(null);
  const clock = useRef(null);
  const bar = useRef(null);
  const glow = useRef(null);
  const cta = useRef(null);

  const doy = live?.doy ?? siteNow(cfg.site, new Date()).doy;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 900px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)"), on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const day = useMemo(() => dayTimes(cfg.site, doy), [cfg.site, doy]);
  const gain = useMemo(() => modelDayGain(cfg, doy), [cfg, doy]);
  const path = useMemo(() => {
    const pts = [];
    for (let m = day.sunrise - 10; m <= day.sunset + 10; m += 6) { const s = sunPosition(cfg.site, doy, m); pts.push([s.az, s.el]); }
    return pts;
  }, [cfg.site, doy, day]);

  const start = day.sunrise + 70, end = day.sunset - 5;
  const poseRef = useRef({});
  const setTime = m => {
    const s = sunPosition(cfg.site, doy, m);
    poseRef.current = { ...poseRef.current, sunAz: s.az, sunEl: s.el, az: s.el > 0 ? s.az : 180, tilt: s.el > 0 ? Math.min(90, 90 - s.el) : 0 };
    if (clock.current) clock.current.textContent = fmtClock(m);
    if (glow.current) {
      const p = (m - day.sunrise) / (day.sunset - day.sunrise);
      glow.current.style.setProperty("--gx", `${30 + p * 55}%`);
      glow.current.style.setProperty("--gy", `${60 - Math.sin(p * Math.PI) * 40}%`);
    }
  };
  if (!poseRef.current.sunAz) setTime(start);

  /* smooth scrolling */
  useEffect(() => {
    if (reduced()) return;
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = t => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    document.fonts.ready.then(() => {
      /* headline letters rise in */
      SplitText.create(q(".hero-title"), {
        type: "lines,chars", mask: "lines", autoSplit: true,
        onSplit: self => gsap.from(self.chars, { yPercent: 115, duration: 1.1, ease: "expo.out", stagger: 0.022, delay: 0.15 })
      });
      /* section headings reveal word by word on scroll */
      q("[data-split]").forEach(el => {
        SplitText.create(el, {
          type: "lines,words", mask: "lines", autoSplit: true,
          onSplit: self => gsap.from(self.words, { yPercent: 110, duration: 0.9, ease: "power4.out", stagger: 0.035, scrollTrigger: { trigger: el, start: "top 85%" } })
        });
      });
      ScrollTrigger.refresh();
    });

    gsap.from(q(".hero-fade"), { y: 24, autoAlpha: 0, duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.6 });
    gsap.from(q(".nav-in"), { y: -20, autoAlpha: 0, duration: 0.8, ease: "power3.out", stagger: 0.06 });

    mm.add({ motion: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 900px)" }, ctx => {
      const { motion, desktop } = ctx.conditions;
      if (!motion) { setTime((start + end) / 2); return; }

      /* the day passes as you scroll */
      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: q(".story")[0], start: "top top", end: "+=340%", pin: true, scrub: 0.8,
          onUpdate: self => {
            poseRef.current.cam = Math.min(1, self.progress / 0.1);
            setTime(start + self.progress * (end - start));
            if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
          }
        }
      });
      tl.to(q(".hero-copy"), { y: -60, autoAlpha: 0, duration: 0.1 }, 0.04);
      /* captions appear when the clock reaches their moment */
      const pAt = m => (m - start) / (end - start);
      const pn = pAt(day.noon);
      const windows = [[0.11, 0.23], [0.25, pn - 0.08], [pn - 0.05, pn + 0.17], [pAt(day.sunset - 60), 1.1]];
      q(".cap").forEach((el, i) => {
        const [a, b] = windows[i];
        tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.05 }, a);
        if (b <= 1) tl.to(el, { autoAlpha: 0, y: -40, duration: 0.05 }, b - 0.05);
      });
      tl.set({}, {}, 1);

      /* counters */
      q("[data-count]").forEach(el => {
        const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), o = { v: 0 };
        gsap.to(o, {
          v: target, duration: 1.8, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => { el.textContent = (el.dataset.prefix || "") + o.v.toFixed(dec); }
        });
      });

      /* horizontal cards */
      if (desktop) {
        const track = q(".h-track")[0];
        const dist = () => track.scrollWidth - window.innerWidth + 64;
        gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: { trigger: q(".h-section")[0], start: "top top", end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true }
        });
      }

      /* fade-up blocks */
      q("[data-rise]").forEach(el => gsap.from(el, { y: 50, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } }));

      /* magnetic call-to-action */
      const btn = cta.current;
      if (btn) {
        const xTo = gsap.quickTo(btn, "x", { duration: 0.5, ease: "power3" }), yTo = gsap.quickTo(btn, "y", { duration: 0.5, ease: "power3" });
        const move = e => { const r = btn.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.35); yTo((e.clientY - r.top - r.height / 2) * 0.35); };
        const leave = () => { xTo(0); yTo(0); };
        btn.addEventListener("pointermove", move); btn.addEventListener("pointerleave", leave);
        return () => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); };
      }
    });
  }, { scope: root, dependencies: [doy], revertOnUpdate: true });

  const t = live?.t || {};
  const recent = history.slice(-40).map(r => (r.t.power_mw != null ? r.t.power_mw / 1000 : null));
  const statusTone = { demo: "warn", online: "good", offline: "crit", waiting: "idle" }[status];
  const statusText = { demo: "Simulator running", online: "Live from the tracker", offline: "Tracker offline", waiting: "Waiting for the tracker" }[status];
  const caps = [
    [`${fmtClock(day.sunrise)} · Sunrise`, "The panel wakes up facing east, standing almost upright to catch the low sun."],
    ["Morning", "Four light sensors compare left with right and top with bottom. The brighter side wins and a motor takes a small step."],
    [`${fmtClock(day.noon)} · Solar noon`, "The sun is at its highest. The panel lies back and faces south."],
    [`${fmtClock(day.sunset)} · Sunset`, "It follows the last light west, then lays flat to wait for tomorrow."]
  ];

  return (
    <div ref={root} className="grain relative min-h-dvh overflow-x-clip bg-page text-ink">
      {/* nav */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${scrolled ? "border-b border-line bg-page/75 backdrop-blur-xl" : "border-b border-transparent"}`}>
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-5 sm:px-8">
          <a href="#/home" className="nav-in flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[9px] bg-[#141412] text-sun">
              <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" /><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7" /></svg>
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Sunflower</span>
          </a>
          <nav className="nav-in ml-6 hidden items-center gap-6 text-[13.5px] text-ink-2 md:flex">
            <a href="#story" onClick={e => { e.preventDefault(); document.querySelector(".story")?.scrollIntoView(); }} className="hover:text-ink">The day</a>
            <a href="#how" onClick={e => { e.preventDefault(); document.getElementById("how")?.scrollIntoView(); }} className="hover:text-ink">How it works</a>
            <a href="#live" onClick={e => { e.preventDefault(); document.getElementById("live")?.scrollIntoView(); }} className="hover:text-ink">Live</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="nav-in"><ThemeToggle /></span>
            <a href="#/overview" className="nav-in btn btn-primary h-9 rounded-full px-4">Dashboard <Icon name="arrowUpRight" className="size-4" /></a>
          </div>
        </div>
      </header>

      {/* hero + scroll story (pinned) */}
      <section className="story relative h-dvh overflow-hidden" aria-label="A day with the tracker">
        <div ref={glow} className="sun-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[62%] bg-gradient-to-t from-page via-page/85 to-transparent md:hidden" aria-hidden="true" />
        <Suspense fallback={null}>
          <TrackerScene poseRef={poseRef} path={path} c={c} dark={theme === "dark"} parallax rig labels={false} shiftX={wide ? 0.2 : 0}
            className="absolute inset-0" camera={[5.6, 2.9, 6.4]} />
        </Suspense>

        <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 pb-28 sm:px-8 md:justify-center md:pb-0">
          <div className="hero-copy max-w-[640px]">
            <p className="hero-fade mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[12.5px] text-ink-2 backdrop-blur">
              <Status tone={statusTone} live={status === "online" || status === "demo"}>{statusText}</Status>
            </p>
            <h1 className="hero-title text-[clamp(48px,8.4vw,128px)] font-semibold leading-[0.92] tracking-[-0.055em]">
              Follow<br />the sun.
            </h1>
            <p className="hero-fade mt-6 max-w-[460px] text-[clamp(15px,1.4vw,18px)] leading-relaxed text-ink-2">
              Sunflower is a dual-axis solar tracker that turns its panel to face the sun all day, and streams everything it measures to the web.
            </p>
            <div className="hero-fade pointer-events-auto mt-8 flex flex-wrap items-center gap-3">
              <a href="#/overview" className="btn btn-primary h-11 rounded-full px-5 text-[14.5px]">Open live dashboard <Icon name="arrowUpRight" className="size-4" /></a>
              <span className="flex items-center gap-2 text-[13px] text-muted"><span className="scroll-hint" aria-hidden="true" />Scroll to play the day</span>
            </div>
          </div>

          {caps.map(([h, p], i) => (
            <div key={i} className="cap invisible absolute bottom-28 left-5 right-5 max-w-[520px] sm:left-8 md:bottom-auto md:top-1/2 md:-translate-y-1/2">
              <div className="mb-3 text-[13px] font-medium text-sun-ink">{String(i + 1).padStart(2, "0")} / 04</div>
              <h2 className="text-[clamp(32px,4.6vw,64px)] font-semibold leading-[1] tracking-[-0.045em]">{h}</h2>
              <p className="mt-4 text-[clamp(15px,1.3vw,18px)] leading-relaxed text-ink-2">{p}</p>
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1400px] items-end justify-between gap-6 px-5 pb-6 sm:px-8">
          <div>
            <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted">Sun time · {cfg.site.name}</div>
            <div ref={clock} className="mt-1 font-mono text-[clamp(28px,3.4vw,44px)] font-medium tracking-[-0.04em] num">--:--</div>
          </div>
          <div className="mb-3 h-[2px] w-[40%] max-w-[420px] overflow-hidden rounded-full bg-line">
            <div ref={bar} className="h-full origin-left scale-x-0 bg-sun" />
          </div>
        </div>
      </section>

      <Marquee items={["Dual-axis", "Follows the sun", "ESP32", "Firebase", "16 live readings", "Made in Hyderabad"]} />

      {/* numbers */}
      <section className="mx-auto max-w-[1400px] px-5 py-28 sm:px-8 sm:py-36">
        <h2 data-split className="max-w-[900px] text-[clamp(34px,5vw,72px)] font-semibold leading-[1.02] tracking-[-0.045em]">
          A panel that moves collects more of the same sunshine.
        </h2>
        <div className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {[
            [gain ?? 35, "+", 0, "%", "more direct sunlight than a fixed panel today", "Clear-sky model for this date and place"],
            [16, "", 0, "", "readings streamed every few seconds", "Weather, panel and power"],
            [2, "", 0, "", "axes of motion", "Azimuth and tilt"],
            [4, "", 0, "", "light sensors steering it", "North, south, east, west"]
          ].map(([v, pre, dec, unit, label, note]) => (
            <div key={label} data-rise className="bg-surface p-6 sm:p-8">
              <div className="flex items-baseline text-[clamp(44px,6vw,88px)] font-semibold leading-none tracking-[-0.05em]">
                <span data-count={v} data-prefix={pre} data-dec={dec}>{pre}{fmt(v, dec)}</span>
                {unit && <span className="ml-1 text-[0.45em] text-muted">{unit}</span>}
              </div>
              <p className="mt-4 text-[15px] leading-snug">{label}</p>
              <p className="mt-1 text-[12.5px] text-muted">{note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works: horizontal on desktop */}
      <section id="how" className="h-section relative overflow-hidden border-t border-line py-20 md:flex md:h-dvh md:flex-col md:justify-center md:py-0">
        <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <p className="text-[13px] font-medium text-sun-ink">How it works</p>
          <h2 data-split className="mt-3 max-w-[760px] text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.03] tracking-[-0.045em]">From a ray of light to a line on your screen.</h2>
        </div>
        <div className="h-track mt-12 flex flex-col gap-5 px-5 sm:px-8 md:w-max md:flex-row md:pl-[max(32px,calc((100vw-1400px)/2+32px))]">
          {LAYERS.map(l => (
            <article key={l.n} className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-3xl border border-line bg-surface p-7 transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgb(0_0_0/.25)] md:h-[420px] md:w-[440px]">
              <Icon name={l.icon} className="pointer-events-none absolute -right-8 top-16 size-[220px] text-line opacity-70 transition-transform duration-700 group-hover:rotate-12 group-hover:scale-105" strokeWidth={0.8} />
              <div className="relative flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-subtle text-ink ring-1 ring-line"><Icon name={l.icon} className="size-6" /></span>
                <span className="text-[56px] font-semibold leading-none tracking-[-0.05em] text-line-strong">{l.n}</span>
              </div>
              <h3 className="relative mt-auto text-[30px] font-semibold tracking-[-0.03em]">{l.title}</h3>
              <p className="relative mt-3 text-[15px] leading-relaxed text-ink-2">{l.text}</p>
            </article>
          ))}
          <article className="flex min-h-[300px] flex-col justify-between rounded-3xl bg-[#141412] p-7 text-white md:h-[400px] md:w-[440px]">
            <span className="text-[13px] text-white/60">The result</span>
            <div>
              <div className="text-[64px] font-semibold leading-none tracking-[-0.05em] text-sun">+{fmt(gain, 0)}%</div>
              <p className="mt-3 text-[15px] leading-relaxed text-white/75">more direct sunlight on a clear day like today, compared with the same panel fixed at {Math.round(Math.abs(cfg.site.lat))}° facing south.</p>
            </div>
          </article>
        </div>
      </section>

      {/* live */}
      <section id="live" className="mx-auto max-w-[1400px] px-5 py-28 sm:px-8 sm:py-36">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[13px]"><Status tone={statusTone} live={status === "online" || status === "demo"}>{statusText}</Status></p>
            <h2 data-split className="mt-3 max-w-[720px] text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.03] tracking-[-0.045em]">Right now, on the roof.</h2>
          </div>
          {kind === "demo" && <p className="max-w-[320px] text-[13px] text-muted">Showing simulated readings until the hardware is connected.</p>}
        </div>
        <div data-rise className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-line bg-surface p-7 md:col-span-2">
            <div className="text-[13px] text-ink-2">Power output</div>
            <div className="mt-2 flex items-baseline gap-2">
              <Num value={t.power_mw != null ? t.power_mw / 1000 : null} className="text-[clamp(56px,8vw,112px)] font-semibold leading-none tracking-[-0.055em]" />
              <span className="text-[24px] text-muted">W</span>
            </div>
            <div className="mt-6"><Sparkline values={recent} color={c.s1} height={70} /></div>
          </div>
          <div className="grid gap-4">
            {[
              ["Panel temperature", t.panel_temp_c, 1, "°C"],
              ["Sunlight", t.light_intensity_lux != null ? t.light_intensity_lux / 1000 : null, 1, "klux"],
              ["Panel pointing", live?.az, 0, `° · tilt ${fmt(live?.el, 0)}°`]
            ].map(([l, v, d, u]) => (
              <div key={l} className="rounded-3xl border border-line bg-surface px-6 py-5">
                <div className="text-[13px] text-ink-2">{l}</div>
                <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em]"><Num value={v} digits={d} /><span className="ml-1 text-[15px] font-medium text-muted">{u}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 flex flex-col items-center text-center">
          <h2 data-split className="max-w-[900px] text-[clamp(40px,6.4vw,96px)] font-semibold leading-[0.98] tracking-[-0.05em]">See every reading, live.</h2>
          <a ref={cta} href="#/overview" className="mt-10 inline-flex h-16 items-center gap-3 rounded-full bg-sun px-8 text-[17px] font-semibold text-[#141412] shadow-[0_20px_60px_-15px_var(--sun)] transition-[filter] hover:brightness-105">
            Open the dashboard <Icon name="arrowUpRight" className="size-5" strokeWidth={2.2} />
          </a>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="text-[18px] font-semibold tracking-[-0.02em]">{cfg.project.name}</div>
            <p className="mt-2 max-w-[380px] text-[14px] leading-relaxed text-ink-2">{cfg.project.title}. Final year project, {cfg.project.department}, {cfg.project.university}.</p>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-[0.12em] text-muted">Supervision</div>
            <p className="mt-3 text-[14px]">{cfg.project.supervisor}</p>
            <p className="text-[14px] text-ink-2">{cfg.project.coSupervisor}</p>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-[0.12em] text-muted">Team</div>
            <ul className="mt-3 space-y-1 text-[14px]">{cfg.project.team.map(m => <li key={m.roll}>{m.name}</li>)}</ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
