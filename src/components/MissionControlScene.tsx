"use client";

import { useRef, useMemo, useCallback, Component, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Line2 } from "three-stdlib";
import { LineMaterial } from "three-stdlib";
import { LineGeometry } from "three-stdlib";
import * as THREE from "three";
import Earth from "./Earth";
import Moon from "./Moon";
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
