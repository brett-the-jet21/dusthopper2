"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import Earth from "./Earth";
import Moon from "./Moon";
import Sun, { SUN_POSITION } from "./Sun";
import { useMissionStore } from "@/lib/store/missionStore";
import { twoline2satrec, propagate, gstime } from "satellite.js";

/* ===================================================================
   Types
   =================================================================== */
export type TrackTarget =
  | "overview" | "earth" | "moon" | "sun"
  | "iss" | "artemis" | "starship" | "starlink";

const MOVING_TARGETS = new Set<TrackTarget>(["iss", "moon", "artemis", "starship", "starlink"]);

/* ===================================================================
   Scene constants — Earth radius = 2.0 scene units = 6,371 km
   =================================================================== */
const EARTH_SCENE_R = 2.0;
const EARTH_KM      = 6371;
const SCENE_SCALE   = EARTH_SCENE_R / EARTH_KM;

const ARTEMIS_ORBIT_R = EARTH_SCENE_R + (370  / EARTH_KM) * EARTH_SCENE_R; // 2.116
const ARTEMIS_INCL    = 28.5  * (Math.PI / 180);
const ARTEMIS_ANG_VEL = (2 * Math.PI) / (91.5  * 60); // rad/s at 1×

export const STARSHIP_ORBIT_R = EARTH_SCENE_R + (250  / EARTH_KM) * EARTH_SCENE_R; // 2.079
export const STARSHIP_INCL    = 51.6  * (Math.PI / 180);
const STARSHIP_ANG_VEL        = (2 * Math.PI) / (91.5  * 60);

const ISS_ORBIT_R = EARTH_SCENE_R + (408  / EARTH_KM) * EARTH_SCENE_R; // 2.128
const ISS_INCL    = 51.64 * (Math.PI / 180);

export const STARLINK_ORBIT_R = EARTH_SCENE_R + (550  / EARTH_KM) * EARTH_SCENE_R; // 2.173
export const STARLINK_INCL    = 53    * (Math.PI / 180);
const STARLINK_ANG_VEL        = (2 * Math.PI) / (95.6  * 60);

/* Per-mission neon colors */
const COLORS = {
  artemis: "#FF6B00",
  iss:     "#00ff88",
  starship:"#cc44ff",
  starlink:"#4488ff",
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
   Neon glow orbit path — two overlapping lines: bright core + additive glow
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
  const { core, glow } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) {
      const t = (i / 360) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(t) * radius,
        Math.sin(t) * Math.sin(inclination) * radius,
        Math.sin(t) * Math.cos(inclination) * radius,
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return {
      core: new THREE.Line(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 1.0, depthWrite: false,
      })),
      glow: new THREE.Line(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })),
    };
  }, [radius, inclination, color]);

  return (
    <>
      <primitive object={core} />
      <primitive object={glow} />
    </>
  );
}

/* ===================================================================
   Artemis elliptical orbit path (neon glow)
   =================================================================== */
function ArtemisGlowPath() {
  const { core, glow } = useMemo(() => {
    const rPeri = ARTEMIS_ORBIT_R;
    const rApo  = 18.3;
    const a = (rPeri + rApo) / 2;
    const c = a - rPeri;
    const b = Math.sqrt(a * a - c * c);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 360; i++) {
      const theta = (i / 360) * Math.PI * 2;
      const x = c + a * Math.cos(theta);
      const z = b * Math.sin(theta);
      pts.push(new THREE.Vector3(x, -z * Math.sin(ARTEMIS_INCL), z * Math.cos(ARTEMIS_INCL)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return {
      core: new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: COLORS.artemis, transparent: true, opacity: 1.0, depthWrite: false,
      })),
      glow: new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: COLORS.artemis, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })),
    };
  }, []);

  return (
    <>
      <primitive object={core} />
      <primitive object={glow} />
    </>
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
    artemis:  React.MutableRefObject<THREE.Vector3>;
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
      case "artemis":  return posRefs.artemis.current.clone();
      case "starship": return posRefs.starship.current.clone();
      case "starlink": return posRefs.starlink.current.clone();
      case "sun":      return SUN_POSITION.clone();
      default:         return new THREE.Vector3(0, 0, 0); // earth / overview
    }
  }

  function staticOffset(t: TrackTarget): THREE.Vector3 {
    switch (t) {
      case "earth":    return new THREE.Vector3(0, 1, 5);
      case "moon":     return new THREE.Vector3(0, 0.5, 2);
      case "sun":      return new THREE.Vector3(-30, 10, 20);
      default:         return new THREE.Vector3(0, 3, 8);
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
      minDistance={3}
      maxDistance={30}
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
  const artemisPosRef  = useRef(new THREE.Vector3(ARTEMIS_ORBIT_R, 0, 0));
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
  const toArtemis  = useCallback(() => onTargetChange?.("artemis"),  [onTargetChange]);
  const toStarship = useCallback(() => onTargetChange?.("starship"), [onTargetChange]);
  const toStarlink = useCallback(() => onTargetChange?.("starlink"), [onTargetChange]);

  return (
    <>
      {/* Environment */}
      <Stars radius={200} depth={50} count={4000} factor={3} saturation={0} fade />
      <ambientLight intensity={0.1} />
      <pointLight position={[80, 0, 0]} intensity={2.5} color="#ffffff" />

      {/* Celestial bodies */}
      <Earth radius={2} onClick={toEarth} />
      <Moon sunDirection={sunDir} onClick={toMoon} positionRef={moonPosRef} />
      <Sun onClick={toSun} />

      {/* Spacecraft — real angular velocities scaled by simSpeed */}
      <ISSTracker positionRef={issPosRef} onClick={toISS} />
      <CircularTracker
        positionRef={artemisPosRef} onClick={toArtemis}
        playing={playing} simSpeed={simSpeed}
        orbitR={ARTEMIS_ORBIT_R} inclination={ARTEMIS_INCL}
        angVel={ARTEMIS_ANG_VEL} startAngle={0}
        color={COLORS.artemis}
      />
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

      {/* Neon glow orbit paths */}
      <ArtemisGlowPath />
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
          artemis:  artemisPosRef,
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
    <Canvas
      camera={{ position: [0, 3, 8], fov: 45, near: 0.001, far: 10000 }}
      style={{ width: "100%", height: "100%", background: "#000000" }}
      gl={{ antialias: true }}
      frameloop="always"
    >
      <color attach="background" args={["#000000"]} />
      <SceneContent trackTarget={trackTarget} onTargetChange={onTargetChange} />
    </Canvas>
  );
}
