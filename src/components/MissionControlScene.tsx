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
import type { LaunchTelemetry } from "./Rocket";

/* ===================================================================
   Track targets — the camera can lock on to any of these
   =================================================================== */
export type TrackTarget =
  | "overview"
  | "earth"
  | "moon"
  | "sun"
  | "rocket"
  | "iss";

// Targets that move every frame and need continuous tracking
const MOVING_TARGETS = new Set<TrackTarget>(["iss", "rocket", "moon"]);

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
    default:
      return { distance: 35, offset: new THREE.Vector3(0, 12, 35) };
  }
}

/* ------------------------------------------------------------------
   Camera controller — smooth transitions + orbit around locked target
   ------------------------------------------------------------------ */
function CameraController({
  target,
  moonPosRef,
  rocketPosRef,
  issPosRef,
}: {
  target: TrackTarget;
  moonPosRef: React.MutableRefObject<THREE.Vector3>;
  rocketPosRef: React.MutableRefObject<THREE.Vector3>;
  issPosRef: React.MutableRefObject<THREE.Vector3>;
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
        case "sun":
          return SUN_POSITION.clone();
        case "earth":
          return new THREE.Vector3(0, 0, 0);
        default:
          return new THREE.Vector3(0, 0, 0);
      }
    },
    [moonPosRef, rocketPosRef, issPosRef],
  );

  useFrame((_, dt) => {
    if (!controlsRef.current) return;

    // Detect target change
    if (target !== prevTarget.current) {
      isTransitioning.current = true;
      transitionProgress.current = 0;
      prevTarget.current = target;
    }

    const objPos = getTargetPosition(target);
    const config = getTargetConfig(target);

    if (isTransitioning.current) {
      transitionProgress.current = Math.min(
        transitionProgress.current + dt * 1.5,
        1,
      );
      const t = 1 - Math.pow(1 - transitionProgress.current, 3); // ease-out cubic

      // Smoothly move orbit target to the object position
      controlsRef.current.target.lerp(objPos, t * 0.12);

      // For the initial transition, move camera to a good viewing angle
      const desiredCamPos = objPos.clone().add(config.offset);
      camera.position.lerp(desiredCamPos, t * 0.08);

      if (transitionProgress.current >= 1) {
        isTransitioning.current = false;
      }
    } else if (MOVING_TARGETS.has(target)) {
      // Continuously update orbit center to follow moving objects
      controlsRef.current.target.lerp(objPos, 0.08);
      // Keep camera at a consistent distance while following
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
   Neon orbit tracers
   ------------------------------------------------------------------ */
const orbits = [
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
      {orbits.map((o, i) => (
        <group key={i}>
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.012, 16, 200]} />
            <meshBasicMaterial
              color={o.color}
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.06, 16, 200]} />
            <meshBasicMaterial
              color={o.color}
              transparent
              opacity={0.08}
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
   Satellite constellation
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
      const y =
        Math.sin(angle + s.rotAxis) * Math.sin(s.tilt) * s.radius * 0.3;
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
        opacity={0.7}
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
        const pos = s.start
          .clone()
          .add(s.dir.clone().multiplyScalar(p * s.speed));
        child.position.copy(pos);
        (child as THREE.Mesh).scale.setScalar(1 - p * 0.8);
        ((child as THREE.Mesh).material as THREE.Material).opacity =
          (1 - p) * 0.9;
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
   Moon orbit path
   ------------------------------------------------------------------ */
function MoonOrbitPath() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[50, 0.03, 8, 256]} />
      <meshBasicMaterial
        color="#445566"
        transparent
        opacity={0.12}
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
  const pos =
    position instanceof THREE.Vector3 ? position.toArray() : position;
  return (
    <Html
      position={[pos[0], pos[1] + 2.5, pos[2]]}
      center
      distanceFactor={40}
      style={{ pointerEvents: "auto" }}
    >
      <button
        onClick={onClick}
        className="group flex flex-col items-center gap-1 cursor-pointer select-none"
        style={{ transform: "translateY(-10px)" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full backdrop-blur-sm border transition-all group-hover:scale-110"
          style={{
            color,
            borderColor: color + "33",
            backgroundColor: "#00000088",
          }}
        >
          {label}
        </span>
        <div
          className="w-0.5 h-3 rounded-full opacity-40"
          style={{ backgroundColor: color }}
        />
      </button>
    </Html>
  );
}

/* Floating label that follows a ref position */
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
      <Html
        center
        distanceFactor={40}
        position={[0, yOffset, 0]}
        style={{ pointerEvents: "auto" }}
      >
        <button
          onClick={onClick}
          className="group flex flex-col items-center gap-1 cursor-pointer select-none"
          style={{ transform: "translateY(-10px)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full backdrop-blur-sm border transition-all group-hover:scale-110 whitespace-nowrap"
            style={{
              color,
              borderColor: color + "33",
              backgroundColor: "#00000088",
            }}
          >
            {label}
          </span>
          <div
            className="w-0.5 h-2 rounded-full opacity-40"
            style={{ backgroundColor: color }}
          />
        </button>
      </Html>
    </group>
  );
}

/* ==================================================================
   Main scene
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
  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const moonPosRef = useRef(new THREE.Vector3(50, 0, 0));
  const rocketPosRef = useRef(new THREE.Vector3(0, 6.08, 0));
  const issPosRef = useRef(new THREE.Vector3(0, 6.4, 0));

  const handleClickEarth = useCallback(
    () => onTargetChange?.("earth"),
    [onTargetChange],
  );
  const handleClickMoon = useCallback(
    () => onTargetChange?.("moon"),
    [onTargetChange],
  );
  const handleClickSun = useCallback(
    () => onTargetChange?.("sun"),
    [onTargetChange],
  );
  const handleClickISS = useCallback(
    () => onTargetChange?.("iss"),
    [onTargetChange],
  );
  const handleClickRocket = useCallback(
    () => onTargetChange?.("rocket"),
    [onTargetChange],
  );

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
      <Stars
        radius={1500}
        depth={400}
        count={12000}
        factor={4.5}
        saturation={0.2}
      />

      <ambientLight intensity={0.04} />
      <directionalLight position={[15, 2, 0]} intensity={2.5} color="#fff5e6" />
      <directionalLight
        position={[-8, -2, -3]}
        intensity={0.08}
        color="#334466"
      />

      <Earth radius={6} onClick={handleClickEarth} />

      <Moon
        sunDirection={sunDir}
        onClick={handleClickMoon}
        positionRef={moonPosRef}
      />
      <MoonOrbitPath />

      <Sun onClick={handleClickSun} />

      <ISS onClick={handleClickISS} positionRef={issPosRef} />

      <OrbitTracers />
      <Satellites />
      <ShootingStars />

      {/* Static labels */}
      <ObjectLabel
        position={[0, 6.5, 0]}
        label="Earth"
        onClick={handleClickEarth}
        color="#44aaff"
      />
      <ObjectLabel
        position={SUN_POSITION.toArray()}
        label="Sun"
        onClick={handleClickSun}
        color="#ffaa33"
      />

      {/* Tracking labels */}
      <TrackingLabel
        posRef={moonPosRef}
        label="Moon"
        onClick={handleClickMoon}
        color="#aaaacc"
        yOffset={3}
      />
      <TrackingLabel
        posRef={issPosRef}
        label="ISS"
        onClick={handleClickISS}
        color="#66ffaa"
        yOffset={0.8}
      />
      {isLaunching && (
        <TrackingLabel
          posRef={rocketPosRef}
          label="Falcon 9"
          onClick={handleClickRocket}
          color="#ff8844"
          yOffset={0.4}
        />
      )}

      <Rocket
        isLaunching={isLaunching}
        padPosition={[0, 6.08, 0]}
        scale={0.025}
        onTelemetry={onTelemetry}
        positionRef={rocketPosRef}
      />

      <CameraController
        target={trackTarget}
        moonPosRef={moonPosRef}
        rocketPosRef={rocketPosRef}
        issPosRef={issPosRef}
      />
    </Canvas>
  );
}
