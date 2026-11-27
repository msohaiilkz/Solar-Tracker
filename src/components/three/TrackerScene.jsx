/* 3D dual-axis solar tracker (Three.js via react-three-fiber).
   Coordinate system: Y up, north = -Z, east = +X. Azimuth is clockwise from north.
   The scene reads its pose from `poseRef.current = { az, tilt, sunAz, sunEl }` every
   frame and eases toward it, so callers can drive it from live data or from scroll. */
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Line } from "@react-three/drei";
import * as THREE from "three";

const R = Math.PI / 180;
export const dirFromAzEl = (az, el, r = 1) => [
  Math.sin(az * R) * Math.cos(el * R) * r,
  Math.sin(el * R) * r,
  -Math.cos(az * R) * Math.cos(el * R) * r
];

const SUN_DIST = 7.2;

function usePanelTexture(dark) {
  return useMemo(() => {
    const W = 640, H = 400, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    g.fillStyle = dark ? "#9aa0a8" : "#c9ccd1";            // aluminium frame
    g.fillRect(0, 0, W, H);
    const cols = 8, rows = 5, pad = 14, gap = 5;
    const cw = (W - pad * 2 - gap * (cols - 1)) / cols, ch = (H - pad * 2 - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = pad + c * (cw + gap), y = pad + r * (ch + gap);
      const grd = g.createLinearGradient(x, y, x + cw, y + ch);
      grd.addColorStop(0, "#22508f"); grd.addColorStop(1, "#0f2c57");
      g.fillStyle = grd; g.fillRect(x, y, cw, ch);
      g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x + cw / 2, y); g.lineTo(x + cw / 2, y + ch); g.stroke();
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(x, y + (ch * k) / 3); g.lineTo(x + cw, y + (ch * k) / 3); g.stroke(); }
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [dark]);
}

function useGroundTexture(c, dark, labels) {
  return useMemo(() => {
    const S = 1024, cv = document.createElement("canvas");
    cv.width = S; cv.height = S;
    const g = cv.getContext("2d"), m = S / 2;
    const grd = g.createRadialGradient(m, m, 0, m, m, m);
    grd.addColorStop(0, dark ? "#242421" : "#ecebe5");
    grd.addColorStop(1, dark ? "rgba(36,36,33,0)" : "rgba(236,235,229,0)");
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    g.strokeStyle = dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)";
    g.lineWidth = 2;
    [0.28, 0.5, 0.72].forEach(f => { g.beginPath(); g.arc(m, m, m * f, 0, Math.PI * 2); g.stroke(); });
    for (let i = 0; i < 72; i++) {
      const a = (i * 5 * Math.PI) / 180, r1 = m * (i % 18 === 0 ? 0.64 : 0.69), r2 = m * 0.72;
      g.beginPath(); g.moveTo(m + Math.sin(a) * r1, m - Math.cos(a) * r1); g.lineTo(m + Math.sin(a) * r2, m - Math.cos(a) * r2); g.stroke();
    }
    g.fillStyle = dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)";
    g.font = "600 44px Geist, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    if (labels) [["N", 0, -1], ["E", 1, 0], ["S", 0, 1], ["W", -1, 0]].forEach(([t, x, y]) => g.fillText(t, m + x * m * 0.81, m + y * m * 0.81));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [c, dark, labels]);
}

/* shortest-path damping for angles in degrees */
function dampAngle(cur, target, lambda, dt) {
  let d = ((target - cur + 540) % 360) - 180;
  return cur + d * (1 - Math.exp(-lambda * dt));
}

function Tracker({ poseRef, c, dark }) {
  const az = useRef(), tilt = useRef(), sun = useRef(), light = useRef(), halo = useRef();
  const cur = useRef({ az: 180, tilt: 30, sunAz: 150, sunEl: 30 });
  const panelTex = usePanelTexture(dark);
  const metal = dark ? "#6b6963" : "#a9a69d";
  const metalDark = dark ? "#3a3935" : "#5f5d57";

  useFrame((state, dt) => {
    const p = poseRef.current || {};
    const k = cur.current;
    const step = Math.min(dt, 0.05);
    k.az = dampAngle(k.az, p.az ?? k.az, 4, step);
    k.tilt = THREE.MathUtils.damp(k.tilt, p.tilt ?? k.tilt, 4, step);
    k.sunAz = dampAngle(k.sunAz, p.sunAz ?? k.sunAz, 6, step);
    k.sunEl = THREE.MathUtils.damp(k.sunEl, p.sunEl ?? k.sunEl, 6, step);

    az.current.rotation.y = -k.az * R;
    tilt.current.rotation.x = -k.tilt * R;
    const [x, y, z] = dirFromAzEl(k.sunAz, k.sunEl, SUN_DIST);
    sun.current.position.set(x, y + 0.6, z);
    /* hide the sun when it would sit right in front of the lens */
    sun.current.visible = k.sunEl > -2 && state.camera.position.distanceTo(sun.current.position) > 5.5;
    light.current.position.set(x, Math.max(0.5, y), z);
    light.current.intensity = THREE.MathUtils.clamp(k.sunEl / 12, 0.15, 1) * 2.2;
    halo.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.06);
  });

  return (
    <>
      <directionalLight ref={light} castShadow intensity={2} color="#fff4dc"
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />

      {/* sun */}
      <group ref={sun}>
        <mesh><sphereGeometry args={[0.34, 32, 32]} /><meshBasicMaterial color={c.sun} toneMapped={false} /></mesh>
        <mesh ref={halo}><sphereGeometry args={[0.72, 32, 32]} /><meshBasicMaterial color={c.sun} transparent opacity={0.16} depthWrite={false} toneMapped={false} /></mesh>
        <mesh><sphereGeometry args={[1.25, 32, 32]} /><meshBasicMaterial color={c.sun} transparent opacity={0.06} depthWrite={false} toneMapped={false} /></mesh>
      </group>

      {/* base */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.7, 0.12, 48]} /><meshStandardMaterial color={metalDark} roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 1.4, 24]} /><meshStandardMaterial color={metal} roughness={0.35} metalness={0.7} />
      </mesh>

      {/* azimuth head */}
      <group ref={az} position={[0, 1.55, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.22, 0.22, 0.16, 32]} /><meshStandardMaterial color={metalDark} roughness={0.5} metalness={0.5} /></mesh>
        {[-0.34, 0.34].map(x => (
          <mesh key={x} position={[x, 0.2, 0]} castShadow><boxGeometry args={[0.06, 0.42, 0.12]} /><meshStandardMaterial color={metal} roughness={0.35} metalness={0.7} /></mesh>
        ))}
        {/* back rails under the panel */}
        <mesh position={[0, 0.38, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 0.76, 16]} /><meshStandardMaterial color={metalDark} metalness={0.6} roughness={0.4} /></mesh>

        {/* tilt axis + panel */}
        <group ref={tilt} position={[0, 0.38, 0]}>
          <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.5, 0.07, 1.56]} />
            <meshStandardMaterial attach="material-0" color={metal} metalness={0.6} roughness={0.4} />
            <meshStandardMaterial attach="material-1" color={metal} metalness={0.6} roughness={0.4} />
            <meshStandardMaterial attach="material-2" map={panelTex} roughness={0.25} metalness={0.35} />
            <meshStandardMaterial attach="material-3" color={dark ? "#4a4944" : "#8a877e"} roughness={0.55} metalness={0.3} />
            <meshStandardMaterial attach="material-4" color={metal} metalness={0.6} roughness={0.4} />
            <meshStandardMaterial attach="material-5" color={metal} metalness={0.6} roughness={0.4} />
          </mesh>
          {[-0.7, 0.7].map(x => (
            <mesh key={x} position={[x, 0.005, 0]} castShadow><boxGeometry args={[0.08, 0.05, 1.4]} /><meshStandardMaterial color={metal} metalness={0.6} roughness={0.35} /></mesh>
          ))}
          <mesh position={[0, 0.005, 0]} castShadow><boxGeometry args={[1.5, 0.05, 0.1]} /><meshStandardMaterial color={metal} metalness={0.6} roughness={0.35} /></mesh>
          {/* LDR cross on the top (+Z) edge */}
          <group position={[0.92, 0.17, 0.6]}>
            <mesh castShadow><boxGeometry args={[0.22, 0.14, 0.22]} /><meshStandardMaterial color="#26261f" roughness={0.6} /></mesh>
            <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.22, 0.08, 0.012]} /><meshStandardMaterial color="#d8d6cf" /></mesh>
            <mesh position={[0, 0.1, 0]}><boxGeometry args={[0.012, 0.08, 0.22]} /><meshStandardMaterial color="#d8d6cf" /></mesh>
            {[[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]].map(([x, z], i) => (
              <mesh key={i} position={[x, 0.075, z]}><sphereGeometry args={[0.026, 12, 12]} /><meshStandardMaterial color={c.sun} emissive={c.sun} emissiveIntensity={0.6} /></mesh>
            ))}
          </group>
        </group>
      </group>

      {/* controller box */}
      <group position={[0.95, 0.2, 0.55]}>
        <mesh castShadow><boxGeometry args={[0.46, 0.3, 0.3]} /><meshStandardMaterial color={dark ? "#d9d7cf" : "#f4f3ee"} roughness={0.5} /></mesh>
        <mesh position={[0.12, 0.3, 0]}><cylinderGeometry args={[0.012, 0.012, 0.32, 8]} /><meshStandardMaterial color={metalDark} /></mesh>
        <mesh position={[-0.1, 0.05, 0.151]}><boxGeometry args={[0.04, 0.04, 0.005]} /><meshBasicMaterial color={c.good} toneMapped={false} /></mesh>
      </group>
    </>
  );
}

function Ground({ c, dark, labels }) {
  const tex = useGroundTexture(c, dark, labels);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[5.2, 96]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function SunPath({ path, c, poseRef, fade }) {
  const line = useRef();
  useFrame(() => {
    if (!fade || !line.current) return;
    const m = line.current.material;
    m.opacity = THREE.MathUtils.lerp(m.opacity, 0.55 * THREE.MathUtils.clamp(poseRef.current?.cam ?? 0, 0, 1), 0.1);
  });
  const pts = useMemo(() => (path || []).filter(([, el]) => el > -1).map(([a, e]) => {
    const [x, y, z] = dirFromAzEl(a, e, SUN_DIST);
    return [x, y + 0.6, z];
  }), [path]);
  if (pts.length < 2) return null;
  return <Line ref={line} points={pts} color={c.sun} lineWidth={1.5} transparent opacity={fade ? 0 : 0.55} dashed dashSize={0.18} gapSize={0.12} />;
}

/* Camera for the landing page: moves from a front view (cam = 0) to a view from
   behind the panel looking toward the sun (cam = 1), plus a little pointer parallax.
   shiftX moves the subject sideways without moving the camera (CSS-like offset). */
const FRONT = { pos: new THREE.Vector3(5.6, 2.9, 6.4), look: new THREE.Vector3(0, 1.45, 0) };
const REAR = { pos: new THREE.Vector3(0.4, 3.3, -8.6), look: new THREE.Vector3(0, 2.6, 3) };
const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();

function CameraRig({ poseRef, parallax, shiftX = 0 }) {
  const mix = useRef(0);
  useFrame((state, dt) => {
    const { camera, pointer, size } = state;
    const target = THREE.MathUtils.clamp(poseRef.current?.cam ?? 0, 0, 1);
    mix.current = THREE.MathUtils.damp(mix.current, target, 3, Math.min(dt, 0.05));
    const k = mix.current * mix.current * (3 - 2 * mix.current);
    tmpP.lerpVectors(FRONT.pos, REAR.pos, k);
    tmpL.lerpVectors(FRONT.look, REAR.look, k);
    /* portrait screens: step back so the whole tracker fits */
    const aspect = size.width / size.height;
    if (aspect < 1) tmpP.sub(tmpL).multiplyScalar(Math.min(2.1, 0.78 / aspect)).add(tmpL);
    if (parallax) { tmpP.x += pointer.x * 0.7; tmpP.y += pointer.y * 0.4; }
    camera.position.lerp(tmpP, 1 - Math.exp(-6 * Math.min(dt, 0.05)));
    camera.lookAt(tmpL);
    camera.fov = THREE.MathUtils.lerp(38, 50, k);
    if (shiftX) camera.setViewOffset(size.width, size.height, -size.width * shiftX, 0, size.width, size.height);
    else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });
  return null;
}

export default function TrackerScene({ poseRef, path, c, dark, interactive = false, parallax = false, rig = false, shiftX = 0, labels = true, autoRotate = false, className = "", camera = [5.4, 2.9, 6.2], fov = 38 }) {
  return (
    <div className={className}>
      <Canvas shadows dpr={[1, 1.8]} camera={{ position: camera, fov }} gl={{ antialias: true, alpha: true }}
        onCreated={({ camera: cam }) => cam.lookAt(0, 1.45, 0)}>
        <hemisphereLight args={[dark ? "#c9d4ff" : "#ffffff", dark ? "#1a1916" : "#d8d2c2", dark ? 0.55 : 0.9]} />
        <ambientLight intensity={dark ? 0.3 : 0.45} />
        <directionalLight position={[-2, 4, -7]} intensity={dark ? 0.55 : 0.8} color="#dfe8ff" />
        <Ground c={c} dark={dark} labels={labels} />
        <SunPath path={path} c={c} poseRef={poseRef} fade={rig} />
        <Tracker poseRef={poseRef} c={c} dark={dark} />
        <ContactShadows position={[0, 0.005, 0]} opacity={dark ? 0.6 : 0.38} scale={7} blur={2.4} far={3} resolution={512} color="#000000" />
        {interactive && <OrbitControls target={[0, 2.1, 1.6]} enablePan={false} enableZoom={false} maxPolarAngle={Math.PI * 0.48} enableDamping autoRotate={autoRotate} autoRotateSpeed={0.7} />}
        {rig && !interactive && <CameraRig poseRef={poseRef} parallax={parallax} shiftX={shiftX} />}
      </Canvas>
    </div>
  );
}
