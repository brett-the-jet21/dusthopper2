"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   HD procedural rocket — Falcon-9-style two-stage vehicle with
   exhaust plume, grid fins, and engine bells built entirely from
   Three.js primitives (no external model files needed).
   ------------------------------------------------------------------ */

type RocketProps = {
  /** 0 → on pad, 1 → fully launched / in orbit */
  launchProgress: number;
  /** Position of the launch pad on the Earth surface */
  padPosition?: [number, number, number];
  scale?: number;
};

export default function Rocket({
  launchProgress,
  padPosition = [0, 1.6, 0],
  scale = 0.06,
}: RocketProps) {
  const groupRef = useRef<THREE.Group>(null);
  const exhaustRef = useRef<THREE.Mesh>(null);
  const exhaustLightRef = useRef<THREE.PointLight>(null);

  // Animate rocket position based on launch progress
  useFrame((_, dt) => {
    if (!groupRef.current) return;

    // Rocket ascent trajectory
    const t = launchProgress;
    const altitude = t * 8; // rises 8 units total
    const tilt = Math.sin(t * Math.PI * 0.5) * 0.3; // gravity turn

    groupRef.current.position.set(
      padPosition[0] + tilt * 0.5,
      padPosition[1] + altitude,
      padPosition[2]
    );

    // Slight pitch-over during ascent
    groupRef.current.rotation.z = -tilt;

    // Exhaust flicker
    if (exhaustRef.current && t > 0 && t < 0.95) {
      const flicker = 0.8 + Math.random() * 0.4;
      exhaustRef.current.scale.set(flicker, 1 + Math.random() * 0.5, flicker);
    }

    if (exhaustLightRef.current) {
      exhaustLightRef.current.intensity = t > 0 && t < 0.95 ? 3 + Math.random() * 2 : 0;
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

  const interstage = useMemo(
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

  const visible = launchProgress >= 0;

  return (
    <group ref={groupRef} scale={[scale, scale, scale]} visible={visible}>
      {/* ===== FIRST STAGE (bottom) ===== */}
      {/* Main body tube */}
      <mesh position={[0, 0, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.6, 0.6, 8, 32]} />
      </mesh>

      {/* Engine section (wider base) */}
      <mesh position={[0, -4.2, 0]} material={darkMat}>
        <cylinderGeometry args={[0.6, 0.7, 0.6, 32]} />
      </mesh>

      {/* 9 engine bells (Merlin 1D pattern) */}
      {[...Array(9)].map((_, i) => {
        const angle = i === 8 ? 0 : (i / 8) * Math.PI * 2;
        const dist = i === 8 ? 0 : 0.38;
        return (
          <mesh
            key={`engine-${i}`}
            position={[
              Math.cos(angle) * dist,
              -4.6,
              Math.sin(angle) * dist,
            ]}
            material={darkMat}
          >
            <coneGeometry args={[0.12, 0.35, 16]} />
          </mesh>
        );
      })}

      {/* Grid fins (4x) */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={`fin-${i}`}
            position={[
              Math.cos(angle) * 0.7,
              -3.5,
              Math.sin(angle) * 0.7,
            ]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.5, 0.5, 0.05]} />
            <meshStandardMaterial color="#333" roughness={0.6} metalness={0.7} />
          </mesh>
        );
      })}

      {/* Landing legs (4x, folded) */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh
            key={`leg-${i}`}
            position={[
              Math.cos(angle) * 0.55,
              -4.0,
              Math.sin(angle) * 0.55,
            ]}
            rotation={[0.15, -angle, 0]}
          >
            <boxGeometry args={[0.08, 1.5, 0.06]} />
            <meshStandardMaterial color="#444" roughness={0.6} metalness={0.5} />
          </mesh>
        );
      })}

      {/* ===== INTERSTAGE ===== */}
      <mesh position={[0, 4.2, 0]} material={interstage}>
        <cylinderGeometry args={[0.6, 0.6, 0.5, 32]} />
      </mesh>

      {/* ===== SECOND STAGE ===== */}
      <mesh position={[0, 5.5, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.6, 0.6, 2.2, 32]} />
      </mesh>

      {/* Second stage Merlin Vacuum engine */}
      <mesh position={[0, 4.5, 0]} material={darkMat}>
        <coneGeometry args={[0.35, 0.6, 16]} />
      </mesh>

      {/* ===== PAYLOAD FAIRING (nose cone) ===== */}
      <mesh position={[0, 7.8, 0]} material={noseMat}>
        <cylinderGeometry args={[0.0, 0.6, 2.5, 32]} />
      </mesh>
      {/* Fairing body */}
      <mesh position={[0, 7.0, 0]} material={noseMat}>
        <cylinderGeometry args={[0.6, 0.6, 1.0, 32]} />
      </mesh>

      {/* ===== SpaceX LOGO stripe ===== */}
      <mesh position={[0.0, 2.0, 0.61]}>
        <planeGeometry args={[0.6, 0.15]} />
        <meshBasicMaterial color="#005288" />
      </mesh>

      {/* ===== EXHAUST PLUME ===== */}
      {launchProgress > 0 && launchProgress < 0.95 && (
        <group position={[0, -5.0, 0]}>
          {/* Inner hot core */}
          <mesh ref={exhaustRef}>
            <coneGeometry args={[0.5, 3.5, 16]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Outer orange plume */}
          <mesh scale={[1.4, 1.2, 1.4]}>
            <coneGeometry args={[0.5, 3.5, 16]} />
            <meshBasicMaterial
              color="#ff6600"
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Wide dim plume */}
          <mesh scale={[2.0, 1.5, 2.0]}>
            <coneGeometry args={[0.5, 4.0, 16]} />
            <meshBasicMaterial
              color="#ff3300"
              transparent
              opacity={0.15}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Exhaust light */}
          <pointLight
            ref={exhaustLightRef}
            color="#ff6600"
            intensity={4}
            distance={5}
            decay={2}
          />
        </group>
      )}
    </group>
  );
}
