import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export function CraftMarker({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.02;
    }
  });
  
  return (
    <group position={position}>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.2]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} />
      </mesh>
      <pointLight color="#00ffff" intensity={3} distance={4} />
    </group>
  );
}
