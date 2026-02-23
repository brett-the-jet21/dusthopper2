"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Falcon 9–style rocket with real stage separation sequence.
   All animation is ref-based (zero React re-renders).

   Timeline (30s compressed from real ~540s):
     T+0.0 – T+8.0   Full-stack ascent (9 Merlin engines)
     T+8.0            MECO — main engine cutoff
     T+8.5            Stage separation
     T+8.5 – T+20.0  S2 continues up (MVac), S1 flips & descends
     T+20.0           SECO — second engine cutoff
     T+20.0 – T+30.0  S2 coasts to orbit, S1 landing burn & touchdown
   ------------------------------------------------------------------ */

/* Falcon 9 telemetry (compressed timeline → approximate real values) */
export type LaunchTelemetry = {
  met: number;        // mission elapsed time (seconds, real-time scale)
  altitude: number;   // km
  speed: number;      // km/h
  phase: string;
};

type RocketProps = {
  isLaunching: boolean;
  padPosition?: [number, number, number];
  scale?: number;
  onTelemetry?: (t: LaunchTelemetry) => void;
};

// Map 30s animation time → approximate real Falcon 9 values
function getTelemetry(t30: number): LaunchTelemetry {
  const realT = t30 * 18; // 30s → ~540s real time
  let altitude = 0, speed = 0, phase = "Pre-launch";

  if (t30 <= 0) {
    phase = "Pre-launch";
  } else if (t30 < 8) {
    // First stage burn
    const p = t30 / 8;
    altitude = p * p * 80;         // ~80 km at MECO
    speed = p * 6800;              // ~6800 km/h at MECO
    phase = t30 < 4 ? "Max-Q" : "First Stage Burn";
    if (t30 < 1) phase = "Liftoff";
  } else if (t30 < 8.5) {
    altitude = 80;
    speed = 6800;
    phase = "MECO";
  } else if (t30 < 9) {
    altitude = 82;
    speed = 6700;
    phase = "Stage Separation";
  } else if (t30 < 20) {
    // Second stage burn
    const p = (t30 - 9) / 11;
    altitude = 82 + p * 118;      // 82 → 200 km
    speed = 6700 + p * 21300;     // → 28000 km/h orbital
    phase = "Second Stage Burn";
  } else if (t30 < 21) {
    altitude = 200;
    speed = 28000;
    phase = "SECO";
  } else {
    altitude = 200 + (t30 - 21) * 2;
    speed = 28000;
    phase = "Orbit Insertion";
  }

  return { met: realT, altitude: Math.round(altitude), speed: Math.round(speed), phase };
}

export default function Rocket({
  isLaunching,
  padPosition = [0, 6.08, 0],
  scale = 0.025,
  onTelemetry,
}: RocketProps) {
  // Whole vehicle (pre-separation), then acts as S1 post-sep
  const s1Ref = useRef<THREE.Group>(null);
  // Second stage + fairing
  const s2Ref = useRef<THREE.Group>(null);
  // Exhausts
  const s1ExhaustRef = useRef<THREE.Group>(null);
  const s2ExhaustRef = useRef<THREE.Group>(null);
  const s1CoreRef = useRef<THREE.Mesh>(null);
  const s2CoreRef = useRef<THREE.Mesh>(null);
  const s1LightRef = useRef<THREE.PointLight>(null);
  const s2LightRef = useRef<THREE.PointLight>(null);

  const startTimeRef = useRef(0);
  const launchedRef = useRef(false);
  const separatedRef = useRef(false);

  useFrame((state) => {
    if (!s1Ref.current || !s2Ref.current) return;

    if (!isLaunching && !launchedRef.current) {
      s1Ref.current.visible = false;
      s2Ref.current.visible = false;
      if (s1ExhaustRef.current) s1ExhaustRef.current.visible = false;
      if (s2ExhaustRef.current) s2ExhaustRef.current.visible = false;
      return;
    }

    if (isLaunching && !launchedRef.current) {
      launchedRef.current = true;
      startTimeRef.current = state.clock.elapsedTime;
      s1Ref.current.visible = true;
      s2Ref.current.visible = true;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const t = Math.min(elapsed, 30);
    const time = state.clock.elapsedTime;

    // Report telemetry
    if (onTelemetry) onTelemetry(getTelemetry(t));

    const SEP_TIME = 8.5;
    const hasSeparated = t >= SEP_TIME;

    if (hasSeparated && !separatedRef.current) {
      separatedRef.current = true;
    }

    if (!hasSeparated) {
      /* === PRE-SEPARATION: full stack rises together === */
      const p = t / SEP_TIME;
      const altitude = p * p * 5; // accelerating
      const tilt = p * p * 0.25;

      const pos: [number, number, number] = [
        padPosition[0] + tilt * 0.4,
        padPosition[1] + altitude,
        padPosition[2],
      ];

      s1Ref.current.position.set(...pos);
      s1Ref.current.rotation.z = -tilt;

      // S2 follows S1 exactly (offset in local space)
      s2Ref.current.position.set(...pos);
      s2Ref.current.rotation.z = -tilt;

      // S1 engines firing
      const showS1 = t > 0 && t < 8;
      if (s1ExhaustRef.current) s1ExhaustRef.current.visible = showS1;
      if (s2ExhaustRef.current) s2ExhaustRef.current.visible = false;

      if (s1CoreRef.current && showS1) {
        const fx = 0.85 + Math.sin(time * 23.7) * 0.1 + Math.sin(time * 47.3) * 0.05;
        const fy = 1.0 + Math.sin(time * 31.1) * 0.2 + Math.sin(time * 67.9) * 0.1;
        s1CoreRef.current.scale.set(fx, fy, fx);
      }
      if (s1LightRef.current) s1LightRef.current.intensity = showS1 ? 3.5 + Math.sin(time * 19.3) * 1.2 : 0;
    } else {
      /* === POST-SEPARATION: stages move independently === */
      const sepElapsed = t - SEP_TIME;

      // --- SECOND STAGE: continues ascending ---
      const s2p = Math.min(sepElapsed / 21.5, 1);
      const s2BaseAlt = 5; // altitude at separation
      const s2Altitude = s2BaseAlt + s2p * 15;
      const s2Tilt = 0.25 + s2p * 0.6; // gravity turn continues

      s2Ref.current.position.set(
        padPosition[0] + s2Tilt * 0.8,
        padPosition[1] + s2Altitude,
        padPosition[2],
      );
      s2Ref.current.rotation.z = -s2Tilt;

      const showS2Exhaust = sepElapsed < 11.5; // SECO at T+20
      if (s2ExhaustRef.current) s2ExhaustRef.current.visible = showS2Exhaust;
      if (s2CoreRef.current && showS2Exhaust) {
        const fx = 0.8 + Math.sin(time * 29.1) * 0.1;
        const fy = 1.0 + Math.sin(time * 37.3) * 0.15;
        s2CoreRef.current.scale.set(fx, fy, fx);
      }
      if (s2LightRef.current) s2LightRef.current.intensity = showS2Exhaust ? 2.0 + Math.sin(time * 22.1) * 0.8 : 0;

      // --- FIRST STAGE: flip, boost-back, descend, land ---
      const s1p = Math.min(sepElapsed / 21.5, 1);
      const s1BaseAlt = 5;

      // Flip maneuver (first 2s after sep)
      const flipProgress = Math.min(sepElapsed / 2, 1);
      const flipAngle = flipProgress * Math.PI; // 180° flip

      // Trajectory: rises slightly, then descends
      const s1Altitude = s1BaseAlt + Math.sin(s1p * Math.PI) * 2 - s1p * s1BaseAlt;
      const s1Drift = -s1p * 1.5; // drifts back toward pad

      s1Ref.current.position.set(
        padPosition[0] + 0.1 + s1Drift,
        padPosition[1] + Math.max(s1Altitude, 0),
        padPosition[2],
      );
      s1Ref.current.rotation.z = -(0.25 - flipAngle * 0.08);

      // Entry burn (T+13 to T+16 scene) and landing burn (T+26 to T+30)
      const entryBurn = sepElapsed > 4.5 && sepElapsed < 7.5;
      const landingBurn = sepElapsed > 17.5 && sepElapsed < 21.5;
      const showS1Exhaust = entryBurn || landingBurn;
      if (s1ExhaustRef.current) s1ExhaustRef.current.visible = showS1Exhaust;
      if (s1CoreRef.current && showS1Exhaust) {
        const intensity = landingBurn ? 0.6 : 1.0; // landing burn is single engine
        const fx = (0.85 + Math.sin(time * 23.7) * 0.1) * intensity;
        const fy = (1.0 + Math.sin(time * 31.1) * 0.2) * intensity;
        s1CoreRef.current.scale.set(fx, fy, fx);
      }
      if (s1LightRef.current) s1LightRef.current.intensity = showS1Exhaust ? 2.5 + Math.sin(time * 19.3) * 1.0 : 0;
    }
  });

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.3, metalness: 0.7 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.4, metalness: 0.8 }), []);
  const interstageMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#333333", roughness: 0.5, metalness: 0.6 }), []);
  const noseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.25, metalness: 0.5 }), []);

  return (
    <>
      {/* ===== FIRST STAGE ===== */}
      <group ref={s1Ref} scale={[scale, scale, scale]} visible={false}>
        <mesh material={bodyMat}>
          <cylinderGeometry args={[0.6, 0.6, 8, 32]} />
        </mesh>
        <mesh position={[0, -4.2, 0]} material={darkMat}>
          <cylinderGeometry args={[0.6, 0.7, 0.6, 32]} />
        </mesh>
        {[...Array(9)].map((_, i) => {
          const angle = i === 8 ? 0 : (i / 8) * Math.PI * 2;
          const dist = i === 8 ? 0 : 0.38;
          return (
            <mesh key={`e${i}`} position={[Math.cos(angle) * dist, -4.6, Math.sin(angle) * dist]} material={darkMat}>
              <coneGeometry args={[0.12, 0.35, 16]} />
            </mesh>
          );
        })}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <mesh key={`f${i}`} position={[Math.cos(a) * 0.7, -3.5, Math.sin(a) * 0.7]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.5, 0.5, 0.05]} />
              <meshStandardMaterial color="#333" roughness={0.6} metalness={0.7} />
            </mesh>
          );
        })}
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh key={`l${i}`} position={[Math.cos(a) * 0.55, -4.0, Math.sin(a) * 0.55]} rotation={[0.15, -a, 0]}>
              <boxGeometry args={[0.08, 1.5, 0.06]} />
              <meshStandardMaterial color="#444" roughness={0.6} metalness={0.5} />
            </mesh>
          );
        })}
        <mesh position={[0, 4.2, 0]} material={interstageMat}>
          <cylinderGeometry args={[0.6, 0.6, 0.5, 32]} />
        </mesh>
        <mesh position={[0.0, 2.0, 0.61]}>
          <planeGeometry args={[0.6, 0.15]} />
          <meshBasicMaterial color="#005288" />
        </mesh>

        {/* S1 Exhaust */}
        <group ref={s1ExhaustRef} position={[0, -5.0, 0]} visible={false}>
          <mesh ref={s1CoreRef}>
            <coneGeometry args={[0.5, 3.5, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh scale={[1.4, 1.2, 1.4]}>
            <coneGeometry args={[0.5, 3.5, 16]} />
            <meshBasicMaterial color="#ff6600" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh scale={[2.0, 1.5, 2.0]}>
            <coneGeometry args={[0.5, 4.0, 16]} />
            <meshBasicMaterial color="#ff3300" transparent opacity={0.15} blending={THREE.AdditiveBlending} />
          </mesh>
          <pointLight ref={s1LightRef} color="#ff6600" intensity={0} distance={5} decay={2} />
        </group>
      </group>

      {/* ===== SECOND STAGE + FAIRING ===== */}
      <group ref={s2Ref} scale={[scale, scale, scale]} visible={false}>
        <mesh position={[0, 5.5, 0]} material={bodyMat}>
          <cylinderGeometry args={[0.6, 0.6, 2.2, 32]} />
        </mesh>
        <mesh position={[0, 4.5, 0]} material={darkMat}>
          <coneGeometry args={[0.35, 0.6, 16]} />
        </mesh>
        <mesh position={[0, 7.8, 0]} material={noseMat}>
          <cylinderGeometry args={[0.0, 0.6, 2.5, 32]} />
        </mesh>
        <mesh position={[0, 7.0, 0]} material={noseMat}>
          <cylinderGeometry args={[0.6, 0.6, 1.0, 32]} />
        </mesh>

        {/* S2 Exhaust (MVac — single engine) */}
        <group ref={s2ExhaustRef} position={[0, 3.8, 0]} visible={false}>
          <mesh ref={s2CoreRef}>
            <coneGeometry args={[0.35, 2.5, 16]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh scale={[1.3, 1.3, 1.3]}>
            <coneGeometry args={[0.35, 2.5, 16]} />
            <meshBasicMaterial color="#4488ff" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh scale={[1.8, 1.5, 1.8]}>
            <coneGeometry args={[0.35, 3.0, 16]} />
            <meshBasicMaterial color="#2244aa" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
          </mesh>
          <pointLight ref={s2LightRef} color="#4488ff" intensity={0} distance={4} decay={2} />
        </group>
      </group>
    </>
  );
}
