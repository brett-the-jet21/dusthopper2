"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import Earth from "./Earth";
import Rocket from "./Rocket";

type SceneProps = {
  /** 0 = on pad, 1 = in orbit, -1 = no active launch */
  launchProgress?: number;
};

export default function MissionScene({ launchProgress = -1 }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 5.5], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: 4, // ACESFilmic
        toneMappingExposure: 1.1,
      }}
    >
      {/* Deep-space starfield */}
      <Stars radius={400} depth={80} count={4000} factor={5} saturation={0.2} />

      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[10, 6, 10]}
        intensity={2.5}
        color="#fff5e6"
        castShadow
      />
      <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#4477aa" />

      {/* HD Earth */}
      <Earth radius={1.55} />

      {/* Rocket — only shown during active launch */}
      {launchProgress >= 0 && (
        <Rocket launchProgress={launchProgress} padPosition={[0, 1.6, 0]} />
      )}

      <OrbitControls
        enablePan={false}
        enableZoom
        enableRotate
        zoomSpeed={0.5}
        rotateSpeed={0.4}
        minDistance={2.5}
        maxDistance={15}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </Canvas>
  );
}
