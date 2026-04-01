"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMissionStore } from "@/lib/store/missionStore";

/* ─── Scale ─────────────────────────────────────────────────────── */
const EARTH_R = 2.0;                       // scene units
export const SCALE = EARTH_R / 6_371_000;  // scene units per metre ≈ 3.14e-7

/* ─── Geometry helpers ──────────────────────────────────────────── */
function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/** Earth.tsx-compatible lat/lon → Y-up XYZ */
export function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const φ = lat * (Math.PI / 180);
  const λ = lon * (Math.PI / 180);
  return new THREE.Vector3(
    radius * Math.cos(φ) * Math.sin(λ),
    radius * Math.sin(φ),
    radius * Math.cos(φ) * Math.cos(λ),
  );
}

/** Same UTC rotation formula as Earth.tsx */
export function getUTCRotation(): number {
  const now  = new Date();
  const h    = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const doy  = getDayOfYear(now);
  const seas = ((doy - 172) / 365.25) * Math.PI * 2;
  return ((h - 12) / 24) * Math.PI * 2 - seas;
}

/** Y-axis rotation (matches Earth.tsx KSCMarker) */
export function applyYRotation(v: THREE.Vector3, angle: number): THREE.Vector3 {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new THREE.Vector3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

/* ─── Key positions (before UTC rotation) ───────────────────────── */
export const LC39B_PAD_BASE   = latLonToVec3(28.6272, -80.6208, EARTH_R);
/** Camera offshore from KSC, just above Atlantic surface */
export const ARTEMIS_CAM_BASE = latLonToVec3(28.5, -79.5, EARTH_R * 1.002);

/* ─── Physical constants ─────────────────────────────────────────── */
const NET_ACCEL = 3.0; // m/s² net liftoff acceleration (TWR ~1.3 minus gravity)
const H = 98 * SCALE;  // SLS total height in scene units
const UP = new THREE.Vector3(0, 1, 0);

/* ─── SLS Rocket model (1 SCALE = 1 metre) ───────────────────────── */
function SLSRocket() {
  const s = SCALE;
  return (
    <group>
      {/* Core stage — 65m, 8.4m diameter */}
      <mesh position={[0, H * 0.35, 0]}>
        <cylinderGeometry args={[4.2 * s, 4.2 * s, 65 * s, 32]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Orange intertank stripe */}
      <mesh position={[0, H * 0.37, 0]}>
        <cylinderGeometry args={[4.35 * s, 4.35 * s, 4.5 * s, 20]} />
        <meshStandardMaterial color="#FF6B00" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* SRB Left — 54m, 3.7m diameter */}
      <mesh position={[-7.5 * s, H * 0.28, 0]}>
        <cylinderGeometry args={[1.85 * s, 1.85 * s, 54 * s, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      <mesh position={[-7.5 * s, H * 0.56, 0]}>
        <coneGeometry args={[1.85 * s, 6 * s, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      <mesh position={[-7.5 * s, -3.5 * s, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.2 * s, 5 * s, 16]} />
        <meshStandardMaterial color="#444444" roughness={0.8} metalness={0.9} />
      </mesh>

      {/* SRB Right */}
      <mesh position={[7.5 * s, H * 0.28, 0]}>
        <cylinderGeometry args={[1.85 * s, 1.85 * s, 54 * s, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      <mesh position={[7.5 * s, H * 0.56, 0]}>
        <coneGeometry args={[1.85 * s, 6 * s, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      <mesh position={[7.5 * s, -3.5 * s, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.2 * s, 5 * s, 16]} />
        <meshStandardMaterial color="#444444" roughness={0.8} metalness={0.9} />
      </mesh>

      {/* ICPS adapter — 13.7m, tapers 8.4m → 5m */}
      <mesh position={[0, H * 0.72, 0]}>
        <cylinderGeometry args={[2.5 * s, 4.2 * s, 13.7 * s, 32]} />
        <meshStandardMaterial color="#555566" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Orion Service Module */}
      <mesh position={[0, H * 0.82, 0]}>
        <cylinderGeometry args={[2.5 * s, 2.5 * s, 3 * s, 32]} />
        <meshStandardMaterial color="#cc8833" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Orion Capsule */}
      <mesh position={[0, H * 0.87, 0]}>
        <coneGeometry args={[2.5 * s, 3.3 * s, 32]} />
        <meshStandardMaterial color="#ddddcc" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* LAS tower */}
      <mesh position={[0, H * 0.95, 0]}>
        <cylinderGeometry args={[0.4 * s, 0.4 * s, 6 * s, 8]} />
        <meshStandardMaterial color="#cc2200" roughness={0.5} />
      </mesh>
      <mesh position={[0, H * 0.99, 0]}>
        <coneGeometry args={[0.8 * s, 2 * s, 8]} />
        <meshStandardMaterial color="#cc2200" roughness={0.5} />
      </mesh>

      {/* RS-25 engine bells — 4 × nozzle, pointing down */}
      {([[-1.8, 0], [1.8, 0], [0, -1.8], [0, 1.8]] as [number, number][]).map(([ex, ez], i) => (
        <mesh key={i} position={[ex * s, -1.5 * s, ez * s]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[1.2 * s, 2.5 * s, 16]} />
          <meshStandardMaterial color="#333333" roughness={0.8} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Launch pad structures ──────────────────────────────────────── */
function LaunchPadStructure() {
  const s = SCALE;
  return (
    <group>
      {/* Mobile Launcher Platform */}
      <mesh position={[0, 4 * s, 0]}>
        <boxGeometry args={[20 * s, 8 * s, 20 * s]} />
        <meshStandardMaterial color="#666666" roughness={0.9} />
      </mesh>
      {/* Fixed Service Structure */}
      <mesh position={[15 * s, 40 * s, 0]}>
        <boxGeometry args={[4 * s, 80 * s, 4 * s]} />
        <meshStandardMaterial color="#888888" roughness={0.8} metalness={0.3} />
      </mesh>
    </group>
  );
}

/* ─── Exhaust plume particles (in rocket local space) ─────────────── */
const PARTICLE_COUNT = 400;

function ExhaustPlume({ active }: { active: boolean }) {
  const { points, geo, posArr, velArr, lifeArr, maxLifeArr } = useMemo(() => {
    const posArr     = new Float32Array(PARTICLE_COUNT * 3);
    const velArr     = new Float32Array(PARTICLE_COUNT * 3);
    const lifeArr    = new Float32Array(PARTICLE_COUNT);
    const maxLifeArr = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      maxLifeArr[i] = 0.6 + Math.random() * 0.9;
      lifeArr[i]    = Math.random() * maxLifeArr[i]; // stagger births

      posArr[i * 3]     = (Math.random() - 0.5) * 3 * SCALE;
      posArr[i * 3 + 1] = -Math.random() * SCALE;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 3 * SCALE;

      // Velocity: downward cone, 100-400 m/s equivalent
      const speed = (100 + Math.random() * 300) * SCALE;
      const cone  = Math.random() * 0.4; // radians spread
      const az    = Math.random() * Math.PI * 2;
      velArr[i * 3]     =  Math.sin(cone) * Math.cos(az) * speed;
      velArr[i * 3 + 1] = -Math.cos(cone) * speed; // downward in local space
      velArr[i * 3 + 2] =  Math.sin(cone) * Math.sin(az) * speed;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));

    const mat = new THREE.PointsMaterial({
      color: "#ff8800",
      size: 800 * SCALE,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { points: new THREE.Points(geo, mat), geo, posArr, velArr, lifeArr, maxLifeArr };
  }, []);

  useFrame((_, dt) => {
    if (!active) return;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      lifeArr[i] -= dt;
      if (lifeArr[i] <= 0) {
        posArr[i * 3]     = (Math.random() - 0.5) * 3 * SCALE;
        posArr[i * 3 + 1] = -SCALE;
        posArr[i * 3 + 2] = (Math.random() - 0.5) * 3 * SCALE;
        lifeArr[i] = maxLifeArr[i];
        continue;
      }
      posArr[i * 3]     += velArr[i * 3]     * dt;
      posArr[i * 3 + 1] += velArr[i * 3 + 1] * dt;
      posArr[i * 3 + 2] += velArr[i * 3 + 2] * dt;
    }
    attr.needsUpdate = true;
  });

  return <primitive object={points} visible={active} />;
}

/* ─── Main launch pad group ──────────────────────────────────────── */
export function LaunchPadGroup() {
  const launchSequenceActive = useMissionStore((s) => s.launchSequenceActive);

  const rocketRef  = useRef<THREE.Group>(null);
  const padRef     = useRef<THREE.Group>(null);
  const glowRef    = useRef<THREE.PointLight>(null);
  const steamRef   = useRef<THREE.Mesh>(null);
  const elapsedRef = useRef(0);
  const wasActive  = useRef(false);

  useFrame((_, dt) => {
    // Reset elapsed when launch is freshly triggered
    if (launchSequenceActive && !wasActive.current) elapsedRef.current = 0;
    wasActive.current = launchSequenceActive;
    if (launchSequenceActive) elapsedRef.current += dt;
    const el = elapsedRef.current;

    const utcRot = getUTCRotation();
    const base   = applyYRotation(LC39B_PAD_BASE, utcRot);
    const normal = base.clone().normalize();
    const quat   = new THREE.Quaternion().setFromUnitVectors(UP, normal);

    // Pad stays on surface
    if (padRef.current) {
      padRef.current.position.copy(base);
      padRef.current.quaternion.copy(quat);
    }

    // Rocket lifts off after 6s ignition burn-through
    const liftM  = launchSequenceActive && el > 6
      ? 0.5 * NET_ACCEL * (el - 6) ** 2 : 0;
    const rktPos = base.clone().add(normal.clone().multiplyScalar((8 + liftM) * SCALE));

    if (rocketRef.current) {
      rocketRef.current.position.copy(rktPos);
      rocketRef.current.quaternion.copy(quat);
    }

    // Engine glow light (world-space position set here)
    if (glowRef.current) {
      glowRef.current.intensity = launchSequenceActive ? Math.min(8, el * 2.5) : 0;
      glowRef.current.position.copy(rktPos);
    }

    // Steam cloud: expand 5m → 300m radius over 5s, then fade
    if (steamRef.current) {
      if (launchSequenceActive) {
        const t   = Math.min(el / 5, 1);
        steamRef.current.scale.setScalar((5 + t * 295) * SCALE);
        const opac = Math.max(0, 0.6 - Math.max(0, el - 4) * 0.1);
        (steamRef.current.material as THREE.MeshBasicMaterial).opacity = opac;
      } else {
        steamRef.current.scale.setScalar(0);
      }
    }
  });

  return (
    <>
      {/* Pad structure (stays on surface) */}
      <group ref={padRef}>
        <LaunchPadStructure />
        {/* Steam suppression cloud in pad local space */}
        <mesh ref={steamRef} scale={0}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Rocket (ascends along surface normal) */}
      <group ref={rocketRef}>
        <SLSRocket />
        {/* Exhaust particles in rocket local space: -Y = toward Earth */}
        <ExhaustPlume active={launchSequenceActive} />
      </group>

      {/* Engine glow light — world-space position driven by useFrame */}
      <pointLight
        ref={glowRef}
        color="#ff8800"
        intensity={0}
        distance={400 * SCALE}
        decay={2}
      />
    </>
  );
}
