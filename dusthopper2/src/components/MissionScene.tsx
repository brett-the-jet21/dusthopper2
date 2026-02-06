"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";

export default function MissionScene() {
  return (
    <Canvas
      camera={{ position: [0, 2, 6], fov: 60 }}
      style={{ height: "100vh", background: "black" }}
    >
      <Stars radius={300} depth={60} count={2000} factor={7} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />

      {/* Earth placeholder */}
      <mesh>
        <sphereGeometry args={[1.5, 64, 64]} />
        <meshStandardMaterial color="#1e90ff" />
      </mesh>

      <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.6} rotateSpeed={0.5} />
    </Canvas>
  );
}
