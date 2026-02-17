"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   HD procedural rocket — Falcon-9-style vehicle.
   Animation is entirely ref-based (no React state = no re-renders).
   Exhaust uses deterministic sine-wave noise (no Math.random jitter).
   ------------------------------------------------------------------ */

type RocketProps = {
  isLaunching: boolean;
  padPosition?: [number, number, number];
  scale?: number;
};

export default function Rocket({
  isLaunching,
  padPosition = [0, 6.08, 0],
  scale = 0.025,
}: RocketProps) {
  const groupRef = useRef<THREE.Group>(null);
  const exhaustGroupRef = useRef<THREE.Group>(null);
  const exhaustCoreRef = useRef<THREE.Mesh>(null);
  const exhaustLightRef = useRef<THREE.PointLight>(null);
  const startTimeRef = useRef(0);
  const launchedRef = useRef(false);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Not yet launched — hide
    if (!isLaunching && !launchedRef.current) {
      groupRef.current.visible = false;
      if (exhaustGroupRef.current) exhaustGroupRef.current.visible = false;
      return;
    }

    // First frame of launch
    if (isLaunching && !launchedRef.current) {
      launchedRef.current = true;
      startTimeRef.current = state.clock.elapsedTime;
      groupRef.current.visible = true;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const t = Math.min(elapsed / 30, 1); // 30-second ascent

    // Trajectory
    const altitude = t * 14;
    const tilt = Math.sin(t * Math.PI * 0.5) * 0.3;

    groupRef.current.position.set(
      padPosition[0] + tilt * 0.6,
      padPosition[1] + altitude,
      padPosition[2]
    );
    groupRef.current.rotation.z = -tilt;

    // Exhaust visibility
    const showExhaust = t > 0 && t < 0.95;
    if (exhaustGroupRef.current) exhaustGroupRef.current.visible = showExhaust;

    // Deterministic exhaust flicker (sine-wave noise, NOT Math.random)
    if (exhaustCoreRef.current && showExhaust) {
      const time = state.clock.elapsedTime;
      const fx = 0.85 + Math.sin(time * 23.7) * 0.1 + Math.sin(time * 47.3) * 0.05;
      const fy = 1.0 + Math.sin(time * 31.1) * 0.2 + Math.sin(time * 67.9) * 0.1;
      exhaustCoreRef.current.scale.set(fx, fy, fx);
    }

    if (exhaustLightRef.current) {
      const time = state.clock.elapsedTime;
      exhaustLightRef.current.intensity = showExhaust
        ? 3.5 + Math.sin(time * 19.3) * 1.2
        : 0;
    }
  });

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8e8e8",
        roughness: 0.3,
        metalness: 0.7,
      }),
    []
  );

  const darkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        roughness: 0.4,
        metalness: 0.8,
      }),
    []
  );

  const interstageMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#333333",
        roughness: 0.5,
        metalness: 0.6,
      }),
    []
  );

  const noseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0f0f0",
        roughness: 0.25,
        metalness: 0.5,
      }),
    []
  );

  return (
    <group ref={groupRef} scale={[scale, scale, scale]} visible={false}>
      {/* ===== FIRST STAGE ===== */}
      <mesh position={[0, 0, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.6, 0.6, 8, 32]} />
      </mesh>

      {/* Engine section */}
      <mesh position={[0, -4.2, 0]} material={darkMat}>
        <cylinderGeometry args={[0.6, 0.7, 0.6, 32]} />
      </mesh>

      {/* 9 engine bells */}
      {[...Array(9)].map((_, i) => {
        const angle = i === 8 ? 0 : (i / 8) * Math.PI * 2;
        const dist = i === 8 ? 0 : 0.38;
        return (
          <mesh
            key={`engine-${i}`}
            position={[Math.cos(angle) * dist, -4.6, Math.sin(angle) * dist]}
            material={darkMat}
          >
            <coneGeometry args={[0.12, 0.35, 16]} />
          </mesh>
        );
      })}

      {/* Grid fins */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`fin-${i}`}
            position={[Math.cos(angle) * 0.7, -3.5, Math.sin(angle) * 0.7]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.5, 0.5, 0.05]} />
            <meshStandardMaterial color="#333" roughness={0.6} metalness={0.7} />
          </mesh>
        );
      })}

      {/* Landing legs */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh
            key={`leg-${i}`}
            position={[Math.cos(angle) * 0.55, -4.0, Math.sin(angle) * 0.55]}
            rotation={[0.15, -angle, 0]}
          >
            <boxGeometry args={[0.08, 1.5, 0.06]} />
            <meshStandardMaterial color="#444" roughness={0.6} metalness={0.5} />
          </mesh>
        );
      })}

      {/* ===== INTERSTAGE ===== */}
      <mesh position={[0, 4.2, 0]} material={interstageMat}>
        <cylinderGeometry args={[0.6, 0.6, 0.5, 32]} />
      </mesh>

      {/* ===== SECOND STAGE ===== */}
      <mesh position={[0, 5.5, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.6, 0.6, 2.2, 32]} />
      </mesh>
      <mesh position={[0, 4.5, 0]} material={darkMat}>
        <coneGeometry args={[0.35, 0.6, 16]} />
      </mesh>

      {/* ===== PAYLOAD FAIRING ===== */}
      <mesh position={[0, 7.8, 0]} material={noseMat}>
        <cylinderGeometry args={[0.0, 0.6, 2.5, 32]} />
      </mesh>
      <mesh position={[0, 7.0, 0]} material={noseMat}>
        <cylinderGeometry args={[0.6, 0.6, 1.0, 32]} />
      </mesh>

      {/* Logo stripe */}
      <mesh position={[0.0, 2.0, 0.61]}>
        <planeGeometry args={[0.6, 0.15]} />
        <meshBasicMaterial color="#005288" />
      </mesh>

      {/* ===== EXHAUST PLUME — always rendered, visibility via ref ===== */}
      <group ref={exhaustGroupRef} position={[0, -5.0, 0]} visible={false}>
        <mesh ref={exhaustCoreRef}>
          <coneGeometry args={[0.5, 3.5, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh scale={[1.4, 1.2, 1.4]}>
          <coneGeometry args={[0.5, 3.5, 16]} />
          <meshBasicMaterial
            color="#ff6600"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh scale={[2.0, 1.5, 2.0]}>
          <coneGeometry args={[0.5, 4.0, 16]} />
          <meshBasicMaterial
            color="#ff3300"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <pointLight
          ref={exhaustLightRef}
          color="#ff6600"
          intensity={0}
          distance={5}
          decay={2}
        />
      </group>
    </group>
  );
}
