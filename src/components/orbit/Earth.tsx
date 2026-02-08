'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import { Sphere } from '@react-three/drei';
import { EARTH_RADIUS_UNITS } from '@/lib/orbitMath';

export function Earth() {
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#123a9a'),
      roughness: 0.95,
      metalness: 0.0,
      emissive: new THREE.Color('#061126'),
      emissiveIntensity: 0.25,
    });
  }, []);

  return (
    <group>
      <Sphere args={[EARTH_RADIUS_UNITS, 128, 128]}>
        <primitive attach="material" object={material} />
      </Sphere>

      {/* cheap atmosphere glow */}
      <Sphere args={[EARTH_RADIUS_UNITS * 1.035, 128, 128]}>
        <meshBasicMaterial
          color={'#4aa3ff'}
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
}
