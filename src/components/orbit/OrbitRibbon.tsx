import * as THREE from "three";
import { Line } from "@react-three/drei";

export function OrbitRibbon({ from, to, colorA, colorB, opacity }: any) {
  const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  
  return (
    <Line
      points={points}
      color={colorA}
      lineWidth={2}
      transparent
      opacity={opacity}
    />
  );
}
