"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Earth({ radius = 1.55 }: { radius?: number }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.06;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.09;
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial color="#0b3d91" roughness={0.85} metalness={0.05} />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius * 1.015, 96, 96]} />
        <meshStandardMaterial color="white" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius * 1.06, 96, 96]} />
        <meshBasicMaterial
          color="#5ab0ff"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
