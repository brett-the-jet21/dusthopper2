"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import Earth from "./Earth";
import Rocket from "./Rocket";

/* ------------------------------------------------------------------
   Neon orbit tracers — glowing rings at different inclinations
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
          {/* Core line */}
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.012, 16, 200]} />
            <meshBasicMaterial
              color={o.color}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          {/* Outer glow */}
          <mesh rotation={[Math.PI / 2 + o.tilt, 0, o.rot]}>
            <torusGeometry args={[o.radius, 0.06, 16, 200]} />
            <meshBasicMaterial
              color={o.color}
              transparent
              opacity={0.12}
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
   Main scene — stable rendering, no state-driven re-renders
   ------------------------------------------------------------------ */
type SceneProps = {
  isLaunching?: boolean;
};

export default function MissionScene({ isLaunching = false }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 3, 18], fov: 45 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: 4,
        toneMappingExposure: 1.1,
        powerPreference: "high-performance",
      }}
      frameloop="always"
    >
      <Stars
        radius={300}
        depth={100}
        count={3000}
        factor={5}
        saturation={0.2}
      />

      <ambientLight intensity={0.12} />
      <directionalLight
        position={[10, 6, 10]}
        intensity={2.5}
        color="#fff5e6"
      />
      <directionalLight
        position={[-5, -3, -5]}
        intensity={0.3}
        color="#4477aa"
      />

      <Earth radius={6} />

      <OrbitTracers />

      <Rocket
        isLaunching={isLaunching}
        padPosition={[0, 6.08, 0]}
        scale={0.025}
      />

      <OrbitControls
        enablePan={false}
        enableZoom
        enableRotate
        zoomSpeed={0.6}
        rotateSpeed={0.4}
        minDistance={6.8}
        maxDistance={45}
        autoRotate
        autoRotateSpeed={0.08}
        enableDamping
        dampingFactor={0.05}
      />
    </Canvas>
  );
}
