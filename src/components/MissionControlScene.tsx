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
  | "overview"
  | "earth"
  | "moon"
  | "sun"
  | "iss"
  | "artemis"
  | "starship"
  | "starlink";

/* ===================================================================
   Scene constants — Earth radius = 2.0 scene units
   =================================================================== */
const EARTH_SCENE_R = 2.0;
const EARTH_KM = 6371;
const SCENE_SCALE = EARTH_SCENE_R / EARTH_KM;

const ARTEMIS_ORBIT_R = EARTH_SCENE_R + (370 / EARTH_KM) * EARTH_SCENE_R; // ~2.116
const ARTEMIS_INCL    = 28.5 * (Math.PI / 180);
const ARTEMIS_PERIOD  = 91.5 * 60; // seconds
const ARTEMIS_SPEED   = 200;       // visual speedup

export const STARSHIP_ORBIT_R = EARTH_SCENE_R + (250 / EARTH_KM) * EARTH_SCENE_R; // ~2.079
export const STARSHIP_INCL    = 51.6 * (Math.PI / 180);

export const STARLINK_ORBIT_R = EARTH_SCENE_R + (550 / EARTH_KM) * EARTH_SCENE_R; // ~2.173
export const STARLINK_INCL    = 53 * (Math.PI / 180);

/* ===================================================================
   ISS TLE — satellite.js propagation
   =================================================================== */
const TLE1 = "1 25544U 98067A   25055.54896991  .00024200  00000+0  42900-3 0  9993";
const TLE2 = "2 25544  51.6420 294.2170 0003568 351.0060  64.9350 15.50037360438908";
const satrec = twoline2satrec(TLE1, TLE2);

/* ===================================================================
   Tiny dot — all spacecraft render as this
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
  useFrame(() => {
    if (meshRef.current) meshRef.current.position.copy(positionRef.current);
  });
  return (
    <mesh ref={meshRef} onClick={onClick}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/* ===================================================================
   Spacecraft trackers — handle orbital math and update positionRef
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
    // ECI → ECEF → Three.js (Y-up)
    const xEcef =  pos.x * cosG + pos.y * sinG;
    const yEcef = -pos.x * sinG + pos.y * cosG;
    const zEcef =  pos.z;
    positionRef.current.set(xEcef * SCENE_SCALE, zEcef * SCENE_SCALE, -yEcef * SCENE_SCALE);
  });
  return <SpacecraftDot color="#66ffaa" positionRef={positionRef} onClick={onClick} />;
}

function ArtemisTracker({
  positionRef,
  onClick,
  playing,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
  playing: boolean;
}) {
  const angleRef = useRef(0);
  useFrame((_, delta) => {
    if (playing) angleRef.current += delta * (2 * Math.PI / ARTEMIS_PERIOD) * ARTEMIS_SPEED;
    const a = angleRef.current;
    positionRef.current.set(
      Math.cos(a) * ARTEMIS_ORBIT_R,
      Math.sin(a) * ARTEMIS_ORBIT_R * Math.sin(ARTEMIS_INCL),
      Math.sin(a) * ARTEMIS_ORBIT_R * Math.cos(ARTEMIS_INCL),
    );
  });
  return <SpacecraftDot color="#FF6B00" positionRef={positionRef} onClick={onClick} />;
}

function StarshipTracker({
  positionRef,
  onClick,
  playing,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
  playing: boolean;
}) {
  const angleRef = useRef(Math.PI * 0.7);
  useFrame((_, delta) => {
    if (playing) angleRef.current += delta * 0.35;
    const a = angleRef.current;
    positionRef.current.set(
      Math.cos(a) * STARSHIP_ORBIT_R,
      Math.sin(a) * STARSHIP_ORBIT_R * Math.sin(STARSHIP_INCL),
      Math.sin(a) * STARSHIP_ORBIT_R * Math.cos(STARSHIP_INCL),
    );
  });
  return <SpacecraftDot color="#88bbff" positionRef={positionRef} onClick={onClick} />;
}

function StarlinkTracker({
  positionRef,
  onClick,
  playing,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
  playing: boolean;
}) {
  const angleRef = useRef(Math.PI * 1.4);
  useFrame((_, delta) => {
    if (playing) angleRef.current += delta * 0.42;
    const a = angleRef.current;
    positionRef.current.set(
      Math.cos(a) * STARLINK_ORBIT_R,
      Math.sin(a) * STARLINK_ORBIT_R * Math.sin(STARLINK_INCL),
      Math.sin(a) * STARLINK_ORBIT_R * Math.cos(STARLINK_INCL),
    );
  });
  return <SpacecraftDot color="#cc88ff" positionRef={positionRef} onClick={onClick} />;
}

/* ===================================================================
   Orbit path lines
   =================================================================== */
function CircularOrbitPath({
  radius,
  color,
  inclination = 0,
  opacity = 0.4,
}: {
  radius: number;
  color: string;
  inclination?: number;
  opacity?: number;
}) {
  const line = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(t) * radius,
        Math.sin(t) * Math.sin(inclination) * radius,
        Math.sin(t) * Math.cos(inclination) * radius,
      ));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
  }, [radius, inclination, color, opacity]);
  return <primitive object={line} />;
}

function ArtemisOrbitPath() {
  const line = useMemo(() => {
    const rPeri = ARTEMIS_ORBIT_R;
    const rApo  = 18.3;
    const a = (rPeri + rApo) / 2;
    const c = a - rPeri;
    const b = Math.sqrt(a * a - c * c);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 300; i++) {
      const theta = (i / 300) * Math.PI * 2;
      const x = c + a * Math.cos(theta);
      const z = b * Math.sin(theta);
      pts.push(new THREE.Vector3(x, -z * Math.sin(ARTEMIS_INCL), z * Math.cos(ARTEMIS_INCL)));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: "#FF6B00", transparent: true, opacity: 0.4, depthWrite: false }),
    );
  }, []);
  return <primitive object={line} />;
}

/* ===================================================================
   Camera controller — one-time smooth transition per target change.
   No continuous following. User drives the camera after each jump.
   =================================================================== */
function CameraController({
  target,
  posRefs,
}: {
  target: TrackTarget;
  posRefs: {
    moon: React.MutableRefObject<THREE.Vector3>;
    iss: React.MutableRefObject<THREE.Vector3>;
    artemis: React.MutableRefObject<THREE.Vector3>;
    starship: React.MutableRefObject<THREE.Vector3>;
    starlink: React.MutableRefObject<THREE.Vector3>;
  };
}) {
  const controlsRef   = useRef<any>(null);
  const prevTarget    = useRef<TrackTarget>("overview");
  const transitioning = useRef(false);
  const tProg         = useRef(0);
  const startCam      = useRef(new THREE.Vector3());
  const startLook     = useRef(new THREE.Vector3());
  const endCam        = useRef(new THREE.Vector3());
  const endLook       = useRef(new THREE.Vector3());

  function getObjPos(t: TrackTarget): THREE.Vector3 {
    switch (t) {
      case "iss":      return posRefs.iss.current.clone();
      case "moon":     return posRefs.moon.current.clone();
      case "artemis":  return posRefs.artemis.current.clone();
      case "starship": return posRefs.starship.current.clone();
      case "starlink": return posRefs.starlink.current.clone();
      case "sun":      return SUN_POSITION.clone();
      case "earth":    return new THREE.Vector3(0, 0, 0);
      default:         return new THREE.Vector3(0, 0, 0);
    }
  }

  function getOffset(t: TrackTarget): THREE.Vector3 {
    switch (t) {
      case "earth":                            return new THREE.Vector3(0, 1, 5);
      case "moon":                             return new THREE.Vector3(0, 0.5, 2);
      case "sun":                              return new THREE.Vector3(-30, 10, 20);
      case "iss": case "artemis":
      case "starship": case "starlink":        return new THREE.Vector3(0.2, 0.1, 0.4);
      default:                                 return new THREE.Vector3(0, 3, 8);
    }
  }

  useFrame((state, dt) => {
    if (!controlsRef.current) return;

    if (target !== prevTarget.current) {
      prevTarget.current = target;
      transitioning.current = true;
      tProg.current = 0;
      startCam.current.copy(state.camera.position);
      startLook.current.copy(controlsRef.current.target);
      const objPos = getObjPos(target);
      endLook.current.copy(objPos);
      endCam.current.copy(objPos.clone().add(getOffset(target)));
    }

    if (transitioning.current) {
      tProg.current = Math.min(tProg.current + dt * 1.0, 1);
      const ease = 1 - Math.pow(1 - tProg.current, 3); // cubic ease-out
      state.camera.position.lerpVectors(startCam.current, endCam.current, ease);
      controlsRef.current.target.lerpVectors(startLook.current, endLook.current, ease);
      if (tProg.current >= 1) {
        transitioning.current = false;
        // Sync controls after transition completes
        controlsRef.current.target.copy(endLook.current);
        state.camera.position.copy(endCam.current);
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
  const { trackedMissionId, playing } = useMissionStore();
  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  const moonPosRef     = useRef(new THREE.Vector3(16.7, 0, 0));
  const issPosRef      = useRef(new THREE.Vector3(0, 2.13, 0));
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
      {/* Stars */}
      <Stars radius={200} depth={50} count={4000} factor={3} saturation={0} fade />

      {/* Lighting — space is dark */}
      <ambientLight intensity={0.1} />
      <pointLight position={[80, 0, 0]} intensity={2.5} color="#ffffff" />

      {/* Celestial bodies */}
      <Earth radius={2} onClick={toEarth} />
      <Moon sunDirection={sunDir} onClick={toMoon} positionRef={moonPosRef} />
      <Sun onClick={toSun} />

      {/* Spacecraft dots */}
      <ISSTracker      positionRef={issPosRef}      onClick={toISS}      />
      <ArtemisTracker  positionRef={artemisPosRef}  onClick={toArtemis}  playing={playing} />
      <StarshipTracker positionRef={starshipPosRef} onClick={toStarship} playing={playing} />
      <StarlinkTracker positionRef={starlinkPosRef} onClick={toStarlink} playing={playing} />

      {/* Orbit path lines */}
      <ArtemisOrbitPath />
      <CircularOrbitPath radius={ARTEMIS_ORBIT_R}  color="#66ffaa" inclination={51.6 * Math.PI / 180} />
      <CircularOrbitPath radius={STARSHIP_ORBIT_R} color="#88bbff" inclination={STARSHIP_INCL} />
      <CircularOrbitPath radius={STARLINK_ORBIT_R} color="#cc88ff" inclination={STARLINK_INCL} />

      {/* Camera */}
      <CameraController
        target={activeCameraTarget}
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
