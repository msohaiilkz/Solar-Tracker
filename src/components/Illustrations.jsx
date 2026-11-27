/* Hand-made 2D illustrations (SVG). They use the theme colours, so they work in light and dark. */
import { useTheme } from "../hooks/useTheme.jsx";

/* The tracker itself: dual-axis mount, panel with LDR cross, controller box, Wi-Fi */
export function TrackerIllustration({ className = "" }) {
  const { c, theme } = useTheme();
  const dark = theme === "dark";
  const cell = dark ? "#1d4f8f" : "#2a6cc0";
  const cellHi = dark ? "#2f6fbf" : "#4b8ee0";
  return (
    <svg viewBox="0 0 520 340" className={className} role="img" aria-label="Illustration of the Sunflower dual-axis solar tracker">
      <defs>
        <linearGradient id="il-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sun} stopOpacity={dark ? 0.1 : 0.14} />
          <stop offset="1" stopColor={c.sun} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="il-glow"><stop offset="0" stopColor={c.sun} stopOpacity=".45" /><stop offset="1" stopColor={c.sun} stopOpacity="0" /></radialGradient>
        <linearGradient id="il-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={cellHi} /><stop offset="1" stopColor={cell} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="520" height="300" rx="18" fill="url(#il-sky)" />

      {/* sun */}
      <g transform="translate(420 72)">
        <circle r="62" fill="url(#il-glow)" />
        <g className="spin-slow" stroke={c.sun} strokeWidth="3" strokeLinecap="round">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={Math.cos(a) * 30} y1={Math.sin(a) * 30} x2={Math.cos(a) * 40} y2={Math.sin(a) * 40} />;
          })}
        </g>
        <circle r="22" fill={c.sun} />
      </g>

      {/* light rays to panel */}
      {[[392, 96, 282, 176], [386, 106, 247, 158], [378, 116, 212, 139]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.sun} strokeOpacity=".55" strokeWidth="1.5" className="flow" />
      ))}

      {/* ground */}
      <path d="M20 300h480" stroke={c.axis} strokeWidth="1.5" />
      {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${40 + i * 29} 300l-10 12`} stroke={c.line} strokeWidth="1.5" />)}

      {/* base + azimuth bearing */}
      <rect x="196" y="282" width="88" height="18" rx="4" fill={c.ink2} />
      <rect x="230" y="200" width="20" height="84" rx="4" fill={c.ink2} />
      <ellipse cx="240" cy="200" rx="26" ry="7" fill={c.muted} />
      <rect x="226" y="176" width="28" height="26" rx="6" fill={c.ink2} />
      <circle cx="240" cy="176" r="8" fill={c.surface} stroke={c.ink2} strokeWidth="4" />

      {/* panel, tilted toward the sun */}
      <g transform="translate(240 168) rotate(28)">
        <rect x="-118" y="-11" width="236" height="22" rx="4" fill={c.ink} opacity=".9" />
        <rect x="-114" y="-9" width="228" height="12" rx="2" fill="url(#il-panel)" />
        {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${-114 + (i + 1) * 28.5} -9v12`} stroke={c.surface} strokeOpacity=".35" />)}
        {/* LDR cross on top edge */}
        <g transform="translate(-60 -11)">
          <rect x="-14" y="-24" width="28" height="24" rx="3" fill={c.ink2} />
          <path d="M0 -24v24M-14 -12h28" stroke={c.surface} strokeOpacity=".6" />
          {[[-7, -18], [7, -18], [-7, -6], [7, -6]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={c.sun} />)}
        </g>
      </g>

      {/* controller box + wifi */}
      <g transform="translate(70 226)">
        <rect x="0" y="0" width="74" height="52" rx="8" fill={c.surface} stroke={c.axis} strokeWidth="1.5" />
        <rect x="10" y="12" width="30" height="20" rx="3" fill={c.ink2} />
        <text x="25" y="25.5" textAnchor="middle" fontSize="8" fontWeight="700" fill={c.surface}>ESP32</text>
        <circle cx="56" cy="16" r="3" fill={c.good} />
        <circle cx="56" cy="28" r="3" fill={c.sun} />
        <path d="M37 0v-22" stroke={c.ink2} strokeWidth="2.5" strokeLinecap="round" />
        <g fill="none" stroke={c.s1} strokeWidth="2" strokeLinecap="round">
          <path d="M27 -34a14 14 0 0 1 20 0" className="wifi-1" />
          <path d="M21 -40a22 22 0 0 1 32 0" className="wifi-2" />
          <path d="M15 -46a30 30 0 0 1 44 0" className="wifi-3" />
        </g>
        <path d="M74 32 C110 32 140 60 156 60" fill="none" stroke={c.axis} strokeWidth="1.5" strokeDasharray="3 3" />
      </g>

      {/* labels */}
      <g fontSize="11.5" fill={c.ink2}>
        <text x="300" y="250">Azimuth motor</text>
        <path d="M296 246h-34" stroke={c.axis} />
        <text x="62" y="104">4 × LDR sensors</text>
        <path d="M150 100 L178 112" stroke={c.axis} />
      </g>
    </svg>
  );
}

/* Sensors → ESP32 → Firebase → Dashboard, with data packets moving along the links */
export function FlowDiagram() {
  const { c } = useTheme();
  const nodes = [
    { x: 70, label: "Sensors", sub: "LDR · DHT22 · INA219", icon: "M-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M0-12v-3M0 12v3M-12 0h-3M12 0h3" },
    { x: 250, label: "ESP32", sub: "reads · tracks · sends", icon: "M-8-8h16v16h-16zM-4-12v4M4-12v4M-4 8v4M4 8v4M-12-4h4M-12 4h4M8-4h4M8 4h4" },
    { x: 430, label: "Firebase", sub: "Realtime Database", icon: "M-9 6a7 7 0 1 1 1.5-13.8A8 8 0 0 1 8-6a5.5 5.5 0 0 1-1 12z" },
    { x: 610, label: "Dashboard", sub: "this web app", icon: "M-10-8h20v13h-20zM-4 9h8M0 5v4" }
  ];
  const Y = 58;
  return (
    <svg viewBox="0 0 680 130" className="w-full" role="img" aria-label="Data flow: sensors to ESP32 to Firebase to this dashboard, and commands back">
      {nodes.slice(0, -1).map((n, i) => {
        const x1 = n.x + 34, x2 = nodes[i + 1].x - 34;
        const fwd = `M${x1} ${Y - 6}H${x2}`, back = `M${x2} ${Y + 6}H${x1}`;
        return (
          <g key={i}>
            <path d={fwd} stroke={c.axis} strokeWidth="1.5" />
            <path d={back} stroke={c.line} strokeWidth="1.5" strokeDasharray="3 4" />
            <path d={`M${x2 - 6} ${Y - 10}l6 4-6 4`} fill="none" stroke={c.axis} strokeWidth="1.5" />
            <circle r="3.5" fill={c.sun} className="flow-dot">
              <animateMotion dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" path={fwd} />
            </circle>
            {i > 0 && (
              <circle r="3" fill={c.s1} className="flow-dot">
                <animateMotion dur="3.2s" begin={`${i * 0.6 + 1}s`} repeatCount="indefinite" path={back} />
              </circle>
            )}
          </g>
        );
      })}
      {nodes.map(n => (
        <g key={n.label} transform={`translate(${n.x} ${Y})`}>
          <rect x="-30" y="-30" width="60" height="60" rx="14" fill={c.surface} stroke={c.axis} strokeWidth="1.5" />
          <path d={n.icon} fill="none" stroke={c.ink} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
          <text y="50" textAnchor="middle" fontSize="13" fontWeight="600" fill={c.ink}>{n.label}</text>
          <text y="66" textAnchor="middle" fontSize="10.5" fill={c.muted}>{n.sub}</text>
        </g>
      ))}
    </svg>
  );
}
