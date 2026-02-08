import * as THREE from "three";

export function OrbitRibbon({ from, to, colorA, colorB, opacity }: any) {
  const points = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={colorA} transparent opacity={opacity} linewidth={2} />
    </line>
  );
}
