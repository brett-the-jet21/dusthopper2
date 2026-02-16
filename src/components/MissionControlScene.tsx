"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { StarsField } from "./orbit/StarsField";
import { EarthPro } from "./orbit/EarthPro";
import Rocket from "./Rocket";

type Props = {
  launchProgress?: number;
};

function Scene({ launchProgress = -1 }: Props) {
  return (
    <>
      <StarsField />

      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 6, 10]} intensity={2.5} color="#fff5e6" />
      <directionalLight position={[-5, -3, -5]} intensity={0.3} color="#4477aa" />

      <Suspense fallback={null}>
        <EarthPro />
      </Suspense>

      {launchProgress >= 0 && (
        <Rocket launchProgress={launchProgress} padPosition={[0, 6.5, 0]} scale={0.08} />
      )}

      <OrbitControls
        enablePan={false}
        enableZoom
        enableRotate
        zoomSpeed={0.5}
        rotateSpeed={0.4}
        minDistance={8}
        maxDistance={40}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </>
  );
}

export default function MissionControlScene({ launchProgress = -1 }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 4, 18], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      gl={{
        antialias: true,
        toneMapping: 4,
        toneMappingExposure: 1.1,
      }}
    >
      <Scene launchProgress={launchProgress} />
    </Canvas>
  );
}
