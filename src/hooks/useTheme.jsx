/* Light / dark theme. Starts from the OS setting; the toggle remembers the choice.
   The switch uses the View Transitions API for a circular reveal where supported. */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";

/* Colours for canvas/SVG drawing (CSS classes use the same values via index.css) */
export const PALETTE = {
  light: {
    surface: "#ffffff", ink: "#141412", ink2: "#55534d", muted: "#8a877f",
    line: "#e3e1da", grid: "#ecebe6", axis: "#cfccc3", subtle: "#f0efea",
    sun: "#e8a000", s1: "#2a78d6", s2: "#eb6834", good: "#0ca30c", crit: "#d03b3b"
  },
  dark: {
    surface: "#161615", ink: "#f1f0ec", ink2: "#c4c2b9", muted: "#8a877f",
    line: "#262624", grid: "#232321", axis: "#363531", subtle: "#1b1b19",
    sun: "#f2b100", s1: "#3987e5", s2: "#d95926", good: "#0ca30c", crit: "#d03b3b"
  }
};

const Ctx = createContext(null);
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || (systemDark() ? "dark" : "light"));

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#080808" : "#ecebe6";
  }, [theme]);

  /* Follow the OS while the user has not picked a theme */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { if (!localStorage.getItem("theme")) setTheme(mq.matches ? "dark" : "light"); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const toggle = useCallback(ev => {
    const next = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", next); } catch { /* private mode */ }
    if (!document.startViewTransition || reducedMotion()) { setTheme(next); return; }
    const x = ev?.clientX ?? window.innerWidth - 40;
    const y = ev?.clientY ?? 40;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const t = document.startViewTransition(() => flushSync(() => setTheme(next)));
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 600, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  }, [theme]);

  return <Ctx.Provider value={{ theme, toggle, set: t => flushSync(() => setTheme(t)), c: PALETTE[theme] }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
