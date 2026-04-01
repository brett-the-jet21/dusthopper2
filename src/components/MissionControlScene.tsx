"use client";

import { useRef, useMemo, useCallback, useEffect, Component, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Line2 } from "three-stdlib";
import { LineMaterial } from "three-stdlib";
import { LineGeometry } from "three-stdlib";
import * as THREE from "three";
import Earth from "./Earth";
import Moon, { getMoonPosition } from "./Moon";
import Sun, { SUN_POSITION } from "./Sun";
import { LaunchPadGroup, LC39B_PAD_BASE, ARTEMIS_CAM_BASE, getUTCRotation, applyYRotation } from "./LaunchPad";
import { useMissionStore } from "@/lib/store/missionStore";
import { twoline2satrec, propagate, gstime } from "satellite.js";

/* ===================================================================
   Canvas error boundary — prevents 3D crashes from killing the page
   =================================================================== */
class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    // Log for diagnostics — check browser console if scene is blank
    console.error("[SceneErrorBoundary]", error?.message ?? error);
  }
  render() {
    if (this.state.hasError) {
      // Keep the black background; HUD overlays remain visible
      return <div style={{ width: "100%", height: "100%", background: "#000" }} />;
    }
    return this.props.children;
  }
}

/* ===================================================================
   Types
   =================================================================== */
export type TrackTarget =
  | "overview" | "earth" | "moon" | "sun"
  | "iss" | "artemis" | "starship" | "starlink";

const MOVING_TARGETS = new Set<TrackTarget>(["iss", "moon", "starship", "starlink"]);

/* ===================================================================
   Scene constants — Earth radius = 2.0 scene units = 6,371 km
   =================================================================== */
const EARTH_SCENE_R = 2.0;
const EARTH_KM      = 6371;
const SCENE_SCALE   = EARTH_SCENE_R / EARTH_KM;

// Artemis II parking orbit: 185 km altitude, 28.5° inclination (KSC launch)
const ARTEMIS_II_ORBIT_R = EARTH_SCENE_R + (185  / EARTH_KM) * EARTH_SCENE_R; // ~2.058
const ARTEMIS_II_INCL    = 28.5  * (Math.PI / 180);

export const STARSHIP_ORBIT_R = EARTH_SCENE_R + (250  / EARTH_KM) * EARTH_SCENE_R; // 2.079
export const STARSHIP_INCL    = 51.6  * (Math.PI / 180);
const STARSHIP_ANG_VEL        = (2 * Math.PI) / (91.5  * 60);

const ISS_ORBIT_R = EARTH_SCENE_R + (408  / EARTH_KM) * EARTH_SCENE_R; // 2.128
const ISS_INCL    = 51.64 * (Math.PI / 180);

export const STARLINK_ORBIT_R = EARTH_SCENE_R + (550  / EARTH_KM) * EARTH_SCENE_R; // 2.173
export const STARLINK_INCL    = 53    * (Math.PI / 180);
const STARLINK_ANG_VEL        = (2 * Math.PI) / (95.6  * 60);

/* ===================================================================
   Artemis II mission timeline & trajectory
   =================================================================== */
const ARTEMIS_LAUNCH_MS       = new Date("2026-04-01T22:24:00Z").getTime();
const MET_TLI_S               = 2 * 3600;      // T+2h  — TLI burn / end of parking orbit
const MET_FLYBY_S             = 130 * 3600;    // T+130h — lunar closest approach
const MET_FLYBY_END_S         = 136 * 3600;    // T+136h — post-flyby departure
const MET_MISSION_S           = 240 * 3600;    // T+240h — splashdown
const PARKING_ORBIT_PERIOD_S  = 5556;          // 92.6 min — 185 km circular orbit

// Same formula as Moon.tsx; reproduced here so we can query any epoch
function getMoonPositionAt(epochMs: number): THREE.Vector3 {
  const JD  = epochMs / 86400000 + 2440587.5;
  const d   = JD - 2451545.0;
  const lon = ((218.316 + 13.176396 * d) % 360) * (Math.PI / 180);
  const inc = 5.14 * (Math.PI / 180);
  return new THREE.Vector3(
    16.7 * Math.cos(lon),
    16.7 * Math.sin(inc) * Math.sin(lon),
    16.7 * Math.sin(lon),
  );
}

interface ArtemisCurves {
  b1: THREE.Vector3;
  b2: THREE.Vector3;
  outCurve: THREE.CatmullRomCurve3;
  flyCurve: THREE.CatmullRomCurve3;
  retCurve: THREE.CatmullRomCurve3;
}
let _artemisCurves: ArtemisCurves | null = null;

function getArtemisCurves(): ArtemisCurves {
  if (_artemisCurves) return _artemisCurves;

  const R    = ARTEMIS_II_ORBIT_R;   // ~2.058 scene units
  const incl = ARTEMIS_II_INCL;      // 28.5°

  // Moon at flyby — spacecraft must arrive HERE at T+130h
  const Mfly  = getMoonPositionAt(ARTEMIS_LAUNCH_MS + MET_FLYBY_S * 1000);
  const mfDist = Mfly.length();                                      // ≈16.7
  const mfDir  = Mfly.clone().normalize();                           // Earth→Moon at flyby
  const mfTang = new THREE.Vector3(-Mfly.z, 0, Mfly.x).normalize(); // Moon prograde (CCW)

  // Orbital-plane basis from Moon's flyby direction
  // b1 = TLI injection direction (Moon projected onto equatorial XZ)
  const mfxz   = new THREE.Vector3(Mfly.x, 0, Mfly.z).normalize();
  const perpxz = new THREE.Vector3(-Mfly.z, 0, Mfly.x).normalize();
  const b1 = mfxz.clone();
  const b2 = new THREE.Vector3(
    perpxz.x * Math.cos(incl),
    Math.sin(incl),
    perpxz.z * Math.cos(incl),
  ).normalize();

  // TLI injection point: on parking orbit in direction of Moon at flyby
  const tliPt = b1.clone().multiplyScalar(R);

  // ── Outbound coast: TLI → lunar approach ────────────────────────
  // Arrive slightly prograde of Moon (Moon is moving, spacecraft leads it)
  const approachPt = Mfly.clone()
    .addScaledVector(mfTang, 0.90)
    .addScaledVector(mfDir, -0.30);

  const outCurve = new THREE.CatmullRomCurve3([
    tliPt,
    b1.clone().multiplyScalar(mfDist * 0.20).addScaledVector(mfTang, mfDist * 0.07),
    b1.clone().multiplyScalar(mfDist * 0.55).addScaledVector(mfTang, mfDist * 0.14),
    approachPt,
  ], false, "catmullrom", 0.5);

  // ── Lunar flyby: prograde approach → far-side → retrograde exit ──
  // Far-side periapsis: ~0.7 su beyond Moon center (away from Earth)
  const farSidePt = Mfly.clone().addScaledVector(mfDir, 0.70);
  // Retrograde exit: trailing side
  const exitPt = Mfly.clone()
    .addScaledVector(mfTang, -0.90)
    .addScaledVector(mfDir, -0.15);

  const flyCurve = new THREE.CatmullRomCurve3([
    approachPt,
    Mfly.clone().addScaledVector(mfTang, 0.35).addScaledVector(mfDir, 0.40),
    farSidePt,
    Mfly.clone().addScaledVector(mfTang, -0.35).addScaledVector(mfDir, 0.40),
    exitPt,
  ], false, "catmullrom", 0.5);

  // ── Return coast: retrograde exit → Earth ───────────────────────
  const retArrival = b1.clone().multiplyScalar(R * 1.01);

  const retCurve = new THREE.CatmullRomCurve3([
    exitPt,
    b1.clone().multiplyScalar(mfDist * 0.52).addScaledVector(mfTang, -mfDist * 0.12),
    b1.clone().multiplyScalar(mfDist * 0.18).addScaledVector(mfTang, -mfDist * 0.04),
    retArrival,
  ], false, "catmullrom", 0.5);

  _artemisCurves = { b1, b2, outCurve, flyCurve, retCurve };
  return _artemisCurves;
}

/** Map Mission Elapsed Time (seconds) → scene position on Artemis II path */
function getArtemisPosition(metSec: number): THREE.Vector3 {
  const { b1, b2, outCurve, flyCurve, retCurve } = getArtemisCurves();
  const R   = ARTEMIS_II_ORBIT_R;
  const angV = 2 * Math.PI / PARKING_ORBIT_PERIOD_S;
  const baseTh = -(MET_TLI_S * angV); // so that at metSec=MET_TLI_S, angle=0 → b1*R

  // Parking orbit (0 → TLI)
  if (metSec <= MET_TLI_S) {
    const th = baseTh + Math.max(0, metSec) * angV;
    return b1.clone().multiplyScalar(Math.cos(th) * R)
             .addScaledVector(b2, Math.sin(th) * R);
  }
  // Outbound coast
  if (metSec <= MET_FLYBY_S) {
    const t = (metSec - MET_TLI_S) / (MET_FLYBY_S - MET_TLI_S);
    return outCurve.getPointAt(Math.min(t, 1));
  }
  // Lunar flyby
  if (metSec <= MET_FLYBY_END_S) {
    const t = (metSec - MET_FLYBY_S) / (MET_FLYBY_END_S - MET_FLYBY_S);
    return flyCurve.getPointAt(Math.min(t, 1));
  }
  // Return coast
  if (metSec <= MET_MISSION_S) {
    const t = (metSec - MET_FLYBY_END_S) / (MET_MISSION_S - MET_FLYBY_END_S);
    return retCurve.getPointAt(Math.min(t, 1));
  }
  // Post-splashdown — rest at Earth
  return b1.clone().multiplyScalar(R);
}

/* Per-mission neon colors — maximum saturation */
const COLORS = {
  artemis: "#FF8800",
  iss:     "#00FFCC",
  starship:"#EE22FF",
  starlink:"#22AAFF",
} as const;

/* ===================================================================
   ISS TLE
   =================================================================== */
const TLE1 = "1 25544U 98067A   25055.54896991  .00024200  00000+0  42900-3 0  9993";
const TLE2 = "2 25544  51.6420 294.2170 0003568 351.0060  64.9350 15.50037360438908";
const satrec = twoline2satrec(TLE1, TLE2);

/* ===================================================================
   Pulsing spacecraft dot
   =================================================================== */
function SpacecraftDot({
  color,
  positionRef,
  onClick,
}: {
  color: string;
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.position.copy(positionRef.current);
    // Subtle pulse: scale 0.8 → 1.2 on a 2 s loop
    meshRef.current.scale.setScalar(1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.2);
  });

  return (
    <mesh ref={meshRef} onClick={onClick}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/* ===================================================================
   ISS tracker — real TLE propagation every frame
   =================================================================== */
function ISSTracker({
  positionRef,
  onClick,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
}) {
  useFrame(() => {
    const now = new Date();
    const result = propagate(satrec, now);
    if (!result?.position || typeof result.position === "boolean") return;
    const pos = result.position as { x: number; y: number; z: number };
    const gmst = gstime(now);
    const cosG = Math.cos(gmst);
    const sinG = Math.sin(gmst);
    // ECI → ECEF → Three.js Y-up
    positionRef.current.set(
      ( pos.x * cosG + pos.y * sinG) * SCENE_SCALE,
      ( pos.z) * SCENE_SCALE,
      -(-pos.x * sinG + pos.y * cosG) * SCENE_SCALE,
    );
  });

  return <SpacecraftDot color={COLORS.iss} positionRef={positionRef} onClick={onClick} />;
}

/* ===================================================================
   Generic circular orbit tracker — uses real angular velocity × simSpeed
   =================================================================== */
function CircularTracker({
  positionRef,
  onClick,
  playing,
  simSpeed,
  orbitR,
  inclination,
  angVel,
  startAngle,
  color,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
  playing: boolean;
  simSpeed: number;
  orbitR: number;
  inclination: number;
  angVel: number;  // rad/s at 1× speed
  startAngle: number;
  color: string;
}) {
  const angleRef = useRef(startAngle);

  useFrame((_, delta) => {
    if (playing) angleRef.current += angVel * delta * simSpeed;
    const a = angleRef.current;
    positionRef.current.set(
      Math.cos(a) * orbitR,
      Math.sin(a) * orbitR * Math.sin(inclination),
      Math.sin(a) * orbitR * Math.cos(inclination),
    );
  });

  return <SpacecraftDot color={color} positionRef={positionRef} onClick={onClick} />;
}

/* ===================================================================
   Neon orbit path — Line2 (screen-space thickness) + additive glow halo
   =================================================================== */
function GlowOrbitPath({
  radius,
  color,
  inclination = 0,
}: {
  radius: number;
  color: string;
  inclination?: number;
}) {
  const matRef = useRef<LineMaterial | null>(null);
  const { gl } = useThree();

  const { line2, halo } = useMemo(() => {
    const flat: number[] = [];
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 361; i++) {
      const t = (i / 360) * Math.PI * 2;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * Math.sin(inclination) * radius;
      const z = Math.sin(t) * Math.cos(inclination) * radius;
      flat.push(x, y, z);
      if (i < 361) pts.push(new THREE.Vector3(x, y, z));
    }

    // Thick core via Line2
    const geo = new LineGeometry();
    geo.setPositions(flat);
    const mat = new LineMaterial({
      color: new THREE.Color(color).getHex(),
      linewidth: 1,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      resolution: new THREE.Vector2(gl.domElement.width, gl.domElement.height),
    });
    matRef.current = mat;
    const l = new Line2(geo, mat);
    l.computeLineDistances();

    // Wide additive halo using standard Line
    const haloGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const halo = new THREE.Line(haloGeo, new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));

    return { line2: l, halo };
  }, [radius, inclination, color, gl]);

  useFrame(({ size }) => {
    matRef.current?.resolution.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
  });

  return (
    <>
      <primitive object={halo} />
      <primitive object={line2} />
    </>
  );
}

/* ===================================================================
   Artemis II pre-launch dashed orbit path — Line2 thick dashes + marching ants
   =================================================================== */
function ArtemisIIPreLaunchPath() {
  const matRef = useRef<LineMaterial | null>(null);
  const { gl } = useThree();

  const line = useMemo(() => {
    const flat: number[] = [];
    for (let i = 0; i <= 361; i++) {
      const theta = (i / 360) * Math.PI * 2;
      flat.push(
        Math.cos(theta) * ARTEMIS_II_ORBIT_R,
        Math.sin(theta) * Math.sin(ARTEMIS_II_INCL) * ARTEMIS_II_ORBIT_R,
        Math.sin(theta) * Math.cos(ARTEMIS_II_INCL) * ARTEMIS_II_ORBIT_R,
      );
    }
    const geo = new LineGeometry();
    geo.setPositions(flat);
    const mat = new LineMaterial({
      color: new THREE.Color(COLORS.artemis).getHex(),
      linewidth: 1,
      dashed: true,
      dashSize: 0.10,
      gapSize: 0.07,
      dashOffset: 0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      resolution: new THREE.Vector2(gl.domElement.width, gl.domElement.height),
    });
    matRef.current = mat;
    const l = new Line2(geo, mat);
    l.computeLineDistances();
    return l;
  }, [gl]);

  useFrame((_, dt) => {
    if (matRef.current) (matRef.current as any).dashOffset -= dt * 0.22;
    matRef.current?.resolution.set(
      gl.domElement.width * gl.getPixelRatio(),
      gl.domElement.height * gl.getPixelRatio(),
    );
  });

  return <primitive object={line} />;
}

/* ===================================================================
   Artemis II trans-lunar trajectory — accurate multi-segment path
   Outbound coast → Lunar flyby (far-side) → Return coast
   (Parking-orbit ring rendered separately by ArtemisIIPreLaunchPath)
   =================================================================== */
function ArtemisIITrajectory() {
  const matRefs = useRef<(LineMaterial | null)[]>([null, null, null]);
  const { gl }  = useThree();

  const lines = useMemo(() => {
    const { outCurve, flyCurve, retCurve } = getArtemisCurves();

    const toFlat = (curve: THREE.CatmullRomCurve3, n: number) => {
      const pts = curve.getPoints(n);
      const f   = new Float32Array(pts.length * 3);
      pts.forEach((p, i) => { f[i * 3] = p.x; f[i * 3 + 1] = p.y; f[i * 3 + 2] = p.z; });
      return f;
    };

    const segments = [
      { flat: toFlat(outCurve, 200), dashSize: 0.24, gapSize: 0.12, opacity: 0.55 }, // outbound
      { flat: toFlat(flyCurve,  80), dashSize: 0.08, gapSize: 0.04, opacity: 0.65 }, // flyby
      { flat: toFlat(retCurve, 200), dashSize: 0.24, gapSize: 0.12, opacity: 0.45 }, // return
    ];

    return segments.map((seg, i) => {
      const geo = new LineGeometry();
      geo.setPositions(seg.flat);
      const mat = new LineMaterial({
        color: new THREE.Color(COLORS.artemis).getHex(),
        linewidth: 1.0,
        dashed: true,
        dashSize: seg.dashSize,
        gapSize:  seg.gapSize,
        dashOffset: 0,
        transparent: true,
        opacity: seg.opacity,
        depthWrite: false,
        resolution: new THREE.Vector2(gl.domElement.width, gl.domElement.height),
      });
      matRefs.current[i] = mat;
      const l = new Line2(geo, mat);
      l.computeLineDistances();
      return l;
    });
  }, [gl]);

  useFrame((_, dt) => {
    const w = gl.domElement.width  * gl.getPixelRatio();
    const h = gl.domElement.height * gl.getPixelRatio();
    matRefs.current.forEach((m) => {
      if (!m) return;
      (m as any).dashOffset -= dt * 0.10;
      m.resolution.set(w, h);
    });
  });

  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}

/* ===================================================================
   Artemis II real-time spacecraft tracker dot
   Maps current wall-clock time to position on the trajectory curves
   =================================================================== */
function ArtemisIISpacecraftTracker() {
  const dotRef  = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const metSec = (Date.now() - ARTEMIS_LAUNCH_MS) / 1000;
    const pos    = getArtemisPosition(metSec);

    dotRef.current?.position.copy(pos);
    glowRef.current?.position.copy(pos);

    // Pulse
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.25;
    dotRef.current?.scale.setScalar(s);
    glowRef.current?.scale.setScalar(s);
  });

  return (
    <group>
      {/* Core dot */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.032, 8, 8]} />
        <meshBasicMaterial color={COLORS.artemis} />
      </mesh>
      {/* Additive glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.10, 8, 8]} />
        <meshBasicMaterial
          color={COLORS.artemis}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/* ===================================================================
   Camera controller

   TRACKING mode (freeCam=false):
     • Moving targets (spacecraft/moon): continuously lerp to follow at lerp 0.02.
       OrbitControls disabled.
     • Static targets (earth/sun/overview): one-time cubic ease-out transition,
       then OrbitControls re-enabled.

   FREE CAM mode (freeCam=true):
     • OrbitControls always active. One-time jump on target change, then user drives.
   =================================================================== */
function CameraController({
  target,
  freeCam,
  posRefs,
}: {
  target: TrackTarget;
  freeCam: boolean;
  posRefs: {
    moon:     React.MutableRefObject<THREE.Vector3>;
    iss:      React.MutableRefObject<THREE.Vector3>;
    starship: React.MutableRefObject<THREE.Vector3>;
    starlink: React.MutableRefObject<THREE.Vector3>;
  };
}) {
  const controlsRef  = useRef<any>(null);
  const prevTarget   = useRef<TrackTarget>("overview");
  const prevFreeCam  = useRef(true);
  // One-time transition
  const inTransition = useRef(false);
  const tProg        = useRef(0);
  const startCam     = useRef(new THREE.Vector3());
  const startLook    = useRef(new THREE.Vector3());
  const endCam       = useRef(new THREE.Vector3());
  const endLook      = useRef(new THREE.Vector3());

  function getLivePos(t: TrackTarget): THREE.Vector3 {
    switch (t) {
      case "iss":      return posRefs.iss.current.clone();
      case "moon":     return posRefs.moon.current.clone();
      case "starship": return posRefs.starship.current.clone();
      case "starlink": return posRefs.starlink.current.clone();
      case "sun":      return SUN_POSITION.clone();
      case "artemis": {
        const utcRot = getUTCRotation();
        return applyYRotation(LC39B_PAD_BASE, utcRot);
      }
      default:         return new THREE.Vector3(0, 0, 0);
    }
  }

  function staticOffset(t: TrackTarget): THREE.Vector3 {
    switch (t) {
      case "earth":    return new THREE.Vector3(0, 2, 7);
      case "artemis": {
        const utcRot = getUTCRotation();
        const padPos = applyYRotation(LC39B_PAD_BASE, utcRot);
        const camPos = applyYRotation(ARTEMIS_CAM_BASE, utcRot);
        return camPos.clone().sub(padPos);
      }
      case "moon":     return new THREE.Vector3(0, 0.5, 2);
      case "sun":      return new THREE.Vector3(-30, 10, 20);
      default:         return new THREE.Vector3(0, 2, 7);
    }
  }

  /** Compute the desired camera position when tracking a spacecraft */
  function trackingCamPos(craftPos: THREE.Vector3): THREE.Vector3 {
    const radial = craftPos.clone().normalize();
    const up     = new THREE.Vector3(0, 1, 0);
    const right  = radial.clone().cross(up).normalize();
    const camUp  = radial.clone().cross(right).normalize();
    return craftPos.clone()
      .add(radial.multiplyScalar(0.8))
      .add(camUp.multiplyScalar(0.3));
  }

  // Zoom in/out via +/− HUD buttons
  const { camera } = useThree();
  useEffect(() => {
    const handler = (e: Event) => {
      if (!controlsRef.current) return;
      const delta = (e as CustomEvent<{ delta: number }>).detail.delta;
      const target = controlsRef.current.target.clone();
      const dir    = camera.position.clone().sub(target);
      dir.multiplyScalar(delta);
      camera.position.copy(target.clone().add(dir));
      controlsRef.current.update();
    };
    window.addEventListener("dusthopper-zoom", handler);
    return () => window.removeEventListener("dusthopper-zoom", handler);
  }, [camera]);

  useFrame((state, dt) => {
    if (!controlsRef.current) return;

    const targetChanged = target   !== prevTarget.current;
    const modeChanged   = freeCam  !== prevFreeCam.current;

    if (targetChanged || modeChanged) {
      prevTarget.current  = target;
      prevFreeCam.current = freeCam;

      const objPos = getLivePos(target);

      // Start a one-time glide transition
      inTransition.current = true;
      tProg.current = 0;
      startCam.current.copy(state.camera.position);
      startLook.current.copy(controlsRef.current.target);
      endLook.current.copy(objPos);

      if (!freeCam && MOVING_TARGETS.has(target)) {
        // Land camera in tracking position; continuous follow begins after
        endCam.current.copy(trackingCamPos(objPos));
      } else {
        endCam.current.copy(objPos.clone().add(staticOffset(target)));
      }

      // Enable/disable controls
      controlsRef.current.enabled = freeCam || !MOVING_TARGETS.has(target);
    }

    // ── TRACKING: continuously follow moving spacecraft ──────────
    if (!freeCam && MOVING_TARGETS.has(target)) {
      const craftPos  = getLivePos(target);
      const desiredPos = trackingCamPos(craftPos);

      state.camera.position.lerp(desiredPos, 0.02);
      state.camera.lookAt(craftPos);
      // Keep controls.target synced so switching to FREE CAM doesn't jump
      controlsRef.current.target.copy(craftPos);

    // ── One-time glide transition (static targets or FREE CAM jumps) ──
    } else if (inTransition.current) {
      tProg.current = Math.min(tProg.current + dt * 1.2, 1);
      const ease = 1 - Math.pow(1 - tProg.current, 3);
      state.camera.position.lerpVectors(startCam.current, endCam.current, ease);
      controlsRef.current.target.lerpVectors(startLook.current, endLook.current, ease);

      if (tProg.current >= 1) {
        inTransition.current = false;
        state.camera.position.copy(endCam.current);
        controlsRef.current.target.copy(endLook.current);
      }
    }

    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.04}
      rotateSpeed={0.25}
      zoomSpeed={0.4}
      autoRotate={false}
      enablePan={false}
      minDistance={target === "artemis" ? 0.00005 : 2.8}
      maxDistance={target === "artemis" ? 3 : 20}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.9}
    />
  );
}

/* ===================================================================
   Scene content
   =================================================================== */
function SceneContent({
  trackTarget,
  onTargetChange,
}: {
  trackTarget: TrackTarget;
  onTargetChange?: (t: TrackTarget) => void;
}) {
  const { trackedMissionId, playing, simSpeed, freeCam } = useMissionStore();
  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  const moonPosRef     = useRef(new THREE.Vector3(16.7, 0, 0));
  const issPosRef      = useRef(new THREE.Vector3(0, ISS_ORBIT_R, 0));
  const starshipPosRef = useRef(new THREE.Vector3(0, STARSHIP_ORBIT_R, 0));
  const starlinkPosRef = useRef(new THREE.Vector3(-STARLINK_ORBIT_R, 0, 0));

  const activeCameraTarget = useMemo((): TrackTarget => {
    if (trackTarget !== "overview") return trackTarget;
    switch (trackedMissionId) {
      case "artemis":       return "artemis";
      case "iss":           return "iss";
      case "starship-hls1": return "starship";
      case "starlink-6548": return "starlink";
      default:              return "overview";
    }
  }, [trackTarget, trackedMissionId]);

  const toEarth    = useCallback(() => onTargetChange?.("earth"),    [onTargetChange]);
  const toMoon     = useCallback(() => onTargetChange?.("moon"),     [onTargetChange]);
  const toSun      = useCallback(() => onTargetChange?.("sun"),      [onTargetChange]);
  const toISS      = useCallback(() => onTargetChange?.("iss"),      [onTargetChange]);
  const toStarship = useCallback(() => onTargetChange?.("starship"), [onTargetChange]);
  const toStarlink = useCallback(() => onTargetChange?.("starlink"), [onTargetChange]);

  return (
    <>
      {/* Environment */}
      <Stars radius={400} depth={80} count={8000} factor={2.5} saturation={0.1} fade={false} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 3, 5]} intensity={3.0} color="#ffffff" />

      {/* Celestial bodies */}
      <Earth radius={2} onClick={toEarth} showKSC />
      <LaunchPadGroup />
      <Moon sunDirection={sunDir} onClick={toMoon} positionRef={moonPosRef} />
      <Sun onClick={toSun} />

      {/* Spacecraft — real angular velocities scaled by simSpeed */}
      <ISSTracker positionRef={issPosRef} onClick={toISS} />
      <CircularTracker
        positionRef={starshipPosRef} onClick={toStarship}
        playing={playing} simSpeed={simSpeed}
        orbitR={STARSHIP_ORBIT_R} inclination={STARSHIP_INCL}
        angVel={STARSHIP_ANG_VEL} startAngle={Math.PI * 0.7}
        color={COLORS.starship}
      />
      <CircularTracker
        positionRef={starlinkPosRef} onClick={toStarlink}
        playing={playing} simSpeed={simSpeed}
        orbitR={STARLINK_ORBIT_R} inclination={STARLINK_INCL}
        angVel={STARLINK_ANG_VEL} startAngle={Math.PI * 1.4}
        color={COLORS.starlink}
      />

      {/* Artemis II pre-launch dashed orbit path */}
      <ArtemisIIPreLaunchPath />

      {/* Artemis II trans-lunar free-return trajectory + real-time dot */}
      <ArtemisIITrajectory />
      <ArtemisIISpacecraftTracker />

      {/* Neon glow orbit paths */}
      <GlowOrbitPath radius={ISS_ORBIT_R}      color={COLORS.iss}      inclination={ISS_INCL} />
      <GlowOrbitPath radius={STARSHIP_ORBIT_R} color={COLORS.starship} inclination={STARSHIP_INCL} />
      <GlowOrbitPath radius={STARLINK_ORBIT_R} color={COLORS.starlink} inclination={STARLINK_INCL} />

      {/* Camera */}
      <CameraController
        target={activeCameraTarget}
        freeCam={freeCam}
        posRefs={{
          moon:     moonPosRef,
          iss:      issPosRef,
          starship: starshipPosRef,
          starlink: starlinkPosRef,
        }}
      />
    </>
  );
}

/* ===================================================================
   Main export
   =================================================================== */
type Props = {
  trackTarget?: TrackTarget;
  onTargetChange?: (t: TrackTarget) => void;
};

export default function MissionControlScene({
  trackTarget = "overview",
  onTargetChange,
}: Props) {
  return (
    <SceneErrorBoundary>
      <Canvas
        camera={{ position: [0, 2, 7], fov: 45, near: 0.00001, far: 1000 }}
        style={{ width: "100%", height: "100%", background: "#000000" }}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        frameloop="always"
      >
        <color attach="background" args={["#000000"]} />
        <SceneContent trackTarget={trackTarget} onTargetChange={onTargetChange} />
      </Canvas>
    </SceneErrorBoundary>
  );
}
