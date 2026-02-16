"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type RocketProps = {
  launchProgress: number;
  padPosition?: [number, number, number];
  scale?: number;
};

export default function Rocket({
  launchProgress,
  padPosition = [0, 6.5, 0],
  scale = 0.08,
}: RocketProps) {
  const groupRef = useRef<THREE.Group>(null);
  const exhaustRef = useRef<THREE.Mesh>(null);
  const exhaustLightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    const t = launchProgress;
    const altitude = t * 12;
    const tilt = Math.sin(t * Math.PI * 0.5) * 0.3;

    groupRef.current.position.set(
      padPosition[0] + tilt * 0.5,
      padPosition[1] + altitude,
      padPosition[2]
    );

    groupRef.current.rotation.z = -tilt;

    if (exhaustRef.current && t > 0 && t < 0.95) {
      const flicker = 0.8 + Math.random() * 0.4;
      exhaustRef.current.scale.set(flicker, 1 + Math.random() * 0.5, flicker);
    }

    if (exhaustLightRef.current) {
      exhaustLightRef.current.intensity = t > 0 && t < 0.95 ? 3 + Math.random() * 2 : 0;
    }
  });

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.3, metalness: 0.7 }),
    []
  );
  const darkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.4, metalness: 0.8 }),
    []
  );
  const interMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#333333", roughness: 0.5, metalness: 0.6 }),
    []
  );
  const noseMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.25, metalness: 0.5 }),
    []
  );

  return (
    <group ref={groupRef} scale={[scale, scale, scale]} visible={launchProgress >= 0}>
      {/* First stage */}
      <mesh position={[0, 0, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.6, 0.6, 8, 32]} />
      </mesh>
      <mesh position={[0, -4.2, 0]} material={darkMat}>
        <cylinderGeometry args={[0.6, 0.7, 0.6, 32]} />
      </mesh>

      {/* 9 engines */}
      {[...Array(9)].map((_, i) => {
        const angle = i === 8 ? 0 : (i / 8) * Math.PI * 2;
        const dist = i === 8 ? 0 : 0.38;
        return (
          <mesh key={`e-${i}`} position={[Math.cos(angle) * dist, -4.6, Math.sin(angle) * dist]} material={darkMat}>
            <coneGeometry args={[0.12, 0.35, 16]} />
          </mesh>
        );
      })}

      {/* Grid fins */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={`f-${i}`} position={[Math.cos(a) * 0.7, -3.5, Math.sin(a) * 0.7]} rotation={[0, -a, 0]}>
            <boxGeometry args={[0.5, 0.5, 0.05]} />
            <meshStandardMaterial color="#333" roughness={0.6} metalness={0.7} />
          </mesh>
        );
      })}

      {/* Interstage + second stage */}
      <mesh position={[0, 4.2, 0]} material={interMat}>
        <cylinderGeometry args={[0.6, 0.6, 0.5, 32]} />
      </mesh>
      <mesh position={[0, 5.5, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.6, 0.6, 2.2, 32]} />
      </mesh>
      <mesh position={[0, 4.5, 0]} material={darkMat}>
        <coneGeometry args={[0.35, 0.6, 16]} />
      </mesh>

      {/* Payload fairing */}
      <mesh position={[0, 7.8, 0]} material={noseMat}>
        <cylinderGeometry args={[0.0, 0.6, 2.5, 32]} />
      </mesh>
      <mesh position={[0, 7.0, 0]} material={noseMat}>
        <cylinderGeometry args={[0.6, 0.6, 1.0, 32]} />
      </mesh>

      {/* Exhaust plume */}
      {launchProgress > 0 && launchProgress < 0.95 && (
        <group position={[0, -5.0, 0]}>
          <mesh ref={exhaustRef}>
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
          <pointLight ref={exhaustLightRef} color="#ff6600" intensity={4} distance={8} decay={2} />
        </group>
      )}
    </group>
  );
}
