import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import config from "./config.js";
import { TelemetryProvider } from "./hooks/useTelemetry.jsx";
import { ThemeProvider } from "./hooks/useTheme.jsx";
import { AlertsProvider } from "./hooks/useAlerts.jsx";
import Shell, { NAV } from "./components/Shell.jsx";
import { Toasts } from "./components/Alerts.jsx";
import LoginModal from "./components/LoginModal.jsx";

/* Each page loads on demand, so the first screen opens faster */
const LOADERS = {
  overview: () => import("./components/Overview.jsx"),
  telemetry: () => import("./components/Telemetry.jsx"),
  tracking: () => import("./components/Tracking.jsx"),
  control: () => import("./components/Control.jsx"),
  analytics: () => import("./components/Analytics.jsx"),
  system: () => import("./components/System.jsx"),
  about: () => import("./components/About.jsx"),
  home: () => import("./components/Landing.jsx")
};
const PAGES = Object.fromEntries(Object.entries(LOADERS).map(([k, f]) => [k, lazy(f)]));

/* Hash routes: #/overview, #/telemetry, ... (work on any static host) */
const readRoute = () => {
  const id = window.location.hash.replace(/^#\/?/, "").split(/[?/]/)[0];
  if (!id) return "home";
  return NAV.some(n => n.id === id) ? id : "overview";
};

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      <div className="h-8 w-64 rounded-lg bg-hover" />
      <div className="h-4 w-96 max-w-full rounded bg-hover" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-64 rounded-xl bg-hover lg:col-span-2" />
        <div className="h-64 rounded-xl bg-hover" />
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [loginOpen, setLoginOpen] = useState(false);
  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  useEffect(() => {
    const on = () => {
      setRoute(readRoute());
      document.getElementById("scroller")?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    const label = NAV.find(n => n.id === route)?.label;
    document.title = `${label} · Sunflower solar tracker`;
  }, [route]);

  /* Fetch the other pages in the background once the first one is on screen */
  useEffect(() => {
    const t = setTimeout(() => Object.values(LOADERS).forEach(f => f().catch(() => {})), 2500);
    return () => clearTimeout(t);
  }, []);

  const Page = PAGES[route];

  return (
    <ThemeProvider>
      <TelemetryProvider cfg={config}>
        <AlertsProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary">
            Skip to content
          </a>
          {route === "home" ? (
            <Suspense fallback={<div className="min-h-dvh bg-page" />}><Page /></Suspense>
          ) : (
            <Shell route={route} onLogin={openLogin}>
              <Suspense fallback={<PageSkeleton />}>
                <Page onLogin={openLogin} />
              </Suspense>
            </Shell>
          )}
          <LoginModal open={loginOpen} onClose={closeLogin} />
          <Toasts />
        </AlertsProvider>
      </TelemetryProvider>
    </ThemeProvider>
  );
}
