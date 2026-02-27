"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";
import Earth from "./Earth";
import Moon from "./Moon";
import Sun, { SUN_POSITION } from "./Sun";
import Rocket from "./Rocket";
import type { LaunchTelemetry } from "./Rocket";

/* ===================================================================
   Track targets — the camera can smoothly fly to any of these
   =================================================================== */
export type TrackTarget = "overview" | "earth" | "moon" | "sun" | "rocket";

/* ------------------------------------------------------------------
   Camera controller — smooth lerp to tracked target
   ------------------------------------------------------------------ */
function CameraController({
  target,
  moonPosRef,
  isLaunching,
}: {
  target: TrackTarget;
  moonPosRef: React.MutableRefObject<THREE.Vector3>;
  isLaunching: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const lerpTarget = useRef(new THREE.Vector3(0, 0, 0));
  const lerpCamPos = useRef(new THREE.Vector3(0, 3, 18));
  const isTransitioning = useRef(false);
  const prevTarget = useRef<TrackTarget>("overview");

  useFrame(() => {
    if (!controlsRef.current) return;

    // Detect target change
    if (target !== prevTarget.current) {
      isTransitioning.current = true;
      prevTarget.current = target;
    }

    // Compute desired positions
    let desiredLookAt = new THREE.Vector3(0, 0, 0);
    let desiredCamPos = new THREE.Vector3(0, 3, 18);

    switch (target) {
      case "overview":
        desiredLookAt.set(0, 0, 0);
        desiredCamPos.set(0, 12, 35);
        break;
      case "earth":
        desiredLookAt.set(0, 0, 0);
        desiredCamPos.set(0, 3, 16);
        break;
      case "moon": {
        const mp = moonPosRef.current;
        desiredLookAt.copy(mp);
        const dir = mp.clone().normalize();
        desiredCamPos.copy(mp).add(dir.multiplyScalar(-8).add(new THREE.Vector3(0, 3, 0)));
        break;
      }
      case "sun":
        desiredLookAt.copy(SUN_POSITION);
        desiredCamPos.set(SUN_POSITION.x - 60, 15, 40);
        break;
      case "rocket":
        desiredLookAt.set(0, 8, 0);
        desiredCamPos.set(2, 8, 5);
        break;
    }

    lerpTarget.current.lerp(desiredLookAt, 0.025);
    lerpCamPos.current.lerp(desiredCamPos, 0.025);

    // Only override controls during transition
    const dist = camera.position.distanceTo(lerpCamPos.current);
    if (isTransitioning.current && dist > 0.1) {
      camera.position.lerp(lerpCamPos.current, 0.025);
      controlsRef.current.target.lerp(lerpTarget.current, 0.025);
    } else if (isTransitioning.current) {
      isTransitioning.current = false;
    }

    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      enableRotate
      zoomSpeed={0.8}
      rotateSpeed={0.5}
      minDistance={1.5}
      maxDistance={500}
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
            <meshBasicMaterial color={o.color} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.06, 16, 200]} />
            <meshBasicMaterial color={o.color} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------
   Satellite constellation — animated dots orbiting Earth
   ------------------------------------------------------------------ */
function Satellites() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 60;
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
      <meshBasicMaterial color="#88ffff" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------
   Shooting stars — occasional streaks across the sky
   ------------------------------------------------------------------ */
function ShootingStars() {
  const ref = useRef<THREE.Group>(null);
  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      arr.push({
        delay: Math.random() * 30,
        duration: 0.6 + Math.random() * 1.0,
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
          <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------
   Moon orbit path — faint ring showing lunar orbit
   ------------------------------------------------------------------ */
function MoonOrbitPath() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[80, 0.04, 8, 256]} />
      <meshBasicMaterial color="#445566" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------------
   Object labels — floating text indicators
   ------------------------------------------------------------------ */
function ObjectLabel({
  position,
  label,
  onClick,
  color = "#ffffff",
  distanceFade = true,
}: {
  position: THREE.Vector3 | [number, number, number];
  label: string;
  onClick?: () => void;
  color?: string;
  distanceFade?: boolean;
}) {
  const pos = position instanceof THREE.Vector3 ? position.toArray() : position;
  return (
    <Html
      position={[pos[0], pos[1] + 2.5, pos[2]]}
      center
      distanceFactor={distanceFade ? 40 : undefined}
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
  const moonPosRef = useRef(new THREE.Vector3(80, 0, 0));

  const handleClickEarth = useCallback(() => onTargetChange?.("earth"), [onTargetChange]);
  const handleClickMoon = useCallback(() => onTargetChange?.("moon"), [onTargetChange]);
  const handleClickSun = useCallback(() => onTargetChange?.("sun"), [onTargetChange]);

  return (
    <Canvas
      camera={{ position: [0, 12, 35], fov: 45, near: 0.1, far: 3000 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: 4,
        toneMappingExposure: 1.1,
        powerPreference: "high-performance",
      }}
      frameloop="always"
    >
      <Stars radius={1200} depth={300} count={8000} factor={5} saturation={0.3} />

      <ambientLight intensity={0.06} />
      <directionalLight position={[15, 2, 0]} intensity={2.8} color="#fff5e6" />
      <directionalLight position={[-8, -2, -3]} intensity={0.12} color="#4477aa" />

      <Earth radius={6} onClick={handleClickEarth} />

      <Moon sunDirection={sunDir} onClick={handleClickMoon} positionRef={moonPosRef} />
      <MoonOrbitPath />

      <Sun onClick={handleClickSun} />

      <OrbitTracers />
      <Satellites />
      <ShootingStars />

      {/* Labels */}
      <ObjectLabel position={[0, 6.5, 0]} label="Earth" onClick={handleClickEarth} color="#44aaff" />
      <MoonLabel moonPosRef={moonPosRef} onClick={handleClickMoon} />
      <ObjectLabel position={SUN_POSITION.toArray()} label="Sun" onClick={handleClickSun} color="#ffaa33" />

      <Rocket
        isLaunching={isLaunching}
        padPosition={[0, 6.08, 0]}
        scale={0.025}
        onTelemetry={onTelemetry}
      />

      <CameraController
        target={trackTarget}
        moonPosRef={moonPosRef}
        isLaunching={isLaunching}
      />
    </Canvas>
  );
}

/* Moon label follows moon position */
function MoonLabel({
  moonPosRef,
  onClick,
}: {
  moonPosRef: React.MutableRefObject<THREE.Vector3>;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.copy(moonPosRef.current);
    }
  });

  return (
    <group ref={ref}>
      <Html center distanceFactor={40} style={{ pointerEvents: "auto" }}>
        <button
          onClick={onClick}
          className="group flex flex-col items-center gap-1 cursor-pointer select-none"
          style={{ transform: "translateY(-20px)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full backdrop-blur-sm border transition-all group-hover:scale-110"
            style={{
              color: "#aaaacc",
              borderColor: "#aaaacc33",
              backgroundColor: "#00000088",
            }}
          >
            Moon
          </span>
          <div className="w-0.5 h-3 rounded-full opacity-40" style={{ backgroundColor: "#aaaacc" }} />
        </button>
      </Html>
    </group>
  );
}
