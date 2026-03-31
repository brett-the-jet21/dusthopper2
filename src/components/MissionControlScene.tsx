"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import Earth from "./Earth";
import Moon from "./Moon";
import Sun, { SUN_POSITION } from "./Sun";
import Rocket from "./Rocket";
import ISS from "./ISS";
import ArtemisRocket from "./ArtemisRocket";
import type { LaunchTelemetry } from "./Rocket";
import { useMissionStore } from "@/lib/store/missionStore";

/* ===================================================================
   Track targets
   =================================================================== */
export type TrackTarget =
  | "overview"
  | "earth"
  | "moon"
  | "sun"
  | "rocket"
  | "iss"
  | "artemis"
  | "starship"
  | "starlink";

const MOVING_TARGETS = new Set<TrackTarget>(["iss", "rocket", "moon", "artemis", "starship", "starlink"]);

/* Camera distances and offsets per target */
function getTargetConfig(target: TrackTarget) {
  switch (target) {
    case "earth":
      return { distance: 16, offset: new THREE.Vector3(0, 3, 16) };
    case "moon":
      return { distance: 8, offset: new THREE.Vector3(0, 3, 8) };
    case "sun":
      return { distance: 60, offset: new THREE.Vector3(-50, 15, 30) };
    case "iss":
      return { distance: 2.5, offset: new THREE.Vector3(0, 0.5, 2) };
    case "rocket":
      return { distance: 3, offset: new THREE.Vector3(2, 1.5, 3) };
    case "artemis":
      return { distance: 1.5, offset: new THREE.Vector3(0.8, 0.5, 1.2) };
    case "starship":
      return { distance: 2.5, offset: new THREE.Vector3(0, 0.5, 2) };
    case "starlink":
      return { distance: 2.0, offset: new THREE.Vector3(0.5, 0.3, 1.5) };
    default:
      return { distance: 35, offset: new THREE.Vector3(0, 12, 35) };
  }
}

/* ------------------------------------------------------------------
   Camera controller
   ------------------------------------------------------------------ */
function CameraController({
  target,
  moonPosRef,
  rocketPosRef,
  issPosRef,
  artemisPosRef,
  starshipPosRef,
  starlinkPosRef,
}: {
  target: TrackTarget;
  moonPosRef: React.MutableRefObject<THREE.Vector3>;
  rocketPosRef: React.MutableRefObject<THREE.Vector3>;
  issPosRef: React.MutableRefObject<THREE.Vector3>;
  artemisPosRef: React.MutableRefObject<THREE.Vector3>;
  starshipPosRef: React.MutableRefObject<THREE.Vector3>;
  starlinkPosRef: React.MutableRefObject<THREE.Vector3>;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const isTransitioning = useRef(false);
  const prevTarget = useRef<TrackTarget>("overview");
  const transitionProgress = useRef(0);

  const getTargetPosition = useCallback(
    (t: TrackTarget): THREE.Vector3 => {
      switch (t) {
        case "iss":
          return issPosRef.current.clone();
        case "rocket":
          return rocketPosRef.current.clone();
        case "moon":
          return moonPosRef.current.clone();
        case "artemis":
          return artemisPosRef.current.clone();
        case "starship":
          return starshipPosRef.current.clone();
        case "starlink":
          return starlinkPosRef.current.clone();
        case "sun":
          return SUN_POSITION.clone();
        case "earth":
          return new THREE.Vector3(0, 0, 0);
        default:
          return new THREE.Vector3(0, 0, 0);
      }
    },
    [moonPosRef, rocketPosRef, issPosRef, artemisPosRef, starshipPosRef, starlinkPosRef],
  );

  useFrame((_, dt) => {
    if (!controlsRef.current) return;

    if (target !== prevTarget.current) {
      isTransitioning.current = true;
      transitionProgress.current = 0;
      prevTarget.current = target;
    }

    const objPos = getTargetPosition(target);
    const config = getTargetConfig(target);

    if (isTransitioning.current) {
      transitionProgress.current = Math.min(transitionProgress.current + dt * 1.5, 1);
      const t = 1 - Math.pow(1 - transitionProgress.current, 3);

      controlsRef.current.target.lerp(objPos, t * 0.12);
      const desiredCamPos = objPos.clone().add(config.offset);
      camera.position.lerp(desiredCamPos, t * 0.08);

      if (transitionProgress.current >= 1) {
        isTransitioning.current = false;
      }
    } else if (MOVING_TARGETS.has(target)) {
      controlsRef.current.target.lerp(objPos, 0.08);
      const camDir = camera.position.clone().sub(controlsRef.current.target).normalize();
      const desiredPos = objPos.clone().add(camDir.multiplyScalar(config.distance));
      camera.position.lerp(desiredPos, 0.06);
    }

    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      zoomSpeed={0.8}
      rotateSpeed={0.5}
      panSpeed={0.4}
      minDistance={0.1}
      maxDistance={800}
      enableDamping
      dampingFactor={0.06}
    />
  );
}

/* ------------------------------------------------------------------
   Artemis elliptical orbit path
   ------------------------------------------------------------------ */
function ArtemisOrbitPath() {
  const geometry = useMemo(() => {
    // Perigee: ~6.35 scene units (370 km altitude)
    // Apogee: ~55 scene units (visually toward Moon at 50)
    const rPeri = 6.35;
    const rApo = 55.0;
    const a = (rPeri + rApo) / 2; // semi-major axis
    const c = a - rPeri;           // center-to-focus (Earth is at origin/focus)
    const b = Math.sqrt(a * a - c * c); // semi-minor axis
    const centerX = c;             // ellipse center offset from Earth along +X

    const INCLINATION = 28.5 * (Math.PI / 180);
    const pts: THREE.Vector3[] = [];
    const N = 300;
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const x2 = centerX + a * Math.cos(theta);
      const z2 = b * Math.sin(theta);
      // Apply inclination around X-axis so orbit is tilted 28.5°
      const x3 = x2;
      const y3 = -z2 * Math.sin(INCLINATION);
      const z3 = z2 * Math.cos(INCLINATION);
      pts.push(new THREE.Vector3(x3, y3, z3));
    }

    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: "#FF6B00",
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geometry, mat);
  }, [geometry]);

  return <primitive object={lineObj} />;
}

/* ------------------------------------------------------------------
   Circular orbit paths (ISS, Starship, Starlink)
   ------------------------------------------------------------------ */
function CircularOrbitPath({
  radius,
  color,
  inclination = 0,
  opacity = 0.2,
}: {
  radius: number;
  color: string;
  inclination?: number;
  opacity?: number;
}) {
  const lineObj = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * Math.sin(inclination) * radius;
      const z = Math.sin(theta) * Math.cos(inclination) * radius;
      pts.push(new THREE.Vector3(x, y, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, [radius, inclination, color, opacity]);

  return <primitive object={lineObj} />;
}

/* ------------------------------------------------------------------
   Starship HLS-1 marker (simple model, orbiting)
   ------------------------------------------------------------------ */
const STARSHIP_ORBIT_R = 6.33; // ~250 km altitude
const STARSHIP_INCL = 51.6 * (Math.PI / 180);

function StarshipHLS({
  positionRef,
  onClick,
  playing,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
  playing: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(Math.PI * 0.7);

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#88bbff", roughness: 0.3, metalness: 0.8 }),
    [],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (playing) angleRef.current += delta * 0.35;

    const a = angleRef.current;
    const x = Math.cos(a) * STARSHIP_ORBIT_R;
    const y = Math.sin(a) * STARSHIP_ORBIT_R * Math.sin(STARSHIP_INCL);
    const z = Math.sin(a) * STARSHIP_ORBIT_R * Math.cos(STARSHIP_INCL);
    groupRef.current.position.set(x, y, z);
    positionRef.current.set(x, y, z);
  });

  const S = 0.002;
  return (
    <group ref={groupRef} onClick={onClick} scale={[S, S, S]}>
      {/* Starship body */}
      <mesh position={[0, 30, 0]} material={mat}>
        <cylinderGeometry args={[4.5, 4.5, 50, 16]} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 58, 0]} material={mat}>
        <coneGeometry args={[4.5, 16, 16]} />
      </mesh>
      {/* Fins */}
      {[0, 90, 180, 270].map((deg, i) => (
        <mesh
          key={i}
          position={[Math.cos((deg * Math.PI) / 180) * 5, 5, Math.sin((deg * Math.PI) / 180) * 5]}
          rotation={[0, (deg * Math.PI) / 180, 0]}
          material={mat}
        >
          <boxGeometry args={[1, 16, 8]} />
        </mesh>
      ))}
      <pointLight color="#88bbff" intensity={0.2} distance={60} decay={2} />
    </group>
  );
}

/* ------------------------------------------------------------------
   Starlink-6548 marker
   ------------------------------------------------------------------ */
const STARLINK_ORBIT_R = 6.352; // ~550 km altitude
const STARLINK_INCL = 53 * (Math.PI / 180);

function StarlinkSat({
  positionRef,
  onClick,
  playing,
}: {
  positionRef: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
  playing: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(Math.PI * 1.4);

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#cc88ff", roughness: 0.3, metalness: 0.8 }),
    [],
  );
  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a0a33",
        roughness: 0.2,
        metalness: 0.5,
        emissive: "#220066",
        emissiveIntensity: 0.3,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (playing) angleRef.current += delta * 0.42;

    const a = angleRef.current;
    const x = Math.cos(a) * STARLINK_ORBIT_R;
    const y = Math.sin(a) * STARLINK_ORBIT_R * Math.sin(STARLINK_INCL);
    const z = Math.sin(a) * STARLINK_ORBIT_R * Math.cos(STARLINK_INCL);
    groupRef.current.position.set(x, y, z);
    positionRef.current.set(x, y, z);
  });

  const S = 0.0018;
  return (
    <group ref={groupRef} onClick={onClick} scale={[S, S, S]}>
      {/* Body */}
      <mesh material={bodyMat}>
        <boxGeometry args={[4, 2, 8]} />
      </mesh>
      {/* Solar panels */}
      <mesh position={[18, 0, 0]} material={panelMat}>
        <boxGeometry args={[30, 0.3, 6]} />
      </mesh>
      <mesh position={[-18, 0, 0]} material={panelMat}>
        <boxGeometry args={[30, 0.3, 6]} />
      </mesh>
      <pointLight color="#cc88ff" intensity={0.15} distance={50} decay={2} />
    </group>
  );
}

/* ------------------------------------------------------------------
   Neon orbit tracers (decorative background rings)
   ------------------------------------------------------------------ */
const decorOrbits = [
  { radius: 8.2, tilt: 0.4, rot: 0.2, color: "#00ffff" },
  { radius: 9.5, tilt: 0.85, rot: 1.1, color: "#ff00ff" },
  { radius: 7.8, tilt: 0.15, rot: 2.8, color: "#00ff88" },
  { radius: 10.5, tilt: 1.2, rot: 0.6, color: "#4488ff" },
];

function OrbitTracers() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.015;
  });

  return (
    <group ref={groupRef}>
      {decorOrbits.map((o, i) => (
        <group key={i}>
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.012, 16, 200]} />
            <meshBasicMaterial
              color={o.color}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.06, 16, 200]} />
            <meshBasicMaterial
              color={o.color}
              transparent
              opacity={0.06}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------
   Satellite constellation (decorative background)
   ------------------------------------------------------------------ */
function Satellites() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 80;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const sats = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        radius: 7.0 + Math.random() * 3.5,
        speed: 0.15 + Math.random() * 0.4,
        tilt: (Math.random() - 0.5) * 1.6,
        phase: Math.random() * Math.PI * 2,
        rotAxis: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    sats.forEach((s, i) => {
      const angle = t * s.speed + s.phase;
      const x = Math.cos(angle) * s.radius;
      const z = Math.sin(angle) * s.radius;
      const y = Math.sin(angle + s.rotAxis) * Math.sin(s.tilt) * s.radius * 0.3;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.04);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color="#88ffff"
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------
   Shooting stars
   ------------------------------------------------------------------ */
function ShootingStars() {
  const ref = useRef<THREE.Group>(null);
  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      arr.push({
        delay: Math.random() * 30,
        duration: 0.5 + Math.random() * 0.8,
        start: new THREE.Vector3(
          (Math.random() - 0.5) * 400,
          80 + Math.random() * 200,
          (Math.random() - 0.5) * 400,
        ),
        dir: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          -1 - Math.random(),
          (Math.random() - 0.5) * 2,
        ).normalize(),
        speed: 80 + Math.random() * 120,
      });
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.children.forEach((child, i) => {
      const s = stars[i];
      const cycle = (t + s.delay) % (s.delay + s.duration + 5);
      if (cycle < s.duration) {
        const p = cycle / s.duration;
        const pos = s.start.clone().add(s.dir.clone().multiplyScalar(p * s.speed));
        child.position.copy(pos);
        (child as THREE.Mesh).scale.setScalar(1 - p * 0.8);
        ((child as THREE.Mesh).material as THREE.Material).opacity = (1 - p) * 0.9;
        child.visible = true;
      } else {
        child.visible = false;
      }
    });
  });

  return (
    <group ref={ref}>
      {stars.map((_, i) => (
        <mesh key={i} visible={false}>
          <sphereGeometry args={[0.15, 4, 4]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------
   Moon orbit path (decorative)
   ------------------------------------------------------------------ */
function MoonOrbitPath() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[50, 0.03, 8, 256]} />
      <meshBasicMaterial
        color="#445566"
        transparent
        opacity={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------
   Object labels
   ------------------------------------------------------------------ */
function ObjectLabel({
  position,
  label,
  onClick,
  color = "#ffffff",
}: {
  position: THREE.Vector3 | [number, number, number];
  label: string;
  onClick?: () => void;
  color?: string;
}) {
  const pos = position instanceof THREE.Vector3 ? position.toArray() : position;
  return (
    <Html position={[pos[0], pos[1] + 2.5, pos[2]]} center distanceFactor={40} style={{ pointerEvents: "auto" }}>
      <button
        onClick={onClick}
        className="group flex flex-col items-center gap-1 cursor-pointer select-none"
        style={{ transform: "translateY(-10px)" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full backdrop-blur-sm border transition-all group-hover:scale-110"
          style={{ color, borderColor: color + "33", backgroundColor: "#00000088" }}
        >
          {label}
        </span>
        <div className="w-0.5 h-3 rounded-full opacity-40" style={{ backgroundColor: color }} />
      </button>
    </Html>
  );
}

function TrackingLabel({
  posRef,
  label,
  onClick,
  color = "#ffffff",
  yOffset = 2.5,
}: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  label: string;
  onClick?: () => void;
  color?: string;
  yOffset?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.copy(posRef.current);
    }
  });

  return (
    <group ref={ref}>
      <Html center distanceFactor={40} position={[0, yOffset, 0]} style={{ pointerEvents: "auto" }}>
        <button
          onClick={onClick}
          className="group flex flex-col items-center gap-1 cursor-pointer select-none"
          style={{ transform: "translateY(-10px)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full backdrop-blur-sm border transition-all group-hover:scale-110 whitespace-nowrap"
            style={{ color, borderColor: color + "33", backgroundColor: "#00000088" }}
          >
            {label}
          </span>
          <div className="w-0.5 h-2 rounded-full opacity-40" style={{ backgroundColor: color }} />
        </button>
      </Html>
    </group>
  );
}

/* ==================================================================
   Inner scene — reads mission store
   ================================================================== */
function SceneContent({
  isLaunching,
  onTelemetry,
  trackTarget,
  onTargetChange,
}: {
  isLaunching: boolean;
  onTelemetry?: (t: LaunchTelemetry) => void;
  trackTarget: TrackTarget;
  onTargetChange?: (t: TrackTarget) => void;
}) {
  const { trackedMissionId, playing } = useMissionStore();

  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const moonPosRef = useRef(new THREE.Vector3(50, 0, 0));
  const rocketPosRef = useRef(new THREE.Vector3(0, 6.08, 0));
  const issPosRef = useRef(new THREE.Vector3(0, 6.4, 0));
  const artemisPosRef = useRef(new THREE.Vector3(6.35, 0, 0));
  const starshipPosRef = useRef(new THREE.Vector3(0, 6.33, 0));
  const starlinkPosRef = useRef(new THREE.Vector3(-6.35, 0, 0));

  // Derive camera target from the tracked mission, but allow override via trackTarget prop
  const activeCameraTarget = useMemo((): TrackTarget => {
    if (trackTarget !== "overview") return trackTarget;
    switch (trackedMissionId) {
      case "artemis": return "artemis";
      case "iss": return "iss";
      case "starship-hls1": return "starship";
      case "starlink-6548": return "starlink";
      default: return "overview";
    }
  }, [trackTarget, trackedMissionId]);

  const handleClickEarth = useCallback(() => onTargetChange?.("earth"), [onTargetChange]);
  const handleClickMoon = useCallback(() => onTargetChange?.("moon"), [onTargetChange]);
  const handleClickSun = useCallback(() => onTargetChange?.("sun"), [onTargetChange]);
  const handleClickISS = useCallback(() => onTargetChange?.("iss"), [onTargetChange]);
  const handleClickRocket = useCallback(() => onTargetChange?.("rocket"), [onTargetChange]);
  const handleClickArtemis = useCallback(() => onTargetChange?.("artemis"), [onTargetChange]);
  const handleClickStarship = useCallback(() => onTargetChange?.("starship"), [onTargetChange]);
  const handleClickStarlink = useCallback(() => onTargetChange?.("starlink"), [onTargetChange]);

  return (
    <>
      <Stars radius={1500} depth={400} count={12000} factor={4.5} saturation={0.2} />

      <ambientLight intensity={0.04} />
      <directionalLight position={[15, 2, 0]} intensity={2.5} color="#fff5e6" />
      <directionalLight position={[-8, -2, -3]} intensity={0.08} color="#334466" />

      <Earth radius={6} onClick={handleClickEarth} />

      <Moon sunDirection={sunDir} onClick={handleClickMoon} positionRef={moonPosRef} />
      <MoonOrbitPath />

      <Sun onClick={handleClickSun} />

      <ISS onClick={handleClickISS} positionRef={issPosRef} />

      {/* Artemis rocket */}
      <ArtemisRocket
        playing={playing}
        positionRef={artemisPosRef}
        onClick={handleClickArtemis}
      />

      {/* Starship HLS-1 */}
      <StarshipHLS
        positionRef={starshipPosRef}
        onClick={handleClickStarship}
        playing={playing}
      />

      {/* Starlink-6548 */}
      <StarlinkSat
        positionRef={starlinkPosRef}
        onClick={handleClickStarlink}
        playing={playing}
      />

      {/* Orbit paths */}
      <ArtemisOrbitPath />
      <CircularOrbitPath
        radius={6.383}
        color="#66ffaa"
        inclination={51.6 * (Math.PI / 180)}
        opacity={0.18}
      />
      <CircularOrbitPath
        radius={STARSHIP_ORBIT_R}
        color="#88bbff"
        inclination={STARSHIP_INCL}
        opacity={0.15}
      />
      <CircularOrbitPath
        radius={STARLINK_ORBIT_R}
        color="#cc88ff"
        inclination={STARLINK_INCL}
        opacity={0.15}
      />

      <OrbitTracers />
      <Satellites />
      <ShootingStars />

      {/* Static labels */}
      <ObjectLabel position={[0, 6.5, 0]} label="Earth" onClick={handleClickEarth} color="#44aaff" />
      <ObjectLabel position={SUN_POSITION.toArray()} label="Sun" onClick={handleClickSun} color="#ffaa33" />

      {/* Tracking labels */}
      <TrackingLabel posRef={moonPosRef} label="Moon" onClick={handleClickMoon} color="#aaaacc" yOffset={3} />
      <TrackingLabel posRef={issPosRef} label="ISS" onClick={handleClickISS} color="#66ffaa" yOffset={0.8} />
      <TrackingLabel posRef={artemisPosRef} label="Artemis I" onClick={handleClickArtemis} color="#FF6B00" yOffset={0.5} />
      <TrackingLabel posRef={starshipPosRef} label="Starship HLS" onClick={handleClickStarship} color="#88bbff" yOffset={0.5} />
      <TrackingLabel posRef={starlinkPosRef} label="Starlink-6548" onClick={handleClickStarlink} color="#cc88ff" yOffset={0.4} />

      {isLaunching && (
        <TrackingLabel posRef={rocketPosRef} label="Falcon 9" onClick={handleClickRocket} color="#ff8844" yOffset={0.4} />
      )}

      <Rocket
        isLaunching={isLaunching}
        padPosition={[0, 6.08, 0]}
        scale={0.025}
        onTelemetry={onTelemetry}
        positionRef={rocketPosRef}
      />

      <CameraController
        target={activeCameraTarget}
        moonPosRef={moonPosRef}
        rocketPosRef={rocketPosRef}
        issPosRef={issPosRef}
        artemisPosRef={artemisPosRef}
        starshipPosRef={starshipPosRef}
        starlinkPosRef={starlinkPosRef}
      />
    </>
  );
}

/* ==================================================================
   Main export
   ================================================================== */
type Props = {
  isLaunching?: boolean;
  onTelemetry?: (t: LaunchTelemetry) => void;
  trackTarget?: TrackTarget;
  onTargetChange?: (t: TrackTarget) => void;
};

export default function MissionControlScene({
  isLaunching = false,
  onTelemetry,
  trackTarget = "overview",
  onTargetChange,
}: Props) {
  return (
    <Canvas
      camera={{ position: [0, 12, 35], fov: 45, near: 0.01, far: 3000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        powerPreference: "high-performance",
      }}
      frameloop="always"
    >
      <SceneContent
        isLaunching={isLaunching}
        onTelemetry={onTelemetry}
        trackTarget={trackTarget}
        onTargetChange={onTargetChange}
      />
    </Canvas>
  );
}

// Export constants for use by other components
export { STARSHIP_ORBIT_R, STARSHIP_INCL, STARLINK_ORBIT_R, STARLINK_INCL };
